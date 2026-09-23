/**
 * HTML inicial por rota — SEO e GEO renderizados no servidor.
 *
 * A loja é uma SPA: sem isto, todo endereço devolvia o mesmo `index.html` com
 * `<div id="root">` vazio. O Google executa JavaScript numa segunda passada,
 * mas GPTBot, ClaudeBot, PerplexityBot e OAI-SearchBot não executam — e são
 * eles que respondem "onde comprar Ray-Ban original em Cravinhos".
 *
 * Para cada rota o servidor preenche:
 *  - <head>: title, description, canonical, Open Graph, robots e JSON-LD
 *    (Product/Offer, Optician por unidade, FAQPage, BreadcrumbList, ItemList);
 *  - <div id="root">: um bloco `[data-ssr]` com o mesmo conteúdo em HTML
 *    semântico (h1, preço, ficha, endereço, perguntas). O React substitui esse
 *    bloco ao montar; para quem tem JavaScript ele nem aparece (regra
 *    `.js [data-ssr]` no index.html), então não há "flash" nem conteúdo
 *    diferente entre robô e pessoa.
 *  - status HTTP: 404 de verdade para produto/marca/rota inexistente.
 */
import { storage } from "../storage";
import { UNIDADES, unidadePorSlug, enderecoCompleto, WHATSAPP_SANRE, type Unidade } from "@shared/unidades";
import { TIPOS, FORMATOS, MATERIAIS, PUBLICOS, rotulo, slugificar, medidaArmacao } from "@shared/oculos";
import { GUIAS, guiaPorSlug } from "@shared/conteudo/guias";
import { fichaMarca } from "@shared/conteudo/marcas";
import type { Product } from "@shared/schema";

const NOME = "Óticas Sanrê";
const DESCRICAO_PADRAO =
  "Ótica em Cravinhos desde 2004 e em Ribeirão Preto na PB Arts Gallery. Ray-Ban, Oakley, Prada, Gucci, Tom Ford e mais, com provador virtual, lentes de grau com receita e retirada na loja.";

interface Pagina {
  status: number;
  titulo: string;
  descricao: string;
  caminho: string;
  imagem?: string | null;
  tipoOg?: "website" | "product" | "article";
  noindex?: boolean;
  jsonld?: unknown[];
  corpo: string;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const precoBR = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** JSON seguro dentro de <script>: impede fechar a tag com "</script>". */
const jsonScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

function organizacao(origem: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origem}/#organizacao`,
    name: NOME,
    legalName: "Optica Sanre Ltda",
    taxID: "07.151.777/0001-04",
    foundingDate: "2004-12-17",
    url: `${origem}/`,
    logo: `${origem}/brand/logo-sanre.png`,
    email: "atendimento@oticasanre.com.br",
    telephone: `+${WHATSAPP_SANRE}`,
    sameAs: ["https://www.instagram.com/oticasanre/", "https://www.facebook.com/sanreoptica/"],
    subOrganization: UNIDADES.map(u => ({ "@id": `${origem}/unidades/${u.slug}#otica` })),
  };
}

function otica(u: Unidade, origem: string) {
  const bloco: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Optician",
    "@id": `${origem}/unidades/${u.slug}#otica`,
    name: `Sanrê ${u.cidade}`,
    url: `${origem}/unidades/${u.slug}`,
    image: `${origem}${u.foto}`,
    telephone: `+${u.whatsapp}`,
    priceRange: "R$ 60 – R$ 4.000",
    parentOrganization: { "@id": `${origem}/#organizacao` },
    address: {
      "@type": "PostalAddress",
      streetAddress: u.logradouro + (u.complemento ? ` (${u.complemento})` : ""),
      addressLocality: u.cidade,
      addressRegion: u.uf,
      postalCode: u.cep,
      addressCountry: "BR",
    },
    hasMap: u.mapsUrl,
  };
  // Horário só entra quando a loja confirmou (shared/unidades.ts).
  if (u.horarioConfirmado && u.horario.length) {
    bloco.openingHours = u.horario.map(h => `${h.dias} ${h.abre}-${h.fecha}`);
  }
  return bloco;
}

