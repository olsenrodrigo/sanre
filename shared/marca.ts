/**
 * Constantes da marca Óticas Sanrê.
 * Compartilhado entre site e servidor (assistente, SEO).
 * Fontes: Receita Federal (CNPJ), site atual oticasanre.com.br, Instagram
 * @oticasanre e o manual da marca em insumos/. Unidades em shared/unidades.ts.
 */
import { WHATSAPP_SANRE, linkWhatsapp } from "./unidades";

export const NOME = "Óticas Sanrê";
export const NOME_CURTO = "Sanrê";
export const RAZAO_SOCIAL = "Optica Sanre Ltda";
export const CNPJ = "07.151.777/0001-04";
export const DESDE = 2004;
export const CIDADE = "Cravinhos e Ribeirão Preto — SP";

export const WHATSAPP = WHATSAPP_SANRE;
export const WHATSAPP_LABEL = "(16) 99195-1430";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`;

export const INSTAGRAM_HANDLE = "@oticasanre";
export const INSTAGRAM_URL = "https://www.instagram.com/oticasanre/";
export const FACEBOOK_URL = "https://www.facebook.com/sanreoptica/";

export const EMAIL = "atendimento@oticasanre.com.br";

export const FRETE_GRATIS_ACIMA = 499;
export const PARCELAS_SEM_JUROS = 10;

/**
 * Link do WhatsApp com a mensagem já preenchida.
 * Toda mensagem que sai do site começa com "Vim pelo site" e carrega o
 * contexto (produto, protocolo, unidade) — é o que a assistente usa para
 * continuar a conversa de onde a cliente parou.
 */
export function whatsappCom(mensagem: string): string {
  return linkWhatsapp(mensagem);
}

/** Cores de armação do catálogo — alimenta os swatches da vitrine. */
export const CORES_CATALOGO: Record<string, string> = {
  Preto: "#161616",
  "Preto fosco": "#2b2b2b",
  Tartaruga: "#6b4226",
  Havana: "#7a4b2a",
  Marrom: "#5a3a26",
  Dourado: "#c2a15a",
  "Dourado rosé": "#c79a86",
  Prata: "#b9bcc0",
  Grafite: "#4a4d52",
  Cinza: "#8d8f93",
  Transparente: "#e8e6e1",
  Cristal: "#e8e6e1",
  Nude: "#d6c3ad",
  Branco: "#f4f2ee",
  Azul: "#2d4a73",
  "Azul-marinho": "#1f2c44",
  Verde: "#3c5a45",
  Vermelho: "#9b2a2a",
  Rosa: "#d9a3a8",
  Lilás: "#b5a0cf",
  Vinho: "#5e1f2c",
  Bege: "#cbb89c",
  Amarelo: "#d8b53d",
};

/** Hex de uma cor de armação; neutro se o nome for desconhecido. */
export function corHex(nome: string): string {
  if (CORES_CATALOGO[nome]) return CORES_CATALOGO[nome];
  const base = Object.keys(CORES_CATALOGO).find(c => nome.toLowerCase().startsWith(c.toLowerCase()));
  return base ? CORES_CATALOGO[base] : "#c3c3c3";
}

/** Formata reais no padrão brasileiro. */
export function precoBR(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor da parcela sem juros (exibição). */
export function parcela(valor: string | number, vezes = PARCELAS_SEM_JUROS): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return precoBR(Math.ceil((n / vezes) * 100) / 100);
}
