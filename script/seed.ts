/**
 * Popula a Óticas Sanrê: configurações, categorias (sol, grau, infantil, EPI),
 * catálogo-semente de óculos, variantes, imagens, estoque por loja, relações,
 * cupom e frete.
 *
 * O catálogo vem de `script/catalogo-oculos.json`, gerado por
 * `script/marca/preparar_catalogo.py` a partir da pesquisa de produtos reais
 * das marcas que a loja trabalha (fotos de fabricante + Instagram @oticasanre).
 * É PROVISÓRIO: preços são de referência de mercado e o estoque por loja é
 * demonstrativo até a integração com o SS Ótica.
 *
 * Uso:  npm run seed            (limpa o catálogo e recria)
 *       npm run seed -- --keep  (mantém o que existe)
 *
 * Convenção de variantes: option1 = Tamanho ("58□14"), option2 = Cor.
 */
import "../server/env";

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { sql } from "drizzle-orm";
import { db } from "../server/storage";
import {
  categories, products, productImages, productAttributes, variants, productUnitStock,
  storeSettings, coupons, shippingZones, shippingRates, productRelations,
} from "@shared/schema";
import { TIPOS } from "@shared/oculos";

const KEEP = process.argv.includes("--keep");

interface ItemCatalogo {
  slug: string;
  marca: string;
  codigo: string | null;
  nome: string;
  tipo: "sol" | "grau" | "epi";
  categoria: "oculos-de-sol" | "oculos-de-grau" | "infantil" | "epi";
  publico: string | null;
  formato: string | null;
  material: string | null;
  cor_armacao: string | null;
  cor_armacao_hex: string | null;
  lente: { cor?: string | null; polarizada?: boolean; espelhada?: boolean; degrade?: boolean; fotossensivel?: boolean; protecao_uv?: string | null } | null;
  medidas: { lente_mm?: number | null; ponte_mm?: number | null; haste_mm?: number | null; altura_mm?: number | null } | null;
  preco_brl: number;
  descricao: string;
  ca: string | null;
  normas: string | null;
  aceita_grau: boolean;
  destaque?: boolean;
  imagens: string[]; // já na ordem de exibição, em /uploads/produtos
  tryon: string | null; // PNG frontal transparente
}

const ARQUIVO_CATALOGO = resolve(process.cwd(), "script/catalogo-oculos.json");
const CATALOGO: ItemCatalogo[] = existsSync(ARQUIVO_CATALOGO)
  ? JSON.parse(readFileSync(ARQUIVO_CATALOGO, "utf-8"))
  : [];