function trilha(origem: string, itens: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map(([nome, caminho], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: nome,
      item: `${origem}${caminho}`,
    })),
  };
}

function listaProdutosHtml(prods: (Product & { mainImage?: string | null })[]): string {
  if (!prods.length) return "";
  return `<ul>${prods
    .map(
      p =>
        `<li><a href="/loja/produto/${esc(p.slug)}">${esc(p.brand ? `${p.brand} — ` : "")}${esc(
          p.title.replace(new RegExp(`^${(p.brand ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), ""),
        )}</a> · ${esc(precoBR(p.price))}${p.frameShape ? ` · ${esc(rotulo(FORMATOS, p.frameShape))}` : ""}</li>`,
    )
    .join("")}</ul>`;
}

function rodapeHtml(): string {
  return `<footer><h2>Lojas</h2><ul>${UNIDADES.map(
    u => `<li><a href="/unidades/${u.slug}">Sanrê ${esc(u.cidade)}</a>: ${esc(enderecoCompleto(u))}${u.complemento ? ` (${esc(u.complemento)})` : ""}</li>`,
  ).join("")}</ul><p>WhatsApp (16) 99195-1430 · atendimento@oticasanre.com.br · CNPJ 07.151.777/0001-04</p>
  <nav><a href="/oculos-de-sol">Óculos de sol</a> · <a href="/oculos-de-grau">Óculos de grau</a> · <a href="/infantil">Infantil</a> · <a href="/epi">EPI</a> · <a href="/marcas">Marcas</a> · <a href="/provador">Provador virtual</a> · <a href="/lentes-de-grau">Lentes de grau</a> · <a href="/guia">Guias</a></nav></footer>`;
}

const ESTATICAS: Record<string, { titulo: string; descricao: string; h1: string; texto: string }> = {
  "/provador": {
    titulo: "Provador virtual de óculos",
    descricao: "Experimente óculos no seu rosto pela câmera do celular ou do computador. A imagem é processada no seu aparelho e não é enviada.",
    h1: "Provador virtual",
    texto: "Abra a câmera, escolha a armação e troque de modelo ao vivo. O óculos acompanha o rosto na escala das medidas do modelo. Nada sai do seu aparelho.",
  },
  "/lentes-de-grau": {
    titulo: "Óculos de grau com receita pelo site",
    descricao: "Escolha a armação, envie a receita e receba o orçamento das lentes pelo WhatsApp. Varilux e Zeiss. Nada é cobrado antes da sua aprovação.",
    h1: "Lentes de grau com a sua receita",
    texto: "Você escolhe a armação, envia foto ou PDF da receita e a consultora confere e manda o orçamento das lentes pelo WhatsApp. O site não indica lente: quem define a solução técnica é a consultora, com a sua receita.",
  },
  "/empresas": {
    titulo: "Óculos de segurança (EPI) e EPI com grau para empresas",
    descricao: "Óculos de proteção com CA e EPI com lente de grau para indústrias, usinas, construtoras e laboratórios de Cravinhos, Ribeirão Preto e região.",
    h1: "Atendimento para empresas",
    texto: "Fornecimento de óculos de proteção com Certificado de Aprovação e de EPIs com lentes de grau, com atendimento personalizado, entrega e condições para contratos corporativos.",
  },
  "/formato-do-rosto": {
    titulo: "Qual armação combina com o formato do seu rosto",
    descricao: "Rosto redondo, quadrado, oval, coração, alongado ou diamante: os formatos de armação que costumam equilibrar cada um.",
    h1: "Qual armação combina com o seu rosto",
    texto: "Rosto redondo combina com armações angulares (quadradas, retangulares, hexagonais); rosto quadrado, com redondas, ovais e aviadores; rosto oval aceita quase tudo; coração, com aviadores e redondos; alongado, com armações de mais altura.",
  },
  "/tamanho-do-oculos": {
    titulo: "Como saber o tamanho do óculos",
    descricao: "O que significam os números da haste (ex.: 52□18 140) e como escolher a armação do tamanho certo.",
    h1: "Como saber o tamanho do óculos",
    texto: "Os três números na haste são, em milímetros, a largura da lente, a ponte e o comprimento da haste. Compare com o óculos que você já usa.",
  },
  "/sobre": {
    titulo: "Sobre a Óticas Sanrê",
    descricao: "Fundada em 17 de dezembro de 2004 em Cravinhos. Em 2026, a segunda loja, em Ribeirão Preto, dentro da PB Arts Gallery.",
    h1: "Sobre a Sanrê",
    texto: "Ótica fundada em 17 de dezembro de 2004 no centro de Cravinhos, referência em atendimento personalizado, com óculos de grau, solares e lentes de contato das melhores marcas. Em 23 de julho de 2026 abriu a loja de Ribeirão Preto, anexa à PB Arts Gallery.",
  },
  "/contato": {
    titulo: "Contato",
    descricao: "WhatsApp (16) 99195-1430, e-mail atendimento@oticasanre.com.br e as lojas de Cravinhos e Ribeirão Preto.",
    h1: "Contato",
    texto: "WhatsApp (16) 99195-1430 · atendimento@oticasanre.com.br · Instagram @oticasanre.",
  },
  "/trocas-e-devolucoes": {
    titulo: "Trocas, devoluções e garantia",
    descricao: "Direito de arrependimento em 7 dias para compras pelo site, garantia legal e do fabricante.",
    h1: "Trocas, devoluções e garantia",
    texto: "Compras pelo site podem ser devolvidas em até 7 dias (CDC, art. 49). Lentes de grau são feitas sob medida; defeitos e ajustes são resolvidos pela consultora.",
  },
  "/privacidade": {
    titulo: "Política de privacidade",
    descricao: "Como a Óticas Sanrê trata dados de compras, contato, receitas enviadas para orçamento, provador virtual e cookies.",
    h1: "Política de privacidade",
    texto: "Receitas são dado de saúde: recebidas só com consentimento e apagadas em até 90 dias. O provador virtual processa a imagem no seu aparelho.",
  },
  "/marcas": {
    titulo: "Marcas de óculos",
    descricao: "Ray-Ban, Oakley, Prada, Gucci, Tom Ford, Carrera e outras marcas originais na Óticas Sanrê.",
    h1: "Marcas",
    texto: "Grifes internacionais e marcas nacionais, originais, com nota fiscal e garantia do fabricante.",
  },
  "/unidades": {
    titulo: "Lojas em Cravinhos e Ribeirão Preto",
    descricao: "Rua XV de Novembro, 662A, em Cravinhos, e Rua Altino Arantes, 811, em Ribeirão Preto, anexa à PB Arts Gallery.",
    h1: "Nossas lojas",
    texto: "",
  },
  "/guia": {
    titulo: "Guias para escolher óculos",
    descricao: "Formato do rosto, polarizado ou UV, lente fotossensível, multifocal, tamanho do óculos e EPI com grau.",
    h1: "Guias",
    texto: "",
  },
};

const PRIVADAS = [/^\/admin/, /^\/loja\/carrinho/, /^\/loja\/checkout/, /^\/loja\/pedido\//];

async function montarPagina(caminho: string, origem: string): Promise<Pagina> {
  const base = { caminho, jsonld: [] as unknown[] };

  if (PRIVADAS.some(r => r.test(caminho))) {
    return { ...base, status: 200, titulo: NOME, descricao: DESCRICAO_PADRAO, noindex: true, corpo: "" };
  }

  // ── Home ──
  if (caminho === "/") {
    const { products } = await storage.listProducts({ status: "active", published: true, featured: true, limit: 12, sort: "destaque" });
    return {
      ...base,
      status: 200,
      titulo: `${NOME} | Óculos de sol, de grau e EPI em Cravinhos e Ribeirão Preto`,
      descricao: DESCRICAO_PADRAO,
      imagem: "/og-image.jpg",
      jsonld: [
        organizacao(origem),
        ...UNIDADES.map(u => otica(u, origem)),
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: NOME,
          url: `${origem}/`,
          potentialAction: {
            "@type": "SearchAction",
            target: `${origem}/loja?busca={termo}`,
            "query-input": "required name=termo",
          },
        },
      ],
      corpo: `<h1>${NOME}: óculos de sol, de grau e EPI em Cravinhos e Ribeirão Preto</h1>
<p>${esc(DESCRICAO_PADRAO)}</p>
<h2>Óculos por tipo</h2><ul>${TIPOS.map(t => `<li><a href="${t.rota}">${esc(t.titulo)}</a>: ${esc(t.resumo)}</li>`).join("")}</ul>
<h2>Curadoria Sanrê</h2>${listaProdutosHtml(products)}
<h2>Diferenciais</h2><ul><li><a href="/provador">Provador virtual</a> pela câmera, sem enviar a imagem.</li><li><a href="/lentes-de-grau">Lentes de grau</a> com receita enviada pelo site e orçamento pelo WhatsApp.</li><li>Retirada grátis nas duas lojas. PIX com 5% de desconto e até 10x sem juros.</li><li><a href="/empresas">EPI e EPI com grau</a> para empresas.</li></ul>`,
    };
  }

  // ── Produto ──
  const mProd = caminho.match(/^\/loja\/produto\/([^/]+)\/?$/);
  if (mProd) {
    const p = await storage.getPublicProductBySlug(decodeURIComponent(mProd[1]));
    if (!p) return naoEncontrada(caminho);
    const [imgs, cats, estoque] = await Promise.all([
      storage.getProductImages(p.id),
      storage.listCategories(true),
      storage.getUnitStockForProducts([p.id]),
    ]);
    const cat = cats.find(c => c.id === p.categoryId);
    const imagens = imgs.map(i => `${origem}${i.url}`);
    const disponivel = p.stockQuantity > 0 || p.continueSellingOutOfStock;
    const medida = medidaArmacao(p);
    const saldo = estoque.get(p.id) ?? {};
    const props: [string, string | null | undefined][] = [
      ["Formato", p.frameShape ? rotulo(FORMATOS, p.frameShape) : null],
      ["Material", p.frameMaterial ? rotulo(MATERIAIS, p.frameMaterial) : null],
      ["Cor da armação", p.frameColor],
      ["Lente", p.lensColor],
      ["Polarizada", p.lensPolarized ? "Sim" : null],
      ["Proteção", p.uvProtection],
      ["Medidas (lente□ponte haste)", medida],
      ["Para quem", p.audience ? rotulo(PUBLICOS, p.audience) : null],
      ["Aceita lente de grau", p.acceptsRx ? "Sim" : "Não"],
      ["CA", p.caNumber],
    ];
    const titulo = `${p.title}${p.frameColor ? ` ${p.frameColor}` : ""}${p.modelCode && !p.title.includes(p.modelCode) ? ` ${p.modelCode}` : ""}`;
    return {
      ...base,
      status: 200,
      titulo,
      descricao: `${p.description ?? p.title}`.replace(/\s+/g, " ").slice(0, 290),
      imagem: imgs[0]?.url ?? null,
      tipoOg: "product",
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description ?? undefined,
          sku: p.sku ?? undefined,
          mpn: p.modelCode ?? undefined,
          image: imagens,
          color: p.frameColor ?? undefined,
          material: p.frameMaterial ? rotulo(MATERIAIS, p.frameMaterial) : undefined,
          brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
          category: cat?.name,
          additionalProperty: props
            .filter(([, v]) => v)
            .map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
          offers: {
            "@type": "Offer",
            url: `${origem}${caminho}`,
            price: Number(p.price).toFixed(2),
            priceCurrency: "BRL",
            availability: disponivel ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": `${origem}/#organizacao` },
          },
        },
        trilha(origem, [
          ["Início", "/"],
          ...(cat ? ([[cat.name, `/${cat.slug}`]] as [string, string][]) : []),
          ...(p.brand ? ([[p.brand, `/marcas/${slugificar(p.brand)}`]] as [string, string][]) : []),
          [p.title, caminho],
        ]),
      ],
      corpo: `<nav><a href="/">Início</a> / ${cat ? `<a href="/${cat.slug}">${esc(cat.name)}</a> / ` : ""}${p.brand ? `<a href="/marcas/${slugificar(p.brand)}">${esc(p.brand)}</a>` : ""}</nav>
<h1>${esc(p.title)}${p.frameColor ? ` — ${esc(p.frameColor)}` : ""}</h1>
<p>${esc(precoBR(p.price))} · em até 10x sem juros · 5% de desconto no PIX · ${disponivel ? "disponível" : "indisponível no site"}</p>
<p>${esc(p.description ?? "")}</p>
<h2>Ficha técnica</h2><dl>${props.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<h2>Onde ver</h2><ul>${UNIDADES.map(u => `<li>${esc(u.cidade)}: ${(saldo[u.slug] ?? 0) > 0 ? "pronta entrega na loja" : "sob consulta"}</li>`).join("")}</ul>
${imgs[0] ? `<img src="${esc(imgs[0].url)}" alt="${esc(p.title)}" width="800" height="640">` : ""}`,
    };
  }

  // ── Seções por tipo e vitrine ──
  const tipo = TIPOS.find(t => t.rota === caminho);
  if (tipo || caminho === "/loja") {
    const cats = await storage.listCategories(true);
    const cat = tipo ? cats.find(c => c.slug === tipo.slug) : undefined;
    const { products, total } = await storage.listProducts({
      status: "active", published: true, limit: 60, sort: "destaque",
      categoryIds: cat ? [cat.id] : undefined,
    });
    const titulo = tipo ? `${tipo.titulo} em Cravinhos e Ribeirão Preto` : "Óculos de sol, de grau, infantis e EPI";
    return {
      ...base,
      status: 200,
      titulo,
      descricao: tipo?.resumo ?? DESCRICAO_PADRAO,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: titulo,
          url: `${origem}${caminho}`,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: total,
            itemListElement: products.slice(0, 30).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${origem}/loja/produto/${p.slug}`,
              name: p.title,
            })),
          },
        },
        trilha(origem, [["Início", "/"], [tipo?.titulo ?? "Óculos", caminho]]),
      ],
      corpo: `<h1>${esc(tipo?.titulo ?? "Todos os óculos")}</h1><p>${esc(tipo?.resumo ?? DESCRICAO_PADRAO)}</p><p>${total} modelos.</p>${listaProdutosHtml(products)}`,
    };
  }

  // ── Marca ──
  const mMarca = caminho.match(/^\/marcas\/([^/]+)\/?$/);
  if (mMarca) {
    const slug = mMarca[1];
    const marcas = await storage.listBrands();
    const m = marcas.find(x => slugificar(x.marca) === slug);
    if (!m) return naoEncontrada(caminho);
    const ficha = fichaMarca(slug, m.marca);
    const { products } = await storage.listProducts({ status: "active", published: true, limit: 60, brands: [m.marca], sort: "destaque" });
    return {
      ...base,
      status: 200,
      titulo: `${m.marca} original em Cravinhos e Ribeirão Preto`,
      descricao: `${ficha.resumo} ${m.total} modelos ${m.marca} na ${NOME}, de ${precoBR(m.min)} a ${precoBR(m.max)}.`.slice(0, 300),
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${m.marca} na ${NOME}`,
          about: { "@type": "Brand", name: m.marca },
          url: `${origem}${caminho}`,
        },
        trilha(origem, [["Início", "/"], ["Marcas", "/marcas"], [m.marca, caminho]]),
      ],
      corpo: `<h1>${esc(m.marca)}</h1><p>${esc(ficha.origem)}</p><p>${esc(ficha.resumo)}</p><p>${m.total} modelos, de ${esc(precoBR(m.min))} a ${esc(precoBR(m.max))}. Originais, com nota fiscal e garantia do fabricante.</p>${listaProdutosHtml(products)}`,
    };
  }
  if (caminho === "/marcas") {
    const marcas = await storage.listBrands();
    const e = ESTATICAS["/marcas"];
    return {
      ...base, status: 200, titulo: e.titulo, descricao: e.descricao,
      corpo: `<h1>${e.h1}</h1><p>${e.texto}</p><ul>${marcas.map(m => `<li><a href="/marcas/${slugificar(m.marca)}">${esc(m.marca)}</a> — ${m.total} modelos</li>`).join("")}</ul>`,
    };
  }

  // ── Unidades ──
  const mUni = caminho.match(/^\/unidades\/([^/]+)\/?$/);
  if (mUni) {
    const u = unidadePorSlug(mUni[1]);
    if (!u) return naoEncontrada(caminho);
    return {
      ...base,
      status: 200,
      titulo: `Ótica em ${u.cidade} — Sanrê ${u.cidade}`,
      descricao: `${u.resumo} ${enderecoCompleto(u)}.`.slice(0, 300),
      imagem: u.foto,
      jsonld: [otica(u, origem), trilha(origem, [["Início", "/"], ["Lojas", "/unidades"], [u.cidade, caminho]])],
      corpo: `<h1>Sanrê ${esc(u.cidade)}</h1><p>${esc(u.resumo)}</p><p>Endereço: ${esc(enderecoCompleto(u))}${u.complemento ? ` (${esc(u.complemento)})` : ""}. <a href="${esc(u.mapsUrl)}">Como chegar</a>.</p><p>WhatsApp (16) 99195-1430. ${u.horarioConfirmado ? "" : "Confirme o horário pelo WhatsApp."}</p>`,
    };
  }

  // ── Guias ──
  const mGuia = caminho.match(/^\/guia\/([^/]+)\/?$/);
  if (mGuia) {
    const g = guiaPorSlug(mGuia[1]);
    if (!g) return naoEncontrada(caminho);
    return {
      ...base,
      status: 200,
      titulo: g.titulo,
      descricao: g.descricao,
      tipoOg: "article",
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.titulo,
          description: g.descricao,
          author: { "@id": `${origem}/#organizacao` },
          publisher: { "@id": `${origem}/#organizacao` },
          mainEntityOfPage: `${origem}${caminho}`,
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: g.titulo, acceptedAnswer: { "@type": "Answer", text: g.resposta } },
            ...g.faq.map(f => ({ "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })),
          ],
        },
        trilha(origem, [["Início", "/"], ["Guias", "/guia"], [g.titulo, caminho]]),
      ],
      corpo: `<article><h1>${esc(g.titulo)}</h1><p>${esc(g.resposta)}</p>${g.secoes
        .map(s => `<h2>${esc(s.titulo)}</h2>${s.paragrafos.map(p => `<p>${esc(p)}</p>`).join("")}`)
        .join("")}<h2>Perguntas frequentes</h2>${g.faq.map(f => `<h3>${esc(f.pergunta)}</h3><p>${esc(f.resposta)}</p>`).join("")}</article>`,
    };
  }
  if (caminho === "/guia") {
    const e = ESTATICAS["/guia"];
    return {
      ...base, status: 200, titulo: e.titulo, descricao: e.descricao,
      corpo: `<h1>${e.h1}</h1><ul>${GUIAS.map(g => `<li><a href="/guia/${g.slug}">${esc(g.titulo)}</a> — ${esc(g.descricao)}</li>`).join("")}</ul>`,
    };
  }
  if (caminho === "/unidades") {
    const e = ESTATICAS["/unidades"];
    return {
      ...base, status: 200, titulo: e.titulo, descricao: e.descricao,
      jsonld: UNIDADES.map(u => otica(u, origem)),
      corpo: `<h1>${e.h1}</h1><ul>${UNIDADES.map(u => `<li><a href="/unidades/${u.slug}">Sanrê ${esc(u.cidade)}</a>: ${esc(enderecoCompleto(u))}</li>`).join("")}</ul>`,
    };
  }

  // ── Páginas estáticas ──
  const e = ESTATICAS[caminho.replace(/\/$/, "") || "/"];
  if (e) {
    return {
      ...base,
      status: 200,
      titulo: e.titulo,
      descricao: e.descricao,
      jsonld: caminho === "/sobre" ? [organizacao(origem)] : [],
      corpo: `<h1>${esc(e.h1)}</h1><p>${esc(e.texto)}</p>`,
    };
  }

  return naoEncontrada(caminho);
}

