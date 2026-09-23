import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import FormatoIcone from "@/components/oculos/FormatoIcone";
import { abrirAssistente } from "@/components/assistente/contexto";
import { corHex, precoBR } from "@/lib/marca";
import { aplicarSeo } from "@/lib/seo";
import { FORMATOS, MATERIAIS, PUBLICOS, TIPOS, UNIDADES_ROTULO, rotulo, slugificar, tipoPorSlug } from "@/lib/oculos";

interface Facetas {
  total: number;
  minPrice: number;
  maxPrice: number;
  marcas: { valor: string; total: number }[];
  formatos: { valor: string; total: number }[];
  materiais: { valor: string; total: number }[];
  publicos: { valor: string; total: number }[];
  cores: { valor: string; hex: string | null; total: number }[];
  lente: { polarizada: number; espelhada: number; degrade: number; fotossensivel: number };
  aceitaGrau: number;
  provador: number;
  unidades: { slug: string; total: number }[];
  faixas: { rotulo: string; min: number; max: number | null; total: number }[];
}
interface RespostaProdutos {
  products: ProdutoCard[];
  total: number;
  page: number;
  pages: number;
}

const ORDENACOES = [
  { value: "destaque", label: "Curadoria Sanrê" },
  { value: "newest", label: "Novidades" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

const LENTES: { chave: keyof Facetas["lente"]; param: string; rotulo: string }[] = [
  { chave: "polarizada", param: "polarizado", rotulo: "Polarizada" },
  { chave: "espelhada", param: "espelhado", rotulo: "Espelhada" },
  { chave: "degrade", param: "degrade", rotulo: "Degradê" },
  { chave: "fotossensivel", param: "fotossensivel", rotulo: "Fotossensível" },
];

/** Estado dos filtros lido da query string (a URL é a fonte da verdade). */
function lerFiltros(search: string) {
  const p = new URLSearchParams(search);
  const csv = (k: string) => (p.get(k) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    tipo: csv("tipo"),
    marca: csv("marca"),
    formato: csv("formato"),
    material: csv("material"),
    publico: csv("publico"),
    cor: csv("cor"),
    lente: csv("lente"),
    unidade: csv("unidade"),
    grau: p.get("grau") === "1",
    provador: p.get("provador") === "1",
    min: p.get("min") ?? "",
    max: p.get("max") ?? "",
    busca: p.get("busca") ?? "",
    ordenar: p.get("ordenar") ?? "destaque",
    pagina: Math.max(1, Number(p.get("pagina")) || 1),
  };
}
type Filtros = ReturnType<typeof lerFiltros>;

export interface StorePageProps {
  /** Seção fixa (rota /oculos-de-sol etc.): slug da categoria. */
  tipoFixo?: string;
  /** Página de marca: nome da marca como está no catálogo. */
  marcaFixa?: string;
  /** Cabeçalho próprio (página de marca). */
  cabecalho?: ReactNode;
  /** Conteúdo abaixo da grade (texto de SEO, FAQ da marca). */
  rodape?: ReactNode;
}

/**
 * Vitrine de óculos.
 *
 * Filtros numa coluna lateral no desktop (óculos se escolhe por muita coisa:
 * marca, preço, formato, lente, onde retirar) e numa gaveta no celular. A
 * grade é a vitrine da galeria: pedestais colados por um fio, etiqueta embaixo.
 */
export default function StorePage({ tipoFixo, marcaFixa, cabecalho, rodape }: StorePageProps = {}) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const f = useMemo(() => lerFiltros(search), [search]);
  const [gaveta, setGaveta] = useState(false);

  const tipos = tipoFixo ? [tipoFixo] : f.tipo;
  const tipoAtual = tipos.length === 1 ? tipoPorSlug(tipos[0]) : undefined;
  const marcas = marcaFixa ? [marcaFixa] : f.marca;

  const urlFacetas = `/api/store/filters${tipos.length === 1 ? `?tipo=${tipos[0]}` : ""}`;
  const { data: facetas } = useQuery<Facetas>({
    queryKey: [urlFacetas],
    queryFn: () => fetch(urlFacetas).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const urlProdutos = useMemo(() => {
    const p = new URLSearchParams({ limit: "24", page: String(f.pagina), sort: f.ordenar });
    if (tipos.length) p.set("tipo", tipos.join(","));
    if (marcas.length) p.set("marca", marcas.join(","));
    if (f.formato.length) p.set("formato", f.formato.join(","));
    if (f.material.length) p.set("material", f.material.join(","));
    if (f.publico.length) p.set("publico", f.publico.join(","));
    if (f.cor.length) p.set("cor", f.cor.join(","));
    if (f.unidade.length) p.set("unidade", f.unidade.join(","));
    for (const l of f.lente) p.set(l, "1");
    if (f.grau) p.set("grau", "1");
    if (f.provador) p.set("tryon", "1");
    if (f.min) p.set("min_price", f.min);
    if (f.max) p.set("max_price", f.max);
    if (f.busca) p.set("search", f.busca);
    return `/api/store/products?${p}`;
  }, [f, tipos.join(","), marcas.join(",")]);

  const { data, isLoading } = useQuery<RespostaProdutos>({
    queryKey: [urlProdutos],
    queryFn: () => fetch(urlProdutos).then(r => r.json()),
    staleTime: 30_000,
  });

  const produtos = data?.products ?? [];
  const total = data?.total ?? 0;
  const paginas = data?.pages ?? 1;

  // SEO por rota (o servidor já entrega as mesmas tags no HTML; aqui mantém na navegação SPA)
  useEffect(() => {
    if (marcaFixa) return; // a página de marca cuida do próprio SEO
    const titulo = f.busca
      ? `Busca: ${f.busca}`
      : tipoAtual
        ? `${tipoAtual.titulo} em Cravinhos e Ribeirão Preto`
        : "Óculos de sol, de grau, infantis e EPI";
    aplicarSeo({
      titulo,
      descricao: tipoAtual?.resumo ?? "Óculos originais das melhores marcas com provador virtual, lentes de grau com receita e retirada nas lojas de Cravinhos e Ribeirão Preto.",
      caminho: location,
    });
  }, [location, f.busca, tipoAtual?.slug, marcaFixa]);

  useEffect(() => {
    if (f.pagina > 1) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [f.pagina]);

  useEffect(() => {
    document.body.style.overflow = gaveta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [gaveta]);

  function aplicar(mudancas: Record<string, string | string[] | null>, manterPagina = false) {
    const p = new URLSearchParams(window.location.search);
    for (const [chave, valor] of Object.entries(mudancas)) {
      const v = Array.isArray(valor) ? valor.join(",") : valor;
      if (!v) p.delete(chave);
      else p.set(chave, v);
    }
    if (!manterPagina) p.delete("pagina");
    const qs = p.toString();
    navigate(`${location}${qs ? `?${qs}` : ""}`);
  }

  const alternar = (chave: keyof Filtros, valor: string) => {
    const atuais = f[chave] as string[];
    aplicar({ [chave]: atuais.includes(valor) ? atuais.filter(v => v !== valor) : [...atuais, valor] });
  };

  const chips: { rotulo: string; limpar: () => void }[] = [
    ...(!tipoFixo ? f.tipo.map(t => ({ rotulo: tipoPorSlug(t)?.titulo ?? t, limpar: () => alternar("tipo", t) })) : []),
    ...(!marcaFixa ? f.marca.map(m => ({ rotulo: m, limpar: () => alternar("marca", m) })) : []),
    ...f.formato.map(v => ({ rotulo: rotulo(FORMATOS, v), limpar: () => alternar("formato", v) })),
    ...f.material.map(v => ({ rotulo: rotulo(MATERIAIS, v), limpar: () => alternar("material", v) })),
    ...f.publico.map(v => ({ rotulo: rotulo(PUBLICOS, v), limpar: () => alternar("publico", v) })),
    ...f.cor.map(v => ({ rotulo: v, limpar: () => alternar("cor", v) })),
    ...f.lente.map(v => ({ rotulo: LENTES.find(l => l.param === v)?.rotulo ?? v, limpar: () => alternar("lente", v) })),
    ...f.unidade.map(v => ({ rotulo: `Retirar em ${UNIDADES_ROTULO[v] ?? v}`, limpar: () => alternar("unidade", v) })),
    ...(f.grau ? [{ rotulo: "Aceita lente de grau", limpar: () => aplicar({ grau: null }) }] : []),
    ...(f.provador ? [{ rotulo: "Com provador virtual", limpar: () => aplicar({ provador: null }) }] : []),
    ...(f.min || f.max
      ? [{
          rotulo: f.max ? `${precoBR(Number(f.min || 0))} a ${precoBR(Number(f.max))}` : `Acima de ${precoBR(Number(f.min))}`,
          limpar: () => aplicar({ min: null, max: null }),
        }]
      : []),
    ...(f.busca ? [{ rotulo: `“${f.busca}”`, limpar: () => aplicar({ busca: null }) }] : []),
  ];

  const limparTudo = () => navigate(location);

  const painelFiltros = facetas ? (
    <PainelFiltros f={f} facetas={facetas} tipoFixo={tipoFixo} marcaFixa={marcaFixa} aplicar={aplicar} alternar={alternar} />
  ) : (
    <p className="text-sm text-sr-ink-soft">Carregando filtros…</p>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {cabecalho ?? (
          <section className="bleed border-b border-sr-line pb-8 pt-10 md:pb-10 md:pt-14">
            <nav aria-label="Trilha" className="text-[0.8rem] text-sr-ink-soft">
              <Link href="/" className="no-underline hover:text-sr-ink">Início</Link>
              <span className="mx-2 text-sr-nude-400">/</span>
              <span className="text-sr-ink">{tipoAtual ? tipoAtual.titulo : "Óculos"}</span>
            </nav>
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="eyebrow">{f.busca ? "Resultado da busca" : "Óticas Sanrê"}</p>
                <h1 className="display-lg mt-3">
                  {f.busca ? `“${f.busca}”` : tipoAtual ? tipoAtual.titulo : "Todos os óculos"}
                </h1>
                <p className="measure mt-4 text-sr-ink-soft">
                  {tipoAtual?.resumo ??
                    "Sol, grau, infantil e segurança. Originais, com nota fiscal e garantia do fabricante — e retirada grátis nas nossas lojas."}
                </p>
              </div>
              {!tipoFixo && !f.busca && (
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => (
                    <Link key={t.slug} href={t.rota} className="btn-line min-h-[2.5rem] px-4">
                      {t.rotulo}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {tipoAtual?.slug === "oculos-de-grau" && (
              <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-sr-gold pl-4 text-[0.92rem] text-sr-ink">
                Escolha a armação e envie a receita: a consultora monta as lentes e confirma o orçamento antes de cobrar.
                <Link href="/lentes-de-grau" className="link-rule">Como funciona</Link>
              </p>
            )}
            {tipoAtual?.slug === "epi" && (
              <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-sr-gold pl-4 text-[0.92rem] text-sr-ink">
                Compra para a equipe da sua empresa, com ou sem lente de grau?
                <Link href="/empresas" className="link-rule">Atendimento para empresas</Link>
              </p>
            )}
          </section>
        )}

        {/* Barra de controle */}
        <div className="sticky top-[calc(var(--sr-header)+2.25rem)] z-30 border-b border-sr-line bg-sr-paper/95 backdrop-blur">
          <div className="bleed flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setGaveta(true)}
                className="nav-label inline-flex items-center gap-2 text-sr-ink lg:hidden"
              >
                <SlidersHorizontal size={16} aria-hidden />
                Filtrar{chips.length > 0 && ` (${chips.length})`}
              </button>
              <p className="text-[0.85rem] text-sr-ink-soft" aria-live="polite">
                {isLoading ? "Carregando…" : `${total} ${total === 1 ? "óculos" : "óculos"}`}
              </p>
            </div>
            <label className="flex items-center gap-2 text-[0.85rem] text-sr-ink-soft">
              <span className="hidden sm:inline">Ordenar por</span>
              <select
                value={f.ordenar}
                onChange={e => aplicar({ ordenar: e.target.value === "destaque" ? null : e.target.value })}
                className="border-0 bg-transparent py-1 pr-1 font-label text-[0.75rem] font-medium uppercase tracking-[0.12em] text-sr-ink focus:ring-0"
                aria-label="Ordenar por"
              >
                {ORDENACOES.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bleed grid gap-10 pb-24 pt-8 lg:grid-cols-[15.5rem_1fr] xl:gap-14">
          <aside className="hidden lg:block" aria-label="Filtros">
            <div className="sticky top-[calc(var(--sr-header)+6rem)] max-h-[calc(100vh-var(--sr-header)-7rem)] overflow-y-auto pb-10 pr-2 scrollbar-none">
              {painelFiltros}
            </div>
          </aside>

          <section aria-label="Óculos">
            {chips.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {chips.map(c => (
                  <button
                    key={c.rotulo}
                    onClick={c.limpar}
                    className="inline-flex items-center gap-1.5 border border-sr-line bg-white px-3 py-1.5 text-[0.8rem] text-sr-ink hover:border-sr-ink"
                    aria-label={`Remover filtro ${c.rotulo}`}
                  >
                    {c.rotulo}
                    <X size={13} aria-hidden />
                  </button>
                ))}
                <button onClick={limparTudo} className="ml-1 text-[0.8rem] text-sr-nude-600 underline underline-offset-4">
                  Limpar tudo
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="grid-vitrine">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i}>
                    <div className="pedestal aspect-vitrine animate-pulse" />
                    <div className="mt-4 h-3 w-1/3 bg-sr-nude-100" />
                    <div className="mt-2 h-3 w-2/3 bg-sr-nude-100" />
                  </div>
                ))}
              </div>
            ) : produtos.length === 0 ? (
              <div className="border border-sr-line bg-white px-6 py-16 text-center">
                <p className="display-md">Nenhum óculos com esses filtros</p>
                <p className="mx-auto mt-3 max-w-md text-sr-ink-soft">
                  Tire um filtro ou fale com a gente: a loja tem mais modelos do que os que estão no site.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <button onClick={limparTudo} className="btn-line">
                    Limpar filtros
                  </button>
                  <button onClick={() => abrirAssistente("Procuro um óculos que não achei no site.")} className="btn-ink">
                    Perguntar à Sanrê
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid-vitrine">
                {produtos.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            )}

            {paginas > 1 && (
              <nav className="mt-16 flex items-center justify-center gap-1" aria-label="Paginação">
                {Array.from({ length: paginas }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => aplicar({ pagina: n === 1 ? null : String(n) }, true)}
                    aria-current={n === f.pagina ? "page" : undefined}
                    className={`h-11 min-w-11 px-3 font-label text-[0.8rem] ${
                      n === f.pagina ? "bg-sr-ink text-sr-paper" : "text-sr-ink hover:bg-sr-nude-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </nav>
            )}
          </section>
        </div>

        {rodape}
      </main>
      <Footer />

      {/* Gaveta de filtros (celular) */}
      {gaveta && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <button className="absolute inset-0 bg-sr-ink/40" aria-label="Fechar filtros" onClick={() => setGaveta(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[90%] max-w-sm flex-col bg-sr-paper">
            <div className="flex items-center justify-between border-b border-sr-line px-5 py-4">
              <p className="nav-label">Filtrar</p>
              <button onClick={() => setGaveta(false)} aria-label="Fechar filtros" className="p-2">
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{painelFiltros}</div>
            <div className="grid grid-cols-2 gap-2 border-t border-sr-line p-4">
              <button onClick={limparTudo} className="btn-line">
                Limpar
              </button>
              <button onClick={() => setGaveta(false)} className="btn-ink">
                Ver {total}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel de filtros ──────────────────────────────────────────────────────

function Grupo({ titulo, children, aberto = true }: { titulo: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details open={aberto} className="group border-b border-sr-line py-4 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="nav-label text-sr-ink">{titulo}</span>
        <ChevronDown size={15} className="text-sr-nude-600 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3.5">{children}</div>
    </details>
  );
}

function Opcao({
  marcado,
  onChange,
  children,
  total,
}: {
  marcado: boolean;
  onChange: () => void;
  children: ReactNode;
  total?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.92rem] text-sr-ink">
      <input
        type="checkbox"
        checked={marcado}
        onChange={onChange}
        className="h-4 w-4 shrink-0 appearance-none border border-sr-nude-500 bg-white checked:border-sr-ink checked:bg-sr-ink"
        style={marcado ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' stroke='white' stroke-width='1.8' fill='none'/%3E%3C/svg%3E\")" } : undefined}
      />
      <span className="flex-1">{children}</span>
      {total !== undefined && <span className="text-[0.78rem] tabular-nums text-sr-nude-600">{total}</span>}
    </label>
  );
}

function PainelFiltros({
  f,
  facetas,
  tipoFixo,
  marcaFixa,
  aplicar,
  alternar,
}: {
  f: Filtros;
  facetas: Facetas;
  tipoFixo?: string;
  marcaFixa?: string;
  aplicar: (m: Record<string, string | string[] | null>, manterPagina?: boolean) => void;
  alternar: (chave: keyof Filtros, valor: string) => void;
}) {
  const [verTodasMarcas, setVerTodasMarcas] = useState(false);
  const [min, setMin] = useState(f.min);
  const [max, setMax] = useState(f.max);
  useEffect(() => {
    setMin(f.min);
    setMax(f.max);
  }, [f.min, f.max]);

  const marcasVisiveis = verTodasMarcas ? facetas.marcas : facetas.marcas.slice(0, 8);
  const faixaAtiva = (fx: { min: number; max: number | null }) =>
    f.min === String(fx.min) && f.max === (fx.max === null ? "" : String(fx.max));

  return (
    <div>
      {!tipoFixo && (
        <Grupo titulo="Tipo">
          {TIPOS.map(t => (
            <Opcao key={t.slug} marcado={f.tipo.includes(t.slug)} onChange={() => alternar("tipo", t.slug)}>
              {t.titulo}
            </Opcao>
          ))}
        </Grupo>
      )}

      {!marcaFixa && facetas.marcas.length > 0 && (
        <Grupo titulo="Marca">
          {marcasVisiveis.map(m => (
            <Opcao key={m.valor} marcado={f.marca.includes(m.valor)} onChange={() => alternar("marca", m.valor)} total={m.total}>
              {m.valor}
            </Opcao>
          ))}
          {facetas.marcas.length > 8 && (
            <button onClick={() => setVerTodasMarcas(v => !v)} className="mt-2 text-[0.82rem] text-sr-nude-600 underline underline-offset-4">
              {verTodasMarcas ? "Ver menos" : `Ver todas (${facetas.marcas.length})`}
            </button>
          )}
        </Grupo>
      )}

      <Grupo titulo="Faixa de preço">
        {facetas.faixas.filter(fx => fx.total > 0).map(fx => (
          <label key={fx.rotulo} className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.92rem] text-sr-ink">
            <input
              type="radio"
              name="faixa"
              checked={faixaAtiva(fx)}
              onChange={() => aplicar({ min: fx.min ? String(fx.min) : null, max: fx.max === null ? null : String(fx.max) })}
              className="h-4 w-4 accent-[#141414]"
            />
            <span className="flex-1">{fx.rotulo}</span>
            <span className="text-[0.78rem] tabular-nums text-sr-nude-600">{fx.total}</span>
          </label>
        ))}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={e => {
            e.preventDefault();
            aplicar({ min: min || null, max: max || null });
          }}
        >
          <label className="flex-1 text-[0.75rem] text-sr-ink-soft">
            De
            <input value={min} onChange={e => setMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={String(facetas.minPrice)} className="mt-1 w-full border border-sr-line bg-white px-2 py-1.5 text-sm text-sr-ink" />
          </label>
          <label className="flex-1 text-[0.75rem] text-sr-ink-soft">
            Até
            <input value={max} onChange={e => setMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={String(facetas.maxPrice)} className="mt-1 w-full border border-sr-line bg-white px-2 py-1.5 text-sm text-sr-ink" />
          </label>
          <button type="submit" className="h-[2.1rem] border border-sr-ink px-3 font-label text-[0.7rem] uppercase tracking-[0.12em]">
            Ok
          </button>
        </form>
      </Grupo>

      {facetas.formatos.length > 0 && (
        <Grupo titulo="Formato">
          <div className="grid grid-cols-2 gap-1.5">
            {facetas.formatos.map(fm => {
              const marcado = f.formato.includes(fm.valor);
              return (
                <button
                  key={fm.valor}
                  type="button"
                  onClick={() => alternar("formato", fm.valor)}
                  aria-pressed={marcado}
                  className={`flex flex-col items-center gap-1 border px-2 py-2.5 text-[0.78rem] transition-colors ${
                    marcado ? "border-sr-ink bg-sr-ink text-sr-paper" : "border-sr-line bg-white text-sr-ink hover:border-sr-ink"
                  }`}
                >
                  <FormatoIcone formato={fm.valor} className="h-5 w-14" />
                  <span>
                    {rotulo(FORMATOS, fm.valor)} <span className={marcado ? "text-sr-paper/70" : "text-sr-nude-600"}>{fm.total}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Link href="/formato-do-rosto" className="mt-3 inline-block text-[0.82rem] text-sr-nude-600 underline underline-offset-4">
            Qual formato combina com meu rosto?
          </Link>
        </Grupo>
      )}

      {facetas.publicos.length > 1 && (
        <Grupo titulo="Para quem">
          {facetas.publicos.map(p => (
            <Opcao key={p.valor} marcado={f.publico.includes(p.valor)} onChange={() => alternar("publico", p.valor)} total={p.total}>
              {rotulo(PUBLICOS, p.valor)}
            </Opcao>
          ))}
        </Grupo>
      )}

      {LENTES.some(l => facetas.lente[l.chave] > 0) && (
        <Grupo titulo="Lente">
          {LENTES.filter(l => facetas.lente[l.chave] > 0).map(l => (
            <Opcao key={l.param} marcado={f.lente.includes(l.param)} onChange={() => alternar("lente", l.param)} total={facetas.lente[l.chave]}>
              {l.rotulo}
            </Opcao>
          ))}
        </Grupo>
      )}

      {facetas.materiais.length > 1 && (
        <Grupo titulo="Material" aberto={false}>
          {facetas.materiais.map(m => (
            <Opcao key={m.valor} marcado={f.material.includes(m.valor)} onChange={() => alternar("material", m.valor)} total={m.total}>
              {rotulo(MATERIAIS, m.valor)}
            </Opcao>
          ))}
        </Grupo>
      )}

      {facetas.cores.length > 1 && (
        <Grupo titulo="Cor da armação" aberto={false}>
          <div className="flex flex-wrap gap-2">
            {facetas.cores.map(c => {
              const marcado = f.cor.includes(c.valor);
              return (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => alternar("cor", c.valor)}
                  aria-pressed={marcado}
                  title={`${c.valor} (${c.total})`}
                  className={`flex items-center gap-2 border px-2.5 py-1.5 text-[0.8rem] ${marcado ? "border-sr-ink" : "border-sr-line bg-white"}`}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c.hex ?? corHex(c.valor) }} aria-hidden />
                  {c.valor}
                </button>
              );
            })}
          </div>
        </Grupo>
      )}

      <Grupo titulo="Retirar na loja">
        {facetas.unidades.length === 0 ? (
          <p className="text-[0.85rem] text-sr-ink-soft">Saldo por loja em atualização.</p>
        ) : (
          (["cravinhos", "ribeirao-preto"] as const).map(u => {
            const tot = facetas.unidades.find(x => x.slug === u)?.total ?? 0;
            return (
              <Opcao key={u} marcado={f.unidade.includes(u)} onChange={() => alternar("unidade", u)} total={tot}>
                {UNIDADES_ROTULO[u]}
              </Opcao>
            );
          })
        )}
      </Grupo>

      <Grupo titulo="Mais">
        {facetas.aceitaGrau > 0 && (
          <Opcao marcado={f.grau} onChange={() => aplicar({ grau: f.grau ? null : "1" })} total={facetas.aceitaGrau}>
            Aceita lente de grau
          </Opcao>
        )}
        {facetas.provador > 0 && (
          <Opcao marcado={f.provador} onChange={() => aplicar({ provador: f.provador ? null : "1" })} total={facetas.provador}>
            Tem provador virtual
          </Opcao>
        )}
      </Grupo>
    </div>
  );
}

/** Rotas de seção (/oculos-de-sol, /oculos-de-grau, /infantil, /epi). */
export function secao(tipo: string) {
  return function SecaoPage() {
    return <StorePage tipoFixo={tipo} />;
  };
}

