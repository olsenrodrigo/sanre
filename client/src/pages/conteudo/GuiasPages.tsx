import { useEffect } from "react";
import { Link, useParams } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { aplicarSeo } from "@/lib/seo";
import { GUIAS, guiaPorSlug } from "@shared/conteudo/guias";
import { abrirAssistente } from "@/components/assistente/contexto";

/** /guia — índice dos guias. */
export function GuiasPage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Guias para escolher óculos",
      descricao: "Formato do rosto, polarizado ou UV, lente fotossensível, multifocal, tamanho do óculos e EPI com grau: respostas diretas da Óticas Sanrê.",
      caminho: "/guia",
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bleed pb-24 pt-12 md:pt-16">
        <p className="eyebrow">Guias Sanrê</p>
        <h1 className="display-lg mt-4 traco">Antes de escolher</h1>
        <p className="measure mt-6 text-sr-ink-soft">As perguntas que mais ouvimos no balcão, respondidas sem enrolação.</p>
        <ul className="mt-12 border-t border-sr-line">
          {GUIAS.map(g => (
            <li key={g.slug} className="border-b border-sr-line">
              <Link href={`/guia/${g.slug}`} className="group grid gap-3 py-7 no-underline md:grid-cols-[1fr_1.4fr] md:gap-10">
                <h2 className="font-display text-[1.35rem] font-light text-sr-ink group-hover:text-sr-nude-600">{g.titulo}</h2>
                <p className="text-[0.95rem] leading-relaxed text-sr-ink-soft">{g.descricao}</p>
              </Link>
            </li>
          ))}
          <li className="border-b border-sr-line">
            <Link href="/tamanho-do-oculos" className="group grid gap-3 py-7 no-underline md:grid-cols-[1fr_1.4fr] md:gap-10">
              <h2 className="font-display text-[1.35rem] font-light text-sr-ink group-hover:text-sr-nude-600">Como saber o tamanho do óculos</h2>
              <p className="text-[0.95rem] leading-relaxed text-sr-ink-soft">O que significam os números da haste e como comparar com o seu óculos atual.</p>
            </Link>
          </li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}

/** /guia/:slug — guia com resposta direta primeiro e FAQ (FAQPage no servidor). */
export function GuiaPage() {
  const { slug } = useParams<{ slug: string }>();
  const g = guiaPorSlug(slug);
  useEffect(() => {
    if (g) aplicarSeo({ titulo: g.titulo, descricao: g.descricao, caminho: `/guia/${g.slug}`, tipo: "article" });
  }, [g?.slug]);

  if (!g) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="bleed py-28 text-center">
          <h1 className="display-lg">Guia não encontrado</h1>
          <Link href="/guia" className="btn-ink mt-8">Ver os guias</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-sr pb-24 pt-10 md:pt-14">
        <nav aria-label="Trilha" className="text-[0.8rem] text-sr-ink-soft">
          <Link href="/" className="no-underline hover:text-sr-ink">Início</Link>
          <span className="mx-2 text-sr-nude-400">/</span>
          <Link href="/guia" className="no-underline hover:text-sr-ink">Guias</Link>
        </nav>
        <article className="mx-auto mt-8 max-w-3xl">
          <p className="eyebrow">Guia Sanrê</p>
          <h1 className="display-lg mt-4">{g.titulo}</h1>
          <p className="mt-8 border-l-2 border-sr-gold bg-white p-6 text-[1.08rem] leading-relaxed text-sr-ink">{g.resposta}</p>
          {g.secoes.map(s => (
            <section key={s.titulo} className="mt-12">
              <h2 className="display-md">{s.titulo}</h2>
              {s.paragrafos.map((p, i) => (
                <p key={i} className="mt-4 text-[1.02rem] leading-relaxed text-sr-ink">{p}</p>
              ))}
            </section>
          ))}
          <section className="mt-14">
            <h2 className="display-md">Perguntas frequentes</h2>
            <div className="mt-6 border-t border-sr-line">
              {g.faq.map(f => (
                <div key={f.pergunta} className="border-b border-sr-line py-5">
                  <h3 className="font-sans text-[1.02rem] font-medium tracking-normal">{f.pergunta}</h3>
                  <p className="mt-2 leading-relaxed text-sr-ink-soft">{f.resposta}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="mt-12 flex flex-wrap gap-3">
            {g.links.map((l, i) => (
              <Link key={l.href} href={l.href} className={i === 0 ? "btn-ink" : "btn-line"}>{l.rotulo}</Link>
            ))}
            <button onClick={() => abrirAssistente(`Li o guia "${g.titulo}" e tenho uma dúvida.`)} className="link-rule self-center">
              Perguntar à Sanrê
            </button>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