function naoEncontrada(caminho: string): Pagina {
  return {
    status: 404,
    caminho,
    titulo: "Página não encontrada",
    descricao: DESCRICAO_PADRAO,
    noindex: true,
    corpo: `<h1>Página não encontrada</h1><p><a href="/loja">Ver os óculos</a> · <a href="/">Início</a></p>`,
  };
}

function cabecalho(p: Pagina, origem: string): string {
  const titulo = p.titulo.includes("Sanrê") ? p.titulo : `${p.titulo} | ${NOME}`;
  const url = `${origem}${p.caminho}`;
  const imagem = p.imagem ? (p.imagem.startsWith("http") ? p.imagem : `${origem}${p.imagem}`) : `${origem}/og-image.jpg`;
  return [
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(p.descricao)}" />`,
    p.noindex ? `<meta name="robots" content="noindex, nofollow" />` : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${NOME}" />`,
    `<meta property="og:title" content="${esc(titulo)}" />`,
    `<meta property="og:description" content="${esc(p.descricao)}" />`,
    `<meta property="og:type" content="${p.tipoOg ?? "website"}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(imagem)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${esc(imagem)}" />`,
    ...(p.jsonld ?? []).map(j => `<script type="application/ld+json" data-ssr-ld>${jsonScript(j)}</script>`),
  ].join("\n    ");
}

