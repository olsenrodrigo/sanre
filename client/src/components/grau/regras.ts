/**
 * Regras e opções dos formulários de lead (orçamento de grau, reserva, empresas).
 *
 * Telefone e limites de arquivo espelham server/leads/regras.ts e
 * server/leads/receitas.ts — o servidor é quem decide; aqui é só para a
 * cliente saber do erro antes de enviar.
 */
import { UNIDADES, type UnidadeSlug } from "@shared/unidades";

// ─── Como vai usar (preferência declarada — não é indicação de lente) ─────────
export const USOS = [
  { valor: "longe", titulo: "Longe", nota: "Dirigir, ver TV, placas, o rosto das pessoas." },
  { valor: "perto", titulo: "Perto", nota: "Ler, celular, costura, trabalhos manuais." },
  { valor: "longe_e_perto", titulo: "Longe e perto", nota: "Preciso das duas distâncias no mesmo óculos." },
  { valor: "computador", titulo: "Computador", nota: "Tela e mesa de trabalho, a meia distância." },
  { valor: "nao_sei", titulo: "Não sei", nota: "Sem problema: a consultora te orienta a partir da receita." },
] as const;
export type Uso = (typeof USOS)[number]["valor"];

// ─── Tratamentos: uma linha neutra cada, sem recomendar ──────────────────────
export const TRATAMENTOS = [
  { valor: "antirreflexo", titulo: "Antirreflexo", nota: "Diminui os reflexos na superfície da lente — de luzes, faróis e telas." },
  { valor: "filtro_luz_azul", titulo: "Filtro de luz azul", nota: "Filtra parte da luz azul-violeta emitida por telas e lâmpadas de LED." },
  { valor: "fotossensivel", titulo: "Fotossensível", nota: "Escurece ao sol e volta a clarear em ambiente fechado." },
  { valor: "polarizado", titulo: "Polarizado", nota: "Corta o brilho refletido em água, asfalto e vidro; é usado em óculos de sol com grau." },
] as const;
export type Tratamento = (typeof TRATAMENTOS)[number]["valor"] | "nenhum";

// ─── Reserva ──────────────────────────────────────────────────────────────────
export const QUANDO = [
  { valor: "hoje", titulo: "Hoje" },
  { valor: "amanha", titulo: "Amanhã" },
  { valor: "esta_semana", titulo: "Nesta semana" },
  { valor: "combinar", titulo: "A combinar" },
] as const;
export type Quando = (typeof QUANDO)[number]["valor"];

export const PERIODOS = [
  { valor: "", titulo: "Qualquer horário" },
  { valor: "manha", titulo: "Manhã" },
  { valor: "tarde", titulo: "Tarde" },
  { valor: "noite", titulo: "Fim do dia" },
] as const;
export type Periodo = Exclude<(typeof PERIODOS)[number]["valor"], "">;

// ─── Empresas ─────────────────────────────────────────────────────────────────
export const SEGMENTOS = [
  { valor: "industria", titulo: "Indústria" },
  { valor: "usinas_agronegocio", titulo: "Usina ou agronegócio" },
  { valor: "construcao", titulo: "Construção" },
  { valor: "laboratorio", titulo: "Laboratório" },
  { valor: "outro", titulo: "Outro" },
] as const;
export type Segmento = (typeof SEGMENTOS)[number]["valor"];

export const SLUGS_UNIDADE = UNIDADES.map(u => u.slug) as [UnidadeSlug, ...UnidadeSlug[]];

// ─── Telefone ─────────────────────────────────────────────────────────────────
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

function digitosNacionais(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function telefoneValido(v: string): boolean {
  const d = digitosNacionais(v);
  if (d.length !== 10 && d.length !== 11) return false;
  if (!DDDS.has(Number(d.slice(0, 2)))) return false;
  if (d.length === 11) return d[2] === "9";
  return "2345".includes(d[2]);
}

/** Máscara progressiva: (16) 99195-1430. */
export function mascararTelefone(v: string): string {
  const d = digitosNacionais(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara progressiva: 07.151.777/0001-04. */
export function mascararCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cnpjValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => {
    const r = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

// ─── Receita ──────────────────────────────────────────────────────────────────
export const MAX_BYTES_RECEITA = 8 * 1024 * 1024;
export const EXTENSOES_RECEITA = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];
export const ACCEPT_RECEITA = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,application/pdf";

export function extensaoReceitaAceita(nome: string): boolean {
  const i = nome.lastIndexOf(".");
  return i >= 0 && EXTENSOES_RECEITA.includes(nome.slice(i).toLowerCase());
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
