// Regras de negócio dos leads do site — sem I/O, testáveis isoladamente.
//
// Espelho no cliente: client/src/components/grau/regras.ts (telefone e versões
// de consentimento). Mudou aqui, muda lá — o ideal é migrar os dois para
// shared/ quando o dono de shared/ puder.

import { randomInt } from "node:crypto";

export const TIPOS_LEAD = ["orcamento_grau", "reserva", "empresa"] as const;
export type TipoLead = (typeof TIPOS_LEAD)[number];

export const STATUS_LEAD = ["novo", "em_atendimento", "orcamento_enviado", "convertido", "descartado"] as const;
export type StatusLead = (typeof STATUS_LEAD)[number];

/**
 * Versões de consentimento aceitas. O texto de cada versão está em
 * client/src/components/grau/consentimentos.ts — trocar o texto exige versão
 * nova aqui E lá; a versão gravada no lead é a prova do que a cliente leu.
 */
export const VERSOES_CONSENTIMENTO_CONTATO = ["contato-v1-2026-09"] as const;
export const VERSOES_CONSENTIMENTO_RECEITA = ["receita-v1-2026-09"] as const;

/** Retenção da receita (dado de saúde): expurgo automático depois disso. */
export const RETENCAO_RECEITA_DIAS = 90;

// ─── Protocolo ────────────────────────────────────────────────────────────────
// Alfabeto sem caracteres que se confundem ao ditar ou ler no celular
// (0/O, 1/I/L). 31^6 ≈ 887 milhões de combinações, sorteadas com
// crypto.randomInt (sem viés de módulo): não é sequencial nem enumerável.
const ALFABETO_PROTOCOLO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PADRAO_PROTOCOLO = /^SR-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export function gerarProtocolo(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO_PROTOCOLO[randomInt(ALFABETO_PROTOCOLO.length)];
  return `SR-${s}`;
}

// ─── Telefone (BR) ────────────────────────────────────────────────────────────
// DDDs em uso no Brasil (Anatel). Número com DDD inexistente é quase sempre
// erro de digitação — melhor pedir de novo do que perder o retorno.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza para DDD + número (10 ou 11 dígitos). Aceita máscara, +55 e zero
 * de operadora na frente. Devolve null quando não é um telefone brasileiro válido.
 */
export function normalizarTelefone(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1); // 0 + DDD + fixo
  if (d.length === 12 && d.startsWith("0")) d = d.slice(1); // 0 + DDD + celular
  if (d.length !== 10 && d.length !== 11) return null;
  if (!DDDS.has(Number(d.slice(0, 2)))) return null;
  const primeiro = d[2];
  if (d.length === 11 && primeiro !== "9") return null; // celular começa com 9
  if (d.length === 10 && !"2345".includes(primeiro)) return null; // fixo: 2 a 5
  return d;
}

export function formatarTelefone(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

// ─── CNPJ ─────────────────────────────────────────────────────────────────────
export function normalizarCnpj(entrada: string): string | null {
  const d = entrada.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return null;
  const dv = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`) ? d : null;
}