/**
 * Preenche o template do index.html para a URL pedida.
 * Nunca derruba a página: se o banco falhar, devolve o shell com as tags padrão.
 */
export async function renderizarShell(
  urlOriginal: string,
  template: string,
  origem: string,
): Promise<{ html: string; status: number }> {
  const caminho = decodeURI(urlOriginal.split("?")[0].split("#")[0]) || "/";
  let pagina: Pagina;
  try {
    pagina = await montarPagina(caminho === "" ? "/" : caminho, origem);
  } catch (e) {
    console.error("[seo] falha ao montar página:", (e as Error).message);
    return { html: template, status: 200 };
  }
  const head = cabecalho(pagina, origem);
  const corpo = pagina.corpo ? `<div data-ssr>${pagina.corpo}${rodapeHtml()}</div>` : "";
  const html = template
    .replace(/<!--sanre:head-->[\s\S]*?<!--\/sanre:head-->/, head)
    .replace("<!--sanre:ssr-->", corpo);
  return { html, status: pagina.status };
}

/** Origem pública (PUBLIC_URL tem prioridade; senão, a do request). */
export function origemDoRequest(req: { headers: Record<string, unknown>; protocol?: string; get(h: string): string | undefined }): string {
  const configurada = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (configurada) return configurada;
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  return `${proto}://${req.get("host")}`;
}

