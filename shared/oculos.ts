/**
 * Vocabulário do catálogo de óculos — os mesmos valores gravados no banco
 * (migration 018) com o rótulo que a cliente lê. Compartilhado entre o site e
 * o servidor (SEO renderizado no servidor, feed, llms.txt).
 */

export interface TipoOculos {
  slug: string; // slug da categoria no banco
  rota: string;
  rotulo: string;
  titulo: string;
  resumo: string;
}

export const TIPOS: TipoOculos[] = [
  {
    slug: "oculos-de-sol",
    rota: "/oculos-de-sol",
    rotulo: "Sol",
    titulo: "Óculos de sol",
    resumo: "Proteção UV em todos, polarizados para quem dirige e pesca, grifes e clássicos.",
  },
  {
    slug: "oculos-de-grau",
    rota: "/oculos-de-grau",
    rotulo: "Grau",
    titulo: "Óculos de grau",
    resumo: "Armações em acetato, metal e titânio. Escolha a armação e envie a receita: a consultora monta as lentes.",
  },
  {
    slug: "infantil",
    rota: "/infantil",
    rotulo: "Infantil",
    titulo: "Óculos infantis",
    resumo: "Armações flexíveis e resistentes para o dia a dia da criança, de sol e de grau.",
  },
  {
    slug: "epi",
    rota: "/epi",
    rotulo: "EPI",
    titulo: "Óculos de segurança (EPI)",
    resumo: "Óculos de proteção com CA, inclusive modelos que recebem lente de grau. Atendimento para empresas.",
  },
];

export function tipoPorSlug(slug: string | null | undefined): TipoOculos | undefined {
  return TIPOS.find(t => t.slug === slug);
}

export const FORMATOS: Record<string, string> = {
  aviador: "Aviador",
  redondo: "Redondo",
  quadrado: "Quadrado",
  retangular: "Retangular",
  gatinho: "Gatinho",
  hexagonal: "Hexagonal",
  oval: "Oval",
  mascara: "Máscara",
  esportivo: "Esportivo",
  browline: "Browline",
  geometrico: "Geométrico",
};

export const MATERIAIS: Record<string, string> = {
  acetato: "Acetato",
  metal: "Metal",
  titanio: "Titânio",
  injetado: "Injetado",
  tr90: "TR-90 (flexível)",
  misto: "Acetato e metal",
  policarbonato: "Policarbonato",
};

export const PUBLICOS: Record<string, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  unissex: "Unissex",
  infantil: "Infantil",
};

export const UNIDADES_ROTULO: Record<string, string> = {
  cravinhos: "Cravinhos",
  "ribeirao-preto": "Ribeirão Preto",
};

export function rotulo(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "";
  return mapa[valor] ?? valor.charAt(0).toUpperCase() + valor.slice(1);
}

/** "Ray-Ban" → "ray-ban"; "Tom Ford" → "tom-ford"; "Óculos" → "oculos". */
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Medida da armação no padrão da haste: 58□14 140. */
export function medidaArmacao(p: { lensWidthMm?: number | null; bridgeMm?: number | null; templeMm?: number | null }): string | null {
  if (!p.lensWidthMm || !p.bridgeMm) return null;
  return `${p.lensWidthMm}□${p.bridgeMm}${p.templeMm ? ` ${p.templeMm}` : ""}`;
}

