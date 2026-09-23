/**
 * sitemap.xml, robots.txt, llms.txt e feed de catálogo — a parte do SEO/GEO
 * que não é página. As URLs usam a origem do request (ou PUBLIC_URL), para a
 * mesma build servir localhost, IP de homologação e o domínio final.
 */
import type { Express } from "express";
import { storage } from "../storage";
import { origemDoRequest } from "./ssr";
import { UNIDADES, enderecoCompleto } from "@shared/unidades";
import { TIPOS, FORMATOS, MATERIAIS, rotulo, slugificar, medidaArmacao } from "@shared/oculos";
import { GUIAS } from "@shared/conteudo/guias";

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const PAGINAS_FIXAS = [
  "/", "/loja", ...TIPOS.map(t => t.rota), "/marcas", "/provador", "/lentes-de-grau", "/empresas",
  "/formato-do-rosto", "/tamanho-do-oculos", "/guia", "/unidades", "/sobre", "/contato",
  "/trocas-e-devolucoes", "/privacidade",
];

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", async (req, res) => {
    const origem = origemDoRequest(req);
    const [{ products }, marcas] = await Promise.all([
      storage.listProducts({ status: "active", published: true, limit: 5000, offset: 0 }),
      storage.listBrands(),
    ]);
    const url = (caminho: string, lastmod?: Date | null) =>
      `  <url>\n    <loc>${escXml(origem + caminho)}</loc>` +
      (lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : "") +
      `\n  </url>`;
    const corpo = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...PAGINAS_FIXAS.map(c => url(c)),
      ...UNIDADES.map(u => url(`/unidades/${u.slug}`)),
      ...GUIAS.map(g => url(`/guia/${g.slug}`)),
      ...marcas.map(m => url(`/marcas/${slugificar(m.marca)}`)),
      ...products.map(p => url(`/loja/produto/${p.slug}`, p.updatedAt)),
      "</urlset>",
    ].join("\n");
    res.type("application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(corpo);
  });

  // Decisão consciente: rastreadores de IA liberados — a Sanrê quer ser citada.
  app.get("/robots.txt", (req, res) => {
    const origem = origemDoRequest(req);
    res.type("text/plain");
    res.set("Cache-Control", "public, max-age=3600");
    const privadas = ["/admin", "/api/", "/loja/carrinho", "/loja/checkout", "/loja/pedido/"];
    const bloco = (ua: string) => [`User-agent: ${ua}`, ...privadas.map(p => `Disallow: ${p}`), "Allow: /", ""];
    return res.send(
      [
        ...bloco("*"),
        ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"].flatMap(bloco),
        `Sitemap: ${origem}/sitemap.xml`,
        "",
      ].join("\n"),
    );
  });

  app.get("/llms.txt", async (req, res) => {
    const origem = origemDoRequest(req);
    const marcas = await storage.listBrands();
    res.type("text/plain; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(
      [
        "# Óticas Sanrê",
        "",
        "> Ótica com duas lojas no interior de São Paulo: Cravinhos (desde 17/12/2004) e Ribeirão Preto (desde 23/07/2026, anexa à PB Arts Gallery).",
        "> Vende óculos de sol, armações e óculos de grau, óculos infantis, lentes de contato e óculos de segurança (EPI), inclusive EPI com lente de grau para empresas.",
        "> Todos os produtos são originais, com nota fiscal. Loja virtual com retirada grátis nas duas lojas, PIX com 5% de desconto e até 10x sem juros.",
        "",
        "## Lojas",
        "",
        ...UNIDADES.map(u => `- Sanrê ${u.cidade}: ${enderecoCompleto(u)}${u.complemento ? ` (${u.complemento})` : ""} — ${origem}/unidades/${u.slug}`),
        "- WhatsApp: +55 16 99195-1430 · E-mail: atendimento@oticasanre.com.br · Instagram: @oticasanre",
        "- Razão social: Optica Sanre Ltda · CNPJ 07.151.777/0001-04",
        "",
        "## Diferenciais",
        "",
        `- Provador virtual de óculos pela câmera, processado no aparelho do cliente: ${origem}/provador`,
        `- Óculos de grau pelo site: o cliente escolhe a armação, envia a receita e recebe o orçamento das lentes pelo WhatsApp; lentes Varilux e Zeiss: ${origem}/lentes-de-grau`,
        `- Guia de armação por formato de rosto: ${origem}/formato-do-rosto`,
        `- Atendimento a empresas (EPI com CA e EPI com grau): ${origem}/empresas`,
        "",
        "## Catálogo",
        "",
        ...TIPOS.map(t => `- [${t.titulo}](${origem}${t.rota}): ${t.resumo}`),
        `- Marcas: ${marcas.map(m => m.marca).join(", ")} — ${origem}/marcas`,
        `- Feed estruturado (JSON): ${origem}/feed/catalogo.json`,
        "",
        "## Guias",
        "",
        ...GUIAS.map(g => `- [${g.titulo}](${origem}/guia/${g.slug}): ${g.resposta}`),
        "",
      ].join("\n"),
    );
  });

  app.get("/feed/catalogo.json", async (req, res) => {
    const origem = origemDoRequest(req);
    const { products } = await storage.listProducts({ status: "active", published: true, limit: 5000, offset: 0 });
    const ids = products.map(p => p.id);
    const [imagens, estoque, cats] = await Promise.all([
      storage.getImagesForProducts(ids),
      storage.getUnitStockForProducts(ids),
      storage.listCategories(true),
    ]);
    res.set("Cache-Control", "public, max-age=1800");
    return res.json({
      loja: "Óticas Sanrê",
      lojas: UNIDADES.map(u => ({ cidade: u.cidade, endereco: enderecoCompleto(u), url: `${origem}/unidades/${u.slug}` })),
      atualizadoEm: new Date().toISOString(),
      oculos: products.map(p => {
        const imgs = imagens.get(p.id) ?? [];
        const saldo = estoque.get(p.id) ?? {};
        return {
          nome: p.title,
          marca: p.brand,
          modelo: p.modelCode,
          tipo: cats.find(c => c.id === p.categoryId)?.name ?? null,
          formato: p.frameShape ? rotulo(FORMATOS, p.frameShape) : null,
          material: p.frameMaterial ? rotulo(MATERIAIS, p.frameMaterial) : null,
          corArmacao: p.frameColor,
          lente: p.lensColor,
          polarizada: p.lensPolarized,
          medidas: medidaArmacao(p),
          aceitaGrau: p.acceptsRx,
          ca: p.caNumber,
          preco: Number(p.price),
          moeda: "BRL",
          disponivel: p.stockQuantity > 0 || p.continueSellingOutOfStock,
          retiradaEm: UNIDADES.filter(u => (saldo[u.slug] ?? 0) > 0).map(u => u.cidade),
          imagem: imgs[0] ? origem + imgs[0].url : null,
          url: `${origem}/loja/produto/${p.slug}`,
        };
      }),
    });
  });
}
