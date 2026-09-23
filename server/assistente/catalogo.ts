/**
 * Busca de produtos do roteiro: entende "ray-ban aviador", "oakley polarizado",
 * "óculos de grau feminino até 500" e devolve até 4 cards com preço do banco.
 *
 * O catálogo de uma ótica cabe em memória (centenas de peças): a lista de
 * produtos ativos e publicados é lida pelo `storage` e fica 60 s em cache; o
 * filtro por marca/formato/público/lente roda aqui, sem acento e sem hífen, o
 * que o `search` do banco (um termo só, em título/SKU/marca) não cobre.
 * Preço de produto específico (intenção "preço") é sempre lido na hora.
 */
import type { Category, Product } from "@shared/schema";
import type { ProdutoCard } from "@shared/assistente-protocolo";
import { storage } from "../storage";
import { chave, normalizar } from "./normalizar";

// ─── Vocabulário ─────────────────────────────────────────────────────────────

/** Marcas que a loja trabalha (PLANO.md). `apelidos` já normalizados. */
export const MARCAS: { nome: string; apelidos: string[] }[] = [
  { nome: "Ray-Ban", apelidos: ["ray-ban", "rayban", "ray ban", "ray-bam", "rayban"] },
  { nome: "Oakley", apelidos: ["oakley", "oakly", "okley"] },
  { nome: "Prada", apelidos: ["prada"] },
  { nome: "Gucci", apelidos: ["gucci", "guci"] },
  { nome: "Valentino", apelidos: ["valentino"] },
  { nome: "Tom Ford", apelidos: ["tom ford", "tomford"] },
  { nome: "Carrera", apelidos: ["carrera"] },
  { nome: "Michael Kors", apelidos: ["michael kors", "michael kor", "kors"] },
  { nome: "Ferragamo", apelidos: ["ferragamo", "salvatore ferragamo"] },
  { nome: "Lacoste", apelidos: ["lacoste"] },
  { nome: "Calvin Klein", apelidos: ["calvin klein", "calvin"] },
  { nome: "Guess", apelidos: ["guess"] },
  { nome: "Ana Hickmann", apelidos: ["ana hickmann", "ana hickman", "hickmann"] },
  { nome: "HB", apelidos: ["hb"] },
  { nome: "Just Cavalli", apelidos: ["just cavalli", "cavalli"] },
  { nome: "Speedo", apelidos: ["speedo"] },
  { nome: "Nanovista", apelidos: ["nanovista", "nano vista"] },
];

/** Formatos do schema (products.frame_shape) e como a cliente escreve. */
const FORMATOS: { valor: string; termos: string[]; plural: string }[] = [
  { valor: "aviador", termos: ["aviador", "aviadores", "aviator", "piloto"], plural: "aviador" },
  { valor: "redondo", termos: ["redondo", "redonda", "redondos", "redondas", "round"], plural: "redondos" },
  { valor: "quadrado", termos: ["quadrado", "quadrada", "quadrados", "quadradas", "square"], plural: "quadrados" },
  { valor: "retangular", termos: ["retangular", "retangulares"], plural: "retangulares" },
  { valor: "gatinho", termos: ["gatinho", "gatinha", "cat eye", "cat-eye", "cateye"], plural: "gatinho" },
  { valor: "hexagonal", termos: ["hexagonal", "hexagonais", "hexagono"], plural: "hexagonais" },
  { valor: "oval", termos: ["oval", "ovais", "ovalado", "ovalada"], plural: "ovais" },
  { valor: "mascara", termos: ["mascara", "shield"], plural: "máscara" },
  { valor: "esportivo", termos: ["esportivo", "esportiva", "esportivos", "esporte", "corrida", "ciclismo", "bike"], plural: "esportivos" },
  { valor: "browline", termos: ["browline", "clubmaster", "club master"], plural: "browline" },
  { valor: "geometrico", termos: ["geometrico", "geometrica", "geometricos"], plural: "geométricos" },
];

