/**
 * Adaptador para o agente externo (plataforma Sintetiza).
 *
 * Com `ASSISTENTE_URL` e `ASSISTENTE_TOKEN` definidos, cada mensagem do site é
 * encaminhada por POST JSON assinado (HMAC-SHA256 do corpo exato, header
 * `X-Sanre-Assinatura: sha256=<hex>`). Qualquer falha — rede, timeout, HTTP
 * não-2xx, JSON quebrado, resposta fora do contrato — devolve `{ ok: false }`
 * e a rota responde pelo roteiro. Contrato: docs/ASSISTENTE.md.
 *
 * LGPD: o log registra só o TIPO da falha e a latência, nunca o texto.
 */
import { createHmac } from "crypto";
import type { SaidaAssistente } from "../../client/src/components/assistente/protocolo";
import { respostaAgenteSchema, type ContextoValidado } from "./contrato";

export type FalhaAgente =
  | "nao_configurado"
  | "disjuntor_aberto"
  | "timeout"
  | "rede"
  | "status_http"
  | "resposta_grande"
  | "json_invalido"
  | "contrato_invalido";

export interface ConfigAgente {
  url: string;
  token: string;
  timeoutMs: number;
}

const TIMEOUT_PADRAO_MS = 20_000;
const MAX_RESPOSTA_BYTES = 256 * 1024;

let avisouConfig = false;

/** Lido a cada chamada: trocar a env e reiniciar é o único jeito de mudar. */
export function configAgente(): ConfigAgente | null {
  const url = (process.env.ASSISTENTE_URL || "").trim();
  if (!url) return null;
  const token = (process.env.ASSISTENTE_TOKEN || "").trim();
  let valida = false;
  try {
    const u = new URL(url);
    valida = u.protocol === "https:" || u.protocol === "http:";
  } catch {
    valida = false;
  }
  if (!token || !valida) {
    // Sem token não há assinatura — não encaminhamos conversa sem assinar.
    if (!avisouConfig) {
      avisouConfig = true;
      console.warn(
        `[assistente] ASSISTENTE_URL definido, mas ${!token ? "ASSISTENTE_TOKEN ausente" : "URL inválida"}: seguindo no modo roteiro.`,
      );
    }
    return null;
  }
  const t = Number(process.env.ASSISTENTE_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(t) && t >= 500 && t <= 120_000 ? t : TIMEOUT_PADRAO_MS;
  return { url, token, timeoutMs };
}

export function assinar(corpo: string, token: string): string {
  return `sha256=${createHmac("sha256", token).update(corpo, "utf8").digest("hex")}`;
}

// ─── Disjuntor ───────────────────────────────────────────────────────────────
// Agente fora do ar não pode fazer cada cliente esperar o timeout inteiro:
// depois de 3 falhas seguidas, 60 s direto no roteiro; aí tenta de novo.

const FALHAS_PARA_ABRIR = 3;
const DISJUNTOR_MS = 60_000;
let falhasSeguidas = 0;
let abertoAte = 0;

function registrarFalha(): void {
  falhasSeguidas += 1;
  if (falhasSeguidas >= FALHAS_PARA_ABRIR) {
    abertoAte = Date.now() + DISJUNTOR_MS;
    falhasSeguidas = 0;
    console.warn(`[assistente] agente com ${FALHAS_PARA_ABRIR} falhas seguidas: roteiro por ${DISJUNTOR_MS / 1000}s`);
  }
}

// ─── Chamada ─────────────────────────────────────────────────────────────────

export interface PedidoAgente {
  sessaoId: string;
  texto: string;
  contexto?: ContextoValidado;
}

export type ResultadoAgente =
  | { ok: true; saida: SaidaAssistente; ms: number }
  | { ok: false; erro: FalhaAgente; ms: number; status?: number };

export async function consultarAgente(pedido: PedidoAgente): Promise<ResultadoAgente> {
  const inicio = Date.now();
  const cfg = configAgente();
  if (!cfg) return { ok: false, erro: "nao_configurado", ms: 0 };
  if (Date.now() < abertoAte) return { ok: false, erro: "disjuntor_aberto", ms: 0 };

  const corpo = JSON.stringify({
    canal: "site",
    sessaoId: pedido.sessaoId,
    texto: pedido.texto,
    contexto: pedido.contexto ?? {},
    enviadoEm: new Date().toISOString(),
  });

  const falha = (erro: FalhaAgente, status?: number): ResultadoAgente => {
    registrarFalha();
    return { ok: false, erro, status, ms: Date.now() - inicio };
  };

  let resposta: Response;
  try {
    resposta = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": "SanreSite-Assistente/1.0",
        "X-Sanre-Assinatura": assinar(corpo, cfg.token),
      },
      body: corpo,
      redirect: "error",
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e: unknown) {
    const nome = (e as { name?: string })?.name;
    return falha(nome === "TimeoutError" || nome === "AbortError" ? "timeout" : "rede");
  }

  if (!resposta.ok) {
    resposta.body?.cancel().catch(() => {});
    return falha("status_http", resposta.status);
  }

  let bruto: string;
  try {
    bruto = await resposta.text();
  } catch (e: unknown) {
    const nome = (e as { name?: string })?.name;
    return falha(nome === "TimeoutError" || nome === "AbortError" ? "timeout" : "rede");
  }
  if (Buffer.byteLength(bruto, "utf8") > MAX_RESPOSTA_BYTES) return falha("resposta_grande");

  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return falha("json_invalido");
  }

  const validado = respostaAgenteSchema.safeParse(json);
  if (!validado.success) return falha("contrato_invalido");

  falhasSeguidas = 0;
  return {
    ok: true,
    ms: Date.now() - inicio,
    saida: {
      modo: "agente",
      respostas: validado.data.respostas,
      ...(validado.data.transbordo ? { transbordo: validado.data.transbordo } : {}),
    },
  };
}

