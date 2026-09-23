#!/usr/bin/env node
/**
 * QA visual por linha de comando: abre cada rota num Chrome headless, em várias
 * larguras (emulação real via CDP — `--window-size` não emula celular no macOS),
 * e reporta overflow horizontal, erros de console/rede e status HTTP.
 * Opcionalmente salva screenshot de página inteira.
 *
 *   node script/qa/varrer.mjs http://localhost:5410 / /loja /oculos-de-sol \
 *     --larguras=390,1440 --shots=/tmp/shots
 *
 * Saída: uma linha por (rota, largura) e código de saída 1 se algo falhar.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";

const args = process.argv.slice(2);
const base = args.find(a => a.startsWith("http"))?.replace(/\/$/, "");
const rotas = args.filter(a => a.startsWith("/"));
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split("=")[1];
const larguras = (opt("larguras") ?? "390,1440").split(",").map(Number);
const pastaShots = opt("shots");
if (!base || !rotas.length) {
  console.error("uso: node script/qa/varrer.mjs <base> <rota...> [--larguras=390,1440] [--shots=dir]");
  process.exit(2);
}
if (pastaShots) mkdirSync(pastaShots, { recursive: true });

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const porta = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${porta}`, "--disable-gpu", "--no-first-run",
  "--no-default-browser-check", `--user-data-dir=/tmp/qa-chrome-${porta}`, "about:blank",
], { stdio: "ignore" });

const esperar = ms => new Promise(r => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50 && !alvo; i++) {
  await esperar(200);
  try {
    const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    alvo = lista.find(t => t.type === "page");
  } catch { /* ainda subindo */ }
}
if (!alvo) {
  console.error("Chrome não subiu");
  chrome.kill();
  process.exit(2);
}

const ws = new WebSocket(alvo.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise(r => ws.once("open", r));
let seq = 0;
const pendentes = new Map();
const eventos = [];
ws.on("message", raw => {
  const m = JSON.parse(raw.toString());
  if (m.id && pendentes.has(m.id)) {
    pendentes.get(m.id)(m);
    pendentes.delete(m.id);
  } else if (m.method) eventos.push(m);
});
const cdp = (method, params = {}) =>
  new Promise(res => {
    const id = ++seq;
    pendentes.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Log.enable");

let falhas = 0;
for (const largura of larguras) {
  const movel = largura < 768;
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: largura, height: movel ? 844 : 900, deviceScaleFactor: 1, mobile: movel,
  });
  for (const rota of rotas) {
    eventos.length = 0;
    await cdp("Page.navigate", { url: base + rota });
    await esperar(2600);
    const r = await cdp("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
        const d = document.documentElement;
        const largos = [...document.querySelectorAll("body *")]
          .filter(e => e.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(e).position !== "fixed")
          .slice(0, 3).map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").slice(0, 2).join(".") : ""));
        window.scrollTo({ top: 0, behavior: "instant" });
        return { sw: d.scrollWidth, cw: d.clientWidth, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) ?? "", titulo: document.title, largos };
      })()`,
    });
    const v = r.result?.result?.value ?? {};
    const erros = eventos
      .filter(e =>
        (e.method === "Runtime.exceptionThrown") ||
        (e.method === "Log.entryAdded" && e.params.entry.level === "error") ||
        (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"))
      .map(e => e.params.exceptionDetails?.exception?.description?.split("\n")[0]
        ?? e.params.entry?.text ?? e.params.args?.map(a => a.value ?? a.description).join(" "))
      .filter(t => !/favicon|ERR_BLOCKED_BY_CLIENT|googletagmanager|facebook|fonts\.g/i.test(t ?? ""));
    const http = eventos.find(e => e.method === "Network.responseReceived" && e.params.type === "Document")?.params.response.status;
    const overflow = v.sw > v.cw;
    const ok = !overflow && !erros.length;
    if (!ok) falhas++;
    console.log(
      `${ok ? "OK  " : "FALHA"} ${String(largura).padStart(4)}px ${String(http ?? "?").padStart(3)} ${rota.padEnd(42)} ` +
      `${overflow ? `OVERFLOW ${v.sw}>${v.cw} ${v.largos.join(",")} ` : ""}${erros.length ? `ERROS: ${erros.slice(0, 2).join(" | ")}` : ""}` +
      (ok ? `h1="${v.h1}"` : ""),
    );
    if (pastaShots) {
      const alturaPag = await cdp("Runtime.evaluate", { returnByValue: true, expression: "Math.min(document.documentElement.scrollHeight, 9000)" });
      const h = alturaPag.result?.result?.value ?? 900;
      const shot = await cdp("Page.captureScreenshot", {
        format: "jpeg", quality: 70, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: largura, height: h, scale: 1 },
      });
      const nome = `${rota.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${largura}.jpg`;
      writeFileSync(join(pastaShots, nome), Buffer.from(shot.result.data, "base64"));
    }
  }
}

ws.close();
chrome.kill();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
process.exit(falhas ? 1 : 0);
