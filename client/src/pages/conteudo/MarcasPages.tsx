import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StorePage from "@/pages/store/StorePage";
import { aplicarSeo } from "@/lib/seo";
import { precoBR } from "@/lib/marca";
import { slugificar } from "@/lib/oculos";
import { fichaMarca } from "@shared/conteudo/marcas";

interface MarcaApi {
  marca: string;
  total: number;
  min: number;
  max: number;
}

function useMarcas() {
  return useQuery<MarcaApi[]>({
    queryKey: ["/api/store/brands"],
    queryFn: () => fetch("/api/store/brands").then(r => r.json()),
    staleTime: 5 * 60_000,
  });
}

/** /marcas — índice de marcas, em ordem alfabética, com faixa de preço. */
export function MarcasPage() {
  const { data: marcas = [], isLoading } = useMarcas();
  useEffect(() => {
    aplicarSeo({
      titulo: "Marcas de óculos",
      descricao: "Ray-Ban, Oakley, Prada, Gucci, Tom Ford, Carrera e outras marcas originais na Óticas Sanrê, em Cravinhos e Ribeirão Preto.",
      caminho: "/marcas",
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bleed pb-24 pt-12 md:pt-16">
        <p className="eyebrow">Óticas Sanrê</p>
        <h1 className="display-lg mt-4 traco">Marcas</h1>
        <p className="measure mt-6 text-sr-ink-soft">
          Grifes internacionais e marcas nacionais. Tudo original, com nota fiscal e garantia do fabricante, para
          comprar pelo site ou ver nas lojas de Cravinhos e Ribeirão Preto.
        </p>
        {isLoading ? (
          <p className="mt-12 text-sr-ink-soft">Carregando…</p>
        ) : (
          <ul className="mt-12 grid gap-px bg-sr-line sm:grid-cols-2 lg:grid-cols-3">
            {marcas.map(m => {
              const ficha = fichaMarca(slugificar(m.marca), m.marca);
              return (
                <li key={m.marca} className="bg-sr-paper">
                  <Link href={`/marcas/${slugificar(m.marca)}`} className="group block h-full p-7 no-underline hover:bg-white">
                    <p className="font-label text-[1.05rem] font-medium uppercase tracking-[0.24em] text-sr-ink">{m.marca}</p>
                    {ficha.origem && <p className="mt-1 text-[0.8rem] text-sr-nude-600">{ficha.origem}</p>}
                    <p className="mt-4 text-[0.92rem] leading-relaxed text-sr-ink-soft">{ficha.resumo}</p>
                    <p className="mt-5 text-[0.82rem] text-sr-ink">
                      {m.total} {m.total === 1 ? "modelo" : "modelos"} · {m.min === m.max ? precoBR(m.min) : `${precoBR(m.min)} a ${precoBR(m.max)}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

/** /marcas/:slug — vitrine filtrada pela marca, com a ficha no topo. */
export function MarcaPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: marcas, isLoading } = useMarcas();
  const marca = marcas?.find(m => slugificar(m.marca) === slug);
  const ficha = fichaMarca(slug, marca?.marca);

  useEffect(() => {
    if (!marca) return;
    aplicarSeo({
      titulo: `${marca.marca} original em Cravinhos e Ribeirão Preto`,
      descricao: `${ficha.resumo} ${marca.total} modelos ${marca.marca} na Óticas Sanrê, com provador virtual e retirada na loja.`.slice(0, 300),
      caminho: `/marcas/${slug}`,
    });
  }, [marca?.marca, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="bleed py-24 text-sr-ink-soft">Carregando…</div>
      </div>
    );
  }
  if (!marca) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="bleed py-28 text-center">
          <h1 className="display-lg">Marca não encontrada</h1>
          <p className="mx-auto mt-4 max-w-md text-sr-ink-soft">Veja as marcas que estão no site agora.</p>
          <Link href="/marcas" className="btn-ink mt-8">Ver marcas</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <StorePage
      marcaFixa={marca.marca}
      cabecalho={
        <section className="border-b border-sr-line">
          <div className="bleed pb-10 pt-10 md:pt-14">
            <nav aria-label="Trilha" className="text-[0.8rem] text-sr-ink-soft">
              <Link href="/" className="no-underline hover:text-sr-ink">Início</Link>
              <span className="mx-2 text-sr-nude-400">/</span>
              <Link href="/marcas" className="no-underline hover:text-sr-ink">Marcas</Link>
              <span className="mx-2 text-sr-nude-400">/</span>
              <span className="text-sr-ink">{marca.marca}</span>
            </nav>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-end">
              <div>
                {ficha.origem && <p className="eyebrow">{ficha.origem}</p>}
                <h1 className="mt-4 font-label text-[2.2rem] font-light uppercase tracking-[0.2em] md:text-[3.2rem]">{marca.marca}</h1>
              </div>
              <div>
                <p className="text-[1.05rem] leading-relaxed text-sr-ink">{ficha.resumo}</p>
                {ficha.destaque && <p className="mt-3 text-[0.92rem] text-sr-ink-soft">Destaques: {ficha.destaque}.</p>}
                <p className="mt-3 text-[0.92rem] text-sr-ink-soft">
                  {marca.total} {marca.total === 1 ? "modelo" : "modelos"} no site, de {precoBR(marca.min)} a {precoBR(marca.max)}. Originais, com nota fiscal.
                </p>
              </div>
            </div>
          </div>
        </section>
      }
    />
  );
}
