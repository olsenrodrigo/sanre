/**
 * Contrato da Assistente Sanrê — tipos da API e formato da passagem para o
 * WhatsApp. Documentação completa em docs/ASSISTENTE.md.
 *
 * Módulo PURO (sem React, sem DOM, sem Node): é importado pelo widget e pelo
 * servidor (server/assistente), para que o link do WhatsApp saia idêntico dos
 * dois lados. Por ownership ele mora aqui; o lugar natural seria shared/.
 */
import { linkWhatsapp, UNIDADES, type UnidadeSlug } from "@shared/unidades";

// ─── Contrato da API ─────────────────────────────────────────────────────────

export const LIMITE_TEXTO = 800;

export interface ProdutoCard {
  slug: string;
  titulo: string;
  marca: string | null;
  /** Reais, ex.: 1049.9. Nulo quando o agente não tem preço com fonte. */
  preco: number | null;
  imagem: string | null;
}

export interface AcaoAssistente {
  rotulo: string;
  /** Caminho do site ("/lentes-de-grau") ou URL https (WhatsApp, mapa). */
  href?: string;
  /** Texto enviado como se a cliente tivesse digitado. */
  enviar?: string;
}

export type RespostaAssistente =
  | { tipo: "texto"; texto: string }
  | { tipo: "produtos"; itens: ProdutoCard[] }
  | { tipo: "acoes"; acoes: AcaoAssistente[] };

export type ModoAssistente = "agente" | "roteiro";

export interface Transbordo {
  whatsappUrl: string;
  /** Código curto: "cliente_pediu", "nao_entendeu", "orcamento_grau"… */
  motivo: string;
}

export interface SaidaAssistente {
  modo: ModoAssistente;
  respostas: RespostaAssistente[];
  transbordo?: Transbordo;
}

export interface ConfigAssistente {
  ativo: boolean;
  modo: ModoAssistente;
  whatsapp: string;
}

// ─── Privacidade ─────────────────────────────────────────────────────────────

/**
 * Sequência numérica longa (CPF, cartão, telefone, CEP): 6+ dígitos, com ou
 * sem separador. Preço digitado ("até 500", "R$ 1.500") tem menos dígitos.
 */
const NUMERO_LONGO = /\d(?:[\s.\-/]?\d){5,}/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Tira da frase o que identifica a pessoa antes de ela ir para um link. */
export function mascararDados(texto: string): string {
  return texto.replace(EMAIL, "[e-mail]").replace(NUMERO_LONGO, "[número]");
}

/**
 * Parece dado que não deve trafegar pelo chat do site: receita (OD/OE com
 * grau, esférico, cilíndrico, eixo, DNP, adição), CPF ou número de cartão.
 */
export function pareceDadoSensivel(texto: string): boolean {
  const t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const grau = /[+-]\s?\d{1,2}[.,]\d{2}\b/;
  if (/\b(od|oe|o\.d\.|o\.e\.)\b/.test(t) && grau.test(t)) return true;
  if (/\b(esferico|cilindrico|eixo|dnp|adicao)\b/.test(t) && /\d/.test(t)) return true;
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(t)) return true; // CPF
  if (/\b(?:\d[\s-]?){13,19}\b/.test(t)) return true; // cartão
  return false;
}

// ─── Passagem para o WhatsApp ────────────────────────────────────────────────

/** Etiqueta que o agente procura na mensagem: `[site:1a2b3c4d]`. */
export function etiquetaSessao(sessaoId: string): string {
  const curto = sessaoId.replace(/[^0-9a-f]/gi, "").slice(0, 8).toLowerCase();
  return `[site:${curto}]`;
}

/** Expressão para o agente reconhecer a etiqueta (documentada em docs/ASSISTENTE.md). */
export const ETIQUETA_REGEX = /\[site:([0-9a-f]{8})\]/;

export interface DadosPassagem {
  sessaoId: string;
  /** Host público sem protocolo, ex.: "oticasanre.com.br". */
  host?: string | null;
  produto?: { slug: string; titulo: string } | null;
  unidade?: UnidadeSlug | null;
  /** Frase pronta ("Quero falar com uma consultora.") — tem precedência sobre `pergunta`. */
  resumo?: string | null;
  /** Última pergunta da cliente, crua — é mascarada e encurtada aqui. */
  pergunta?: string | null;
}

const MAX_PERGUNTA = 160;

function terminarFrase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/** Uma linha, sem quebra, sem dado pessoal, no máximo ~160 caracteres. */
export function resumirPergunta(pergunta: string): string {
  const limpa = mascararDados(pergunta).replace(/\s+/g, " ").trim();
  if (!limpa) return "";
  const curta = limpa.length > MAX_PERGUNTA ? `${limpa.slice(0, MAX_PERGUNTA - 1).trimEnd()}…` : limpa;
  return `Minha dúvida: ${terminarFrase(curta)}`;
}

/**
 * Mensagem pré-preenchida do WhatsApp. Formato (uma linha):
 *
 *   Olá! Vim pelo site da Sanrê. [site:1a2b3c4d] Estou vendo o <título>
 *   (<host>/loja/produto/<slug>). <resumo> Prefiro a loja de <unidade>.
 *
 * Só os dois primeiros blocos são fixos; os outros aparecem quando existem.
 */
export function montarMensagemWhatsapp(d: DadosPassagem): string {
  const partes = ["Olá! Vim pelo site da Sanrê.", etiquetaSessao(d.sessaoId)];
  if (d.produto?.slug && d.produto.titulo) {
    const caminho = `/loja/produto/${d.produto.slug}`;
    const link = d.host ? `${d.host}${caminho}` : caminho;
    partes.push(`Estou vendo o ${d.produto.titulo.trim()} (${link}).`);
  }
  const resumo = d.resumo?.trim()
    ? terminarFrase(mascararDados(d.resumo.trim()))
    : d.pergunta?.trim() && !pareceDadoSensivel(d.pergunta)
      ? resumirPergunta(d.pergunta)
      : "";
  if (resumo) partes.push(resumo);
  else if (!d.produto) partes.push("Quero tirar uma dúvida.");
  const unidade = UNIDADES.find(u => u.slug === d.unidade);
  if (unidade) partes.push(`Prefiro a loja de ${unidade.cidade}.`);
  return partes.join(" ");
}

export function linkPassagemWhatsapp(d: DadosPassagem): string {
  return linkWhatsapp(montarMensagemWhatsapp(d));
}
