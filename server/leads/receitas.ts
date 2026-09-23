// Arquivos de receita — dado de saúde (LGPD art. 11).
//
// Regras deste módulo, todas deliberadas:
//  - o arquivo mora em privado/receitas/, FORA de uploads/ (que é servido por
//    express.static): não existe URL pública que chegue nele;
//  - o nome em disco é aleatório (128 bits) e não carrega protocolo, nome da
//    cliente nem o nome original do arquivo;
//  - o tipo é decidido pelos bytes do arquivo (assinatura), não pelo que o
//    navegador declarou — extensão e MIME só servem para recusar cedo;
//  - todo arquivo tem prazo (expires_at) e o expurgo roda no boot e de hora em
//    hora; a linha sobrevive com purged_at preenchido, como prova do expurgo;
//  - nada daqui loga caminho, token, nome ou conteúdo.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomBytes } from "node:crypto";
import { RETENCAO_RECEITA_DIAS } from "./regras";
import {
  caminhosDeReceitasAtivas,
  listarReceitasVencidas,
  marcarReceitasExpurgadas,
} from "./repositorio";

export const MAX_BYTES_RECEITA = 8 * 1024 * 1024;

export const EXTENSOES_RECEITA = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];
export const MIMES_RECEITA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export type TipoReceita = "jpg" | "png" | "webp" | "heic" | "pdf";

const MIME_POR_TIPO: Record<TipoReceita, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

const EXT_POR_TIPO: Record<TipoReceita, string[]> = {
  jpg: [".jpg", ".jpeg"],
  png: [".png"],
  webp: [".webp"],
  heic: [".heic", ".heif"],
  pdf: [".pdf"],
};

/** Diretório das receitas. `RECEITAS_DIR` permite apontar para um volume próprio em produção. */
export function diretorioReceitas(): string {
  return path.resolve(process.env.RECEITAS_DIR || path.join(process.cwd(), "privado", "receitas"));
}

function garantirDiretorio(): string {
  const dir = diretorioReceitas();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Caminho absoluto de um arquivo guardado, sem nunca sair do diretório das receitas. */
export function caminhoAbsoluto(relativo: string): string | null {
  const dir = diretorioReceitas();
  const abs = path.resolve(dir, path.basename(relativo));
  return abs.startsWith(dir + path.sep) ? abs : null;
}

/** Tipo real do arquivo pela assinatura dos primeiros bytes. */
export function detectarTipo(buf: Buffer): TipoReceita | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  if (buf.toString("latin1", 4, 8) === "ftyp") {
    const marca = buf.toString("latin1", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(marca)) return "heic";
  }
  return null;
}

/** Extensão declarada compatível com o conteúdo real. */
export function extensaoConfere(tipo: TipoReceita, nomeOriginal: string): boolean {
  return EXT_POR_TIPO[tipo].includes(path.extname(nomeOriginal).toLowerCase());
}

export interface ReceitaGravada {
  relativo: string;
  mimeType: string;
  sizeBytes: number;
  token: string;
  expiresAt: Date;
}

/** Grava o arquivo com nome aleatório e permissão só do dono do processo. */
export async function gravarReceita(buf: Buffer, tipo: TipoReceita): Promise<ReceitaGravada> {
  const dir = garantirDiretorio();
  const nome = `${randomBytes(16).toString("hex")}.${tipo}`;
  await fsp.writeFile(path.join(dir, nome), buf, { mode: 0o600, flag: "wx" });
  return {
    relativo: nome,
    mimeType: MIME_POR_TIPO[tipo],
    sizeBytes: buf.length,
    token: randomBytes(24).toString("base64url"),
    expiresAt: new Date(Date.now() + RETENCAO_RECEITA_DIAS * 24 * 60 * 60 * 1000),
  };
}

export async function apagarArquivoReceita(relativo: string): Promise<void> {
  const abs = caminhoAbsoluto(relativo);
  // Tolerante a arquivo já removido: um ENOENT não pode parar o expurgo do resto.
  if (abs) await fsp.unlink(abs).catch(() => {});
}

export function extensaoDoMime(mime: string): string {
  const tipo = (Object.keys(MIME_POR_TIPO) as TipoReceita[]).find(t => MIME_POR_TIPO[t] === mime);
  return tipo ?? "bin";
}

// ─── Expurgo ──────────────────────────────────────────────────────────────────
const INTERVALO_EXPURGO_MS = 60 * 60 * 1000;
/** Órfão (arquivo sem linha ativa) só é apagado depois disso — evita correr com um upload em curso. */
const IDADE_MINIMA_ORFAO_MS = 60 * 60 * 1000;

/**
 * Apaga as receitas vencidas e marca `purged_at`. Também remove arquivos
 * órfãos (sem linha ativa no banco — ex.: lead apagado ou gravação que falhou
 * no meio), porque receita esquecida no disco é receita retida sem prazo.
 */
export async function purgarReceitasVencidas(agora: Date = new Date()): Promise<{ expurgadas: number; orfaos: number }> {
  const vencidas = await listarReceitasVencidas(agora);
  for (const r of vencidas) await apagarArquivoReceita(r.filePath);
  if (vencidas.length) await marcarReceitasExpurgadas(vencidas.map(r => r.id), agora);

  let orfaos = 0;
  const dir = diretorioReceitas();
  if (fs.existsSync(dir)) {
    const ativos = new Set((await caminhosDeReceitasAtivas()).map(c => path.basename(c)));
    for (const nome of await fsp.readdir(dir)) {
      if (ativos.has(nome)) continue;
      const abs = path.join(dir, nome);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st?.isFile() || agora.getTime() - st.mtimeMs < IDADE_MINIMA_ORFAO_MS) continue;
      await fsp.unlink(abs).catch(() => {});
      orfaos++;
    }
  }

  // Só contagem — nunca caminho, token ou lead.
  if (vencidas.length || orfaos) {
    console.log(`[leads] expurgo de receitas: ${vencidas.length} vencida(s), ${orfaos} órfã(s)`);
  }
  return { expurgadas: vencidas.length, orfaos };
}

let expurgoArmado = false;

/** Boot + de hora em hora. Processo parado não pode esticar a retenção prometida. */
export function agendarExpurgoReceitas(): void {
  if (expurgoArmado) return;
  expurgoArmado = true;
  const rodar = () =>
    purgarReceitasVencidas().catch((e: unknown) =>
      console.error("[leads] ALERTA: expurgo de receitas falhou:", (e as Error)?.message),
    );
  void rodar();
  setInterval(rodar, INTERVALO_EXPURGO_MS).unref();
}