/** Número determinístico a partir de um texto (estoque demonstrativo estável entre seeds). */
function hash(txt: string): number {
  let h = 2166136261;
  for (const ch of txt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Medida em mm inteiro (as fontes trazem 40,9 mm; a coluna é INTEGER). */
const mm = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

function sku(item: ItemCatalogo, seq: number) {
  const marca = item.marca.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return `SR-${marca}-${String(seq).padStart(3, "0")}`;
}

async function limparCatalogo() {
  console.log("Limpando catálogo anterior…");
  await db.execute(sql`TRUNCATE TABLE
    product_relations, product_images, product_attributes, variants, product_unit_stock, products, categories
    RESTART IDENTITY CASCADE`);
}

async function seedConfiguracoes() {
  const dados = {
    storeName: "Óticas Sanrê",
    storeDescription:
      "Ótica em Cravinhos desde 2004 e em Ribeirão Preto na PB Arts Gallery. Óculos de sol, de grau, infantis e EPI, com provador virtual e lentes de grau com receita.",
    logoUrl: "/brand/logo-sanre.svg",
    faviconUrl: "/favicon.svg",
    primaryColor: "#141414",
    secondaryColor: "#434343",
    accentColor: "#b8975a",
    contactEmail: "atendimento@oticasanre.com.br",
    contactPhone: "(16) 99195-1430",
    contactWhatsapp: "5516991951430",
    address: "Rua XV de Novembro, 662A — Centro, Cravinhos/SP · Rua Altino Arantes, 811 — Ribeirão Preto/SP",
    cnpj: "07.151.777/0001-04",
    freeShippingAbove: "499.00",
    maxInstallments: 10,
    freeInstallments: 10,
    reviewsEnabled: true,
    reviewsRequireModeration: true,
    pickupEnabled: true,
  };
  const existente = await db.select({ id: storeSettings.id }).from(storeSettings).limit(1);
  if (existente.length) await db.update(storeSettings).set(dados).where(sql`${storeSettings.id} = ${existente[0].id}`);
  else await db.insert(storeSettings).values(dados);
  console.log("✓ Configurações da loja");
}

async function seedCategorias() {
  const mapa = new Map<string, number>();
  for (let i = 0; i < TIPOS.length; i++) {
    const t = TIPOS[i];
    const existe = await db.select({ id: categories.id }).from(categories).where(sql`${categories.slug} = ${t.slug}`);
    if (existe.length) {
      mapa.set(t.slug, existe[0].id);
      continue;
    }
    const [row] = await db.insert(categories).values({
      name: t.titulo, slug: t.slug, description: t.resumo, sortOrder: i + 1, active: true,
    }).returning({ id: categories.id });
    mapa.set(t.slug, row.id);
  }
  console.log(`✓ ${TIPOS.length} categorias`);
  return mapa;
}

async function seedProdutos(catIds: Map<string, number>) {
  const porCategoria = new Map<string, number[]>();
  const porMarca = new Map<string, number[]>();

  for (let i = 0; i < CATALOGO.length; i++) {
    const item = CATALOGO[i];
    const categoryId = catIds.get(item.categoria);
    if (!categoryId) throw new Error(`Categoria desconhecida: ${item.categoria} (${item.slug})`);
    const existe = await db.select({ id: products.id }).from(products).where(sql`${products.slug} = ${item.slug}`);
    if (existe.length) continue;

    const h = hash(item.slug);
    // Estoque demonstrativo por loja (0 a 3), com a maioria dos itens em pelo menos uma loja.
    const craw = h % 4;
    const rib = (h >> 3) % 4;
    const ecommerce = item.categoria === "epi" ? 20 : 2 + ((h >> 6) % 4);
    const total = ecommerce;
    const titulo = `${item.marca} ${item.nome}`.replace(/\s+/g, " ").trim();
    const tamanho = item.medidas?.lente_mm && item.medidas?.ponte_mm ? `${mm(item.medidas.lente_mm)}□${mm(item.medidas.ponte_mm)}` : "Único";

    const [prod] = await db.insert(products).values({
      categoryId,
      title: titulo,
      slug: item.slug,
      description: item.descricao,
      vendor: item.marca,
      brand: item.marca,
      type: item.categoria,
      tags: [item.tipo, item.formato, item.material, item.publico].filter(Boolean).join(", "),
      sku: sku(item, i + 1),
      price: item.preco_brl.toFixed(2),
      weightG: item.categoria === "epi" ? 80 : 180,
      requiresShipping: true,
      trackInventory: true,
      stockQuantity: total,
      status: "active",
      published: true,
      featured: !!item.destaque,
      freeShipping: item.preco_brl >= 499,
      seoTitle: `${titulo}${item.cor_armacao ? ` ${item.cor_armacao}` : ""} | Óticas Sanrê`,
      seoDescription: item.descricao.slice(0, 155),
      modelCode: item.codigo,
      frameShape: item.formato,
      frameMaterial: item.material,
      audience: item.publico,
      frameColor: item.cor_armacao,
      frameColorHex: item.cor_armacao_hex,
      lensColor: item.lente?.cor ?? null,
      lensPolarized: !!item.lente?.polarizada,
      lensMirrored: !!item.lente?.espelhada,
      lensGradient: !!item.lente?.degrade,
      lensPhotochromic: !!item.lente?.fotossensivel,
      uvProtection: item.lente?.protecao_uv ?? null,
      acceptsRx: item.aceita_grau,
      lensWidthMm: mm(item.medidas?.lente_mm),
      bridgeMm: mm(item.medidas?.ponte_mm),
      templeMm: mm(item.medidas?.haste_mm),
      lensHeightMm: mm(item.medidas?.altura_mm),
      caNumber: item.ca,
      safetyNorms: item.normas,
      tryonImageUrl: item.tryon,
    }).returning({ id: products.id });

    porCategoria.set(item.categoria, [...(porCategoria.get(item.categoria) ?? []), prod.id]);
    porMarca.set(item.marca, [...(porMarca.get(item.marca) ?? []), prod.id]);

    await db.insert(productAttributes).values([
      { productId: prod.id, name: "Tamanho", position: 0 },
      { productId: prod.id, name: "Cor", position: 1 },
    ]);
    if (item.imagens.length) {
      await db.insert(productImages).values(
        item.imagens.map((url, idx) => ({
          productId: prod.id,
          url,
          altText: /-modelo/.test(url)
            ? `${titulo} no rosto`
            : `${titulo}${item.cor_armacao ? ` ${item.cor_armacao}` : ""}${idx === 0 ? "" : ` — foto ${idx + 1}`}`,
          position: idx,
          isMain: idx === 0,
          isTryonSource: false,
        })),
      );
    }
    await db.insert(variants).values({
      productId: prod.id,
      sku: sku(item, i + 1),
      price: item.preco_brl.toFixed(2),
      weightG: item.categoria === "epi" ? 80 : 180,
      stockQuantity: total,
      option1: tamanho,
      option2: item.cor_armacao ?? "Única",
      imageUrl: item.imagens[0] ?? null,
      active: true,
    });
    const saldos = [
      { productId: prod.id, unitSlug: "cravinhos", quantity: craw },
      { productId: prod.id, unitSlug: "ribeirao-preto", quantity: rib },
    ];
    await db.insert(productUnitStock).values(saldos);
  }
  console.log(`✓ ${CATALOGO.length} óculos com imagens, variante e estoque por loja`);
  return { porCategoria, porMarca };
}

/** Relacionados: dois da mesma marca e dois da mesma categoria. */
async function seedRelacionados(porCategoria: Map<string, number[]>, porMarca: Map<string, number[]>) {
  const linhas: { productId: number; relatedProductId: number; sortOrder: number }[] = [];
  const categoriaDe = new Map<number, number[]>();
  porCategoria.forEach(ids => ids.forEach(id => categoriaDe.set(id, ids)));
  porMarca.forEach(ids => {
    ids.forEach((id, i) => {
      const escolhidos = new Set<number>();
      for (let k = 1; k < ids.length && escolhidos.size < 2; k++) escolhidos.add(ids[(i + k) % ids.length]);
      const mesmos = categoriaDe.get(id) ?? [];
      const pos = mesmos.indexOf(id);
      for (let k = 1; k < mesmos.length && escolhidos.size < 4; k++) {
        const cand = mesmos[(pos + k * 3) % mesmos.length];
        if (cand !== id) escolhidos.add(cand);
      }
      Array.from(escolhidos).forEach((rel, ordem) => linhas.push({ productId: id, relatedProductId: rel, sortOrder: ordem }));
    });
  });
  if (linhas.length) await db.insert(productRelations).values(linhas);
  console.log(`✓ ${linhas.length} relações de produto`);
}

async function seedCupomEFrete() {
  const cupomExiste = await db.select({ id: coupons.id }).from(coupons).where(sql`${coupons.code} = 'BEMVINDO10'`).limit(1);
  if (!cupomExiste.length) {
    await db.insert(coupons).values({
      code: "BEMVINDO10", type: "percentage", value: "10.00", minOrderValue: "299.00", maxUses: 500, active: true,
    });
  }
  const zonasExistem = await db.select({ id: shippingZones.id }).from(shippingZones).limit(1);
  if (!zonasExistem.length) {
    const [sp] = await db.insert(shippingZones).values({ name: "São Paulo", states: "SP", active: true }).returning({ id: shippingZones.id });
    const [br] = await db.insert(shippingZones).values({ name: "Demais estados", states: null, active: true }).returning({ id: shippingZones.id });
    await db.insert(shippingRates).values([
      { zoneId: sp.id, name: "Sedex", price: "24.90", estimatedDaysMin: 1, estimatedDaysMax: 3, active: true },
      { zoneId: sp.id, name: "PAC", price: "16.90", estimatedDaysMin: 3, estimatedDaysMax: 7, active: true },
      { zoneId: br.id, name: "Sedex", price: "39.90", estimatedDaysMin: 2, estimatedDaysMax: 5, active: true },
      { zoneId: br.id, name: "PAC", price: "27.90", estimatedDaysMin: 6, estimatedDaysMax: 12, active: true },
    ]);
  }
  console.log("✓ Cupom BEMVINDO10 e zonas de frete");
}

async function main() {
  console.log(`\nSeed Óticas Sanrê — banco: ${process.env.DATABASE_URL?.split("/").pop()?.split("?")[0]}\n`);
  if (!KEEP) await limparCatalogo();
  await seedConfiguracoes();
  const catIds = await seedCategorias();
  if (!CATALOGO.length) console.warn("! script/catalogo-oculos.json ausente: só configurações e categorias.");
  const { porCategoria, porMarca } = await seedProdutos(catIds);
  if (!KEEP) await seedRelacionados(porCategoria, porMarca);
  await seedCupomEFrete();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(products);
  console.log(`\nPronto. ${n} óculos na vitrine.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error("\nFalha no seed:", err);
  process.exit(1);
});