const PUBLICOS: { valor: string; termos: string[]; plural: string }[] = [
  { valor: "feminino", termos: ["feminino", "feminina", "femininos", "femininas", "mulher", "mulheres", "dama"], plural: "femininos" },
  { valor: "masculino", termos: ["masculino", "masculina", "masculinos", "homem", "homens"], plural: "masculinos" },
  { valor: "unissex", termos: ["unissex", "unisex"], plural: "unissex" },
  { valor: "infantil", termos: ["infantil", "infantis", "crianca", "criancas", "kids", "menino", "menina", "filho", "filha"], plural: "infantis" },
];

export type CategoriaSlug = "oculos-de-sol" | "oculos-de-grau" | "infantil" | "epi";

const CATEGORIAS: { slug: CategoriaSlug; padroes: RegExp[]; rotulo: string }[] = [
  { slug: "oculos-de-sol", padroes: [/\bsol\b/, /\bsolar(es)?\b/, /\bescuro/], rotulo: "óculos de sol" },
  {
    slug: "oculos-de-grau",
    padroes: [/\boculos (de|para|pra) grau\b/, /\barmac(ao|oes)\b/, /\breceituario\b/],
    rotulo: "óculos de grau",
  },
  { slug: "epi", padroes: [/\bepi\b/, /\bseguranca do trabalho\b/, /\boculos de (seguranca|protecao)\b/], rotulo: "óculos de segurança (EPI)" },
];

const CORES = [
  "preto", "preta", "dourado", "dourada", "prata", "tartaruga", "havana", "marrom", "azul", "verde",
  "rosa", "vermelho", "vermelha", "branco", "branca", "transparente", "cristal", "nude", "cinza",
  "grafite", "vinho", "bege", "lilas", "amarelo",
];

/** Palavras que não dizem nada sobre o produto. */
const VAZIAS = new Set(
  (
    "a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro com sem que qual quais " +
    "quero queria gostaria procuro procurando busco buscando ver mostrar mostra mostre tem tens temos " +
    "voces voce vcs vc me pode poderia algum alguma alguns algumas modelo modelos oculos oculo " +
    "armacao armacoes lente lentes opcao opcoes tipo tipos estilo linha ate abaixo acima menos mais " +
    "maximo minimo r$ reais real mil preco valor barato barata baratos caro cara bonito bonita lindo " +
    "linda favor por ola oi bom boa dia tarde noite obrigada obrigado site loja sanre vendem vende " +
    "trabalham trabalha marca marcas novo nova novos novas polarizado polarizada polarizados polarizadas " +
    "espelhado espelhada degrade grau sol solar solares infantil feminino feminina masculino masculina " +
    "unissex esse essa este esta isso aquele aquela mesmo tambem so apenas uso usar dia-a-dia " +
    "meu minha meus minhas seu sua seus suas nosso nossa ele ela eles elas aqui ali tudo todo toda " +
    "todos todas muito muita pouco bem ainda agora hoje preciso precisa precisando gostei gosto " +
    "adorei algo coisa coisas legal tipo existe existem disponivel disponiveis estoque sim nao " +
    "seguranca protecao epi receituario escuro escuros trabalho achei achar encontrei encontrar acho vi " +
    "procurei duvida duvidas sobre saber"
  ).split(/\s+/),
);

// ─── Interpretação da frase ──────────────────────────────────────────────────

export interface FiltrosBusca {
  marca?: string;
  formato?: string;
  publico?: string;
  categoria?: CategoriaSlug;
  polarizado?: boolean;
  espelhado?: boolean;
  degrade?: boolean;
  cor?: string;
  precoMax?: number;
  precoMin?: number;
  /** Palavras que sobraram (modelo: "wayfarer", "rb3025", "holbrook"). */
  termos: string[];
}

function contemTermo(t: string, termo: string): boolean {
  const esc = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[- ]/g, "[- ]?");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(t);
}

