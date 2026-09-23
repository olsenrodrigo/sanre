/**
 * Persistência local da Assistente: identificador da sessão e as últimas 30
 * mensagens, só neste navegador (localStorage). Tudo em try/catch — modo
 * privado, cota cheia ou storage bloqueado não podem quebrar o chat.
 */
import type { ModoAssistente, RespostaAssistente, Transbordo } from "./protocolo";

export type Mensagem =
  | {
      id: string;
      autor: "cliente";
      texto: string;
      /** Mensagem com receita/CPF/cartão: não saiu do aparelho e não é guardada. */
      retida?: boolean;
      em: number;
    }
  | {
      id: string;
      autor: "assistente";
      respostas: RespostaAssistente[];
      transbordo?: Transbordo;
      modo?: ModoAssistente;
      /** Gerada no navegador (boas-vindas, aviso de privacidade), não pelo servidor. */
      local?: boolean;
      em: number;
    }
  | { id: string; autor: "aviso"; texto: string; reenviar?: string; whatsappUrl?: string; em: number };

interface Sessao {
  sessaoId: string;
  atualizadaEm: number;
  /** Último produto que ganhou mensagem de boas-vindas — evita repetir. */
  produtoSaudado?: string | null;
}

const CHAVE_SESSAO = "sanre:assistente:sessao";
const CHAVE_MENSAGENS = "sanre:assistente:mensagens";
export const MAX_MENSAGENS = 30;
/** Conversa parada há mais de 30 dias recomeça do zero (e com outro sessaoId). */
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

export function novoUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ler<T>(chave: string): T | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem storage: a conversa vive só na memória desta aba */
  }
}

function remover(chave: string): void {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    /* idem */
  }
}

function mensagemValida(m: unknown): m is Mensagem {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  if (typeof x.id !== "string" || typeof x.em !== "number") return false;
  if (x.autor === "cliente" || x.autor === "aviso") return typeof x.texto === "string";
  if (x.autor === "assistente") return Array.isArray(x.respostas);
  return false;
}

export interface Estado {
  sessaoId: string;
  mensagens: Mensagem[];
  produtoSaudado: string | null;
}

export function carregar(): Estado {
  const s = ler<Sessao>(CHAVE_SESSAO);
  const valida = s && typeof s.sessaoId === "string" && UUID_V4.test(s.sessaoId) && Date.now() - (s.atualizadaEm || 0) < VALIDADE_MS;
  if (!valida) {
    const novo: Estado = { sessaoId: novoUuid(), mensagens: [], produtoSaudado: null };
    remover(CHAVE_MENSAGENS);
    gravar(CHAVE_SESSAO, { sessaoId: novo.sessaoId, atualizadaEm: Date.now(), produtoSaudado: null } satisfies Sessao);
    return novo;
  }
  const lista = ler<unknown[]>(CHAVE_MENSAGENS);
  const mensagens = Array.isArray(lista) ? lista.filter(mensagemValida).slice(-MAX_MENSAGENS) : [];
  return { sessaoId: s!.sessaoId, mensagens, produtoSaudado: s!.produtoSaudado ?? null };
}

export function salvar(e: Estado): void {
  gravar(CHAVE_SESSAO, { sessaoId: e.sessaoId, atualizadaEm: Date.now(), produtoSaudado: e.produtoSaudado } satisfies Sessao);
  gravar(CHAVE_MENSAGENS, e.mensagens.slice(-MAX_MENSAGENS));
}

/** "Apagar conversa": some com o histórico e troca o identificador da sessão. */
export function apagar(): Estado {
  remover(CHAVE_MENSAGENS);
  const novo: Estado = { sessaoId: novoUuid(), mensagens: [], produtoSaudado: null };
  gravar(CHAVE_SESSAO, { sessaoId: novo.sessaoId, atualizadaEm: Date.now(), produtoSaudado: null } satisfies Sessao);
  return novo;
}