/** "1.500" → 1500 · "500" → 500 · "1,5 mil" → 1500 · "2 mil" → 2000 */
function lerValor(num: string, mil?: string): number {
  let n: number;
  if (mil) n = Number(num.replace(",", ".")) * 1000;
  else n = Number(num.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

const VALOR = String.raw`(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil\b)?`;

export function interpretarBusca(textoNormalizado: string): FiltrosBusca {
  const t = textoNormalizado;
  const f: FiltrosBusca = { termos: [] };

  for (const m of MARCAS) if (m.apelidos.some(a => contemTermo(t, a))) { f.marca = m.nome; break; }
  for (const fm of FORMATOS) if (fm.termos.some(a => contemTermo(t, a))) { f.formato = fm.valor; break; }
  for (const p of PUBLICOS) if (p.termos.some(a => contemTermo(t, a))) { f.publico = p.valor; break; }
  for (const c of CATEGORIAS) if (c.padroes.some(r => r.test(t))) { f.categoria = c.slug; break; }
  if (!f.categoria && f.publico === "infantil") f.categoria = "infantil";

  if (/\bpolariza/.test(t)) f.polarizado = true;
  if (/\bespelhad/.test(t)) f.espelhado = true;
  if (/\bdegrade\b/.test(t)) f.degrade = true;
  const cor = CORES.find(c => contemTermo(t, c));
  const MASCULINO: Record<string, string> = { preta: "preto", dourada: "dourado", branca: "branco", vermelha: "vermelho" };
  if (cor) f.cor = MASCULINO[cor] ?? cor;

  const entre = new RegExp(String.raw`\bentre\s+${VALOR}\s+e\s+${VALOR}`).exec(t);
  if (entre) {
    f.precoMin = lerValor(entre[1], entre[2]);
    f.precoMax = lerValor(entre[3], entre[4]);
  } else {
    const max = new RegExp(String.raw`\b(?:ate|abaixo de|menos de|no maximo|maximo|max|por ate|nao passe de)\s+${VALOR}`).exec(t);
    if (max) f.precoMax = lerValor(max[1], max[2]);
    const min = new RegExp(String.raw`\b(?:acima de|mais de|a partir de|no minimo|minimo)\s+${VALOR}`).exec(t);
    if (min) f.precoMin = lerValor(min[1], min[2]);
  }
  if (f.precoMax !== undefined && !Number.isFinite(f.precoMax)) delete f.precoMax;
  if (f.precoMin !== undefined && !Number.isFinite(f.precoMin)) delete f.precoMin;

  // O que sobra depois de tirar marca, formato, público, preço e palavras vazias.
  let resto = t.replace(new RegExp(String.raw`(?:r\$\s*)?\d[\d.,]*\s*(?:mil\b)?`, "g"), " ");
  const reconhecidos = [
    ...(f.marca ? MARCAS.find(m => m.nome === f.marca)!.apelidos : []),
    ...(f.formato ? FORMATOS.find(x => x.valor === f.formato)!.termos : []),
    ...(f.publico ? PUBLICOS.find(x => x.valor === f.publico)!.termos : []),
    ...(cor ? [cor] : []),
  ];
  for (const r of reconhecidos) resto = resto.split(r).join(" ");
  f.termos = resto
    .split(/[\s,.;:!?]+/)
    .map(w => w.replace(/^-+|-+$/g, ""))
    .filter(w => w.length >= 3 && !VAZIAS.has(w) && !/^\d+$/.test(w))
    .slice(0, 4);
  return f;
}

export function temFiltroDeProduto(f: FiltrosBusca): boolean {
  return Boolean(
    f.marca || f.formato || f.categoria || f.polarizado || f.espelhado || f.degrade ||
      f.precoMax !== undefined || f.precoMin !== undefined || (f.publico && f.publico !== "unissex"),
  );
}

function valorBR(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** "óculos de sol Ray-Ban aviador polarizados até R$ 500" */
export function descreverBusca(f: FiltrosBusca): string {
  const partes: string[] = [];
  partes.push(f.categoria ? CATEGORIAS.find(c => c.slug === f.categoria)?.rotulo ?? "óculos" : "óculos");
  if (f.categoria === "infantil") partes[0] = "óculos infantis";
  if (f.marca) partes.push(f.marca);
  if (f.formato) partes.push(FORMATOS.find(x => x.valor === f.formato)!.plural);
  if (f.publico && f.categoria !== "infantil") partes.push(PUBLICOS.find(x => x.valor === f.publico)!.plural);
  if (f.polarizado) partes.push("polarizados");
  if (f.espelhado) partes.push("espelhados");
  if (f.degrade) partes.push("com lente degradê");
  if (f.cor) partes.push(`na cor ${f.cor}`);
  if (f.termos.length) partes.push(`"${f.termos.join(" ")}"`);
  if (f.precoMin !== undefined && f.precoMax !== undefined) partes.push(`entre ${valorBR(f.precoMin)} e ${valorBR(f.precoMax)}`);
  else if (f.precoMax !== undefined) partes.push(`até ${valorBR(f.precoMax)}`);
  else if (f.precoMin !== undefined) partes.push(`acima de ${valorBR(f.precoMin)}`);
  return partes.join(" ");
}

/**
 * Página da vitrine com os mesmos filtros — a URL da loja é a fonte da verdade
 * dos filtros (client/src/pages/store/StorePage.tsx: tipo, marca, formato,
 * publico, lente, min, max, busca).
 */
export function linkVerTodos(f: FiltrosBusca): string {
  const p = new URLSearchParams();
  if (f.categoria) p.set("tipo", f.categoria);
  if (f.marca) p.set("marca", f.marca);
  if (f.formato) p.set("formato", f.formato);
  if (f.publico && f.publico !== "unissex" && f.categoria !== "infantil") p.set("publico", f.publico);
  const lente = [f.polarizado && "polarizado", f.espelhado && "espelhado", f.degrade && "degrade"].filter(Boolean);
  if (lente.length) p.set("lente", lente.join(","));
  if (f.precoMin !== undefined) p.set("min", String(f.precoMin));
  if (f.precoMax !== undefined) p.set("max", String(f.precoMax));
  if (f.termos.length) p.set("busca", f.termos.join(" "));
  const qs = p.toString();
  return qs ? `/loja?${qs}` : "/loja";
}

// ─── Catálogo em cache ───────────────────────────────────────────────────────

interface Cache {
  em: number;
  produtos: Product[];
  categorias: Map<number, string>; // id → slug
}

const CACHE_MS = 60_000;
const MAX_CATALOGO = 2000;
let cache: Cache | null = null;
let carregando: Promise<Cache> | null = null;

async function catalogo(): Promise<Cache> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache;
  if (!carregando) {
    carregando = (async () => {
      const [{ products }, cats] = await Promise.all([
        storage.listProducts({ status: "active", published: true, limit: MAX_CATALOGO }),
        storage.listCategories(false),
      ]);
      const categorias = new Map<number, string>(cats.map((c: Category) => [c.id, c.slug]));
      cache = { em: Date.now(), produtos: products, categorias };
      return cache;
    })().finally(() => {
      carregando = null;
    });
  }
  return carregando;
}

function texto(p: Product): string {
  return normalizar(
    [p.title, p.brand, p.modelCode, p.frameShape, p.frameColor, p.lensColor, p.frameMaterial, p.tags, p.type]
      .filter(Boolean)
      .join(" "),
  );
}

function passa(p: Product, f: FiltrosBusca, cats: Map<number, string>, usar: Set<keyof FiltrosBusca>): boolean {
  const hay = texto(p);
  const preco = Number(p.price);
  if (usar.has("marca") && f.marca) {
    const k = chave(f.marca);
    if (chave(p.brand) !== k && !chave(p.title).includes(k)) return false;
  }
  if (usar.has("categoria") && f.categoria) {
    const slug = p.categoryId ? cats.get(p.categoryId) : undefined;
    const infantil = f.categoria === "infantil" && p.audience === "infantil";
    if (slug !== f.categoria && !infantil) return false;
  }
  if (usar.has("precoMax") && f.precoMax !== undefined && !(preco <= f.precoMax)) return false;
  if (usar.has("precoMin") && f.precoMin !== undefined && !(preco >= f.precoMin)) return false;
  if (usar.has("formato") && f.formato) {
    const termos = FORMATOS.find(x => x.valor === f.formato)!.termos;
    if (p.frameShape !== f.formato && !termos.some(t => contemTermo(hay, t))) return false;
  }
  if (usar.has("publico") && f.publico && f.publico !== "unissex") {
    if (p.audience && p.audience !== f.publico && p.audience !== "unissex") return false;
  }
  if (usar.has("polarizado") && f.polarizado && !p.lensPolarized) return false;
  if (usar.has("espelhado") && f.espelhado && !p.lensMirrored) return false;
  if (usar.has("degrade") && f.degrade && !p.lensGradient) return false;
  if (usar.has("cor") && f.cor && !hay.includes(f.cor.slice(0, -1))) return false;
  if (usar.has("termos") && f.termos.length) {
    const hayChave = chave(hay);
    if (!f.termos.every(t => hayChave.includes(chave(t)))) return false;
  }
  return true;
}

export interface ResultadoBusca {
  itens: ProdutoCard[];
  /** true quando algum filtro precisou ser afrouxado para achar algo. */
  aproximado: boolean;
  total: number;
}

/** Ordem de afrouxamento: o que a cliente pediu por último é o que menos pesa. */
const AFROUXAR: (keyof FiltrosBusca)[] = ["termos", "cor", "degrade", "espelhado", "publico", "formato", "polarizado"];
const TODOS: (keyof FiltrosBusca)[] = [
  "marca", "categoria", "precoMax", "precoMin", "formato", "publico", "polarizado", "espelhado", "degrade", "cor", "termos",
];

export async function buscarProdutos(f: FiltrosBusca, limite = 4, afrouxar = true): Promise<ResultadoBusca> {
  const { produtos, categorias } = await catalogo();
  const usar = new Set(TODOS);
  let achados = produtos.filter(p => passa(p, f, categorias, usar));
  let aproximado = false;
  for (const campo of afrouxar ? AFROUXAR : []) {
    if (achados.length) break;
    const tinha = campo === "termos" ? f.termos.length > 0 : f[campo] !== undefined;
    if (!tinha) continue;
    usar.delete(campo);
    achados = produtos.filter(p => passa(p, f, categorias, usar));
    aproximado = achados.length > 0;
  }

  // Público exato antes do unissex; destaque antes do resto; mais novo primeiro.
  achados.sort((a, b) => {
    const pa = f.publico && a.audience === f.publico ? 1 : 0;
    const pb = f.publico && b.audience === f.publico ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.id - a.id;
  });

  const escolhidos = achados.slice(0, limite);
  return { itens: await paraCards(escolhidos), aproximado, total: achados.length };
}

async function paraCards(lista: Product[]): Promise<ProdutoCard[]> {
  if (!lista.length) return [];
  const imagens = await storage.getImagesForProducts(lista.map(p => p.id));
  return lista.map(p => {
    const imgs = imagens.get(p.id) ?? [];
    const principal = imgs.find(i => i.isMain)?.url ?? imgs[0]?.url ?? null;
    return {
      slug: p.slug,
      titulo: p.title,
      marca: p.brand ?? null,
      preco: Number(p.price),
      imagem: principal,
    };
  });
}

/** Slug da categoria do produto (oculos-de-sol, oculos-de-grau, infantil, epi). */
export async function categoriaDoProduto(p: Product): Promise<string | undefined> {
  if (!p.categoryId) return undefined;
  const { categorias } = await catalogo();
  return categorias.get(p.categoryId);
}

/** Produto do contexto, lido na hora (preço com fonte). Só ativo e publicado. */
export async function produtoPorSlug(slug: string): Promise<Product | null> {
  const p = await storage.getProductBySlug(slug);
  if (!p || p.status !== "active" || !p.published) return null;
  return p;
}
