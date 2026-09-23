import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle, Clock } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import { aplicarSeo } from "@/lib/seo";
import { WHATSAPP_LABEL } from "@/lib/marca";
import { UNIDADES, unidadePorSlug, enderecoCompleto, linkWhatsapp, type Unidade } from "@shared/unidades";

function Horario({ u }: { u: Unidade }) {
  if (!u.horarioConfirmado) {
    return (
      <p className="text-[0.95rem] text-sr-ink-soft">
        Confirme o horário de hoje pelo WhatsApp {WHATSAPP_LABEL} — atendemos também com hora marcada.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-[0.95rem]">
      {u.horario.map(h => (
        <li key={h.dias} className="flex justify-between gap-6 border-b border-sr-line py-1.5">
          <span>{h.dias}</span>
          <span className="dado">{h.abre}–{h.fecha}</span>
        </li>
      ))}
    </ul>
  );
}

/** /unidades — as duas lojas. */
export function UnidadesPage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Lojas em Cravinhos e Ribeirão Preto",
      descricao: "Endereços da Óticas Sanrê: Rua XV de Novembro, 662A, em Cravinhos, e Rua Altino Arantes, 811, em Ribeirão Preto, anexa à PB Arts Gallery.",
      caminho: "/unidades",
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bleed pb-24 pt-12 md:pt-16">
        <p className="eyebrow">Nossas lojas</p>
        <h1 className="display-lg mt-4 traco">Cravinhos e Ribeirão Preto</h1>
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          {UNIDADES.map(u => (
            <article key={u.slug} className="border border-sr-line bg-white">
              <div className="plate aspect-[4/3]">
                <img src={u.foto} alt={`Loja Sanrê ${u.cidade}`} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-7 md:p-9">
                <p className="eyebrow">{u.destaque}</p>
                <h2 className="display-caps mt-3 text-[1.3rem]">{u.cidade}</h2>
                <p className="mt-4 text-sr-ink-soft">{u.resumo}</p>
                <p className="mt-5 flex gap-3 text-[0.95rem]"><MapPin size={18} className="mt-0.5 shrink-0 text-sr-nude-600" aria-hidden />{enderecoCompleto(u)}{u.complemento ? ` (${u.complemento})` : ""}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={`/unidades/${u.slug}`} className="btn-ink">Ver a loja</Link>
                  <a href={u.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-line">Como chegar</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** /unidades/:slug — página local da loja (SEO local; JSON-LD Optician vem do servidor). */
export function UnidadePage() {
  const { slug } = useParams<{ slug: string }>();
  const u = unidadePorSlug(slug);
  const { data } = useQuery<{ products: ProdutoCard[] }>({
    queryKey: ["unidade-produtos", slug],
    queryFn: () => fetch(`/api/store/products?unidade=${slug}&limit=8&sort=destaque`).then(r => r.json()),
    enabled: !!u,
  });

  useEffect(() => {
    if (!u) return;
    aplicarSeo({
      titulo: `Ótica em ${u.cidade} — Sanrê ${u.cidade}`,
      descricao: `${u.resumo} ${enderecoCompleto(u)}.`.slice(0, 300),
      caminho: `/unidades/${u.slug}`,
      imagem: u.foto,
    });
  }, [u?.slug]);

  if (!u) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="bleed py-28 text-center">
          <h1 className="display-lg">Loja não encontrada</h1>
          <Link href="/unidades" className="btn-ink mt-8">Ver nossas lojas</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const outra = UNIDADES.find(x => x.slug !== u.slug)!;
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="grid border-b border-sr-line lg:grid-cols-2">
          <div className="plate min-h-[45vh]">
            <img src={u.foto} alt={`Loja Sanrê ${u.cidade}`} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="px-5 py-12 md:px-12 lg:px-16 lg:py-20">
            <nav aria-label="Trilha" className="text-[0.8rem] text-sr-ink-soft">
              <Link href="/" className="no-underline hover:text-sr-ink">Início</Link>
              <span className="mx-2 text-sr-nude-400">/</span>
              <Link href="/unidades" className="no-underline hover:text-sr-ink">Lojas</Link>
            </nav>
            <p className="eyebrow mt-8">{u.destaque}</p>
            <h1 className="display-lg mt-4">Sanrê {u.cidade}</h1>
            <p className="measure mt-6 text-[1.05rem] text-sr-ink-soft">{u.resumo}</p>
            <dl className="mt-9 space-y-6">
              <div>
                <dt className="nav-label flex items-center gap-2"><MapPin size={15} aria-hidden /> Endereço</dt>
                <dd className="mt-2 text-[0.98rem]">{u.logradouro}{u.complemento ? ` — ${u.complemento}` : ""}<br />{u.bairro}, {u.cidade}/{u.uf} · CEP {u.cep}</dd>
              </div>
              <div>
                <dt className="nav-label flex items-center gap-2"><Clock size={15} aria-hidden /> Horário</dt>
                <dd className="mt-2"><Horario u={u} /></dd>
              </div>
            </dl>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={u.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-ink">Como chegar</a>
              <a
                href={linkWhatsapp(`Olá! Vim pelo site da Sanrê e queria atendimento na loja de ${u.cidade}.`, u.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whats"
              >
                <MessageCircle size={16} aria-hidden /> WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="bleed section-padding">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              ["Retirada grátis", `Compre pelo site e retire na loja de ${u.cidade}, sem frete.`],
              ["Lentes de grau", "Traga a receita ou envie pelo site. A consultora monta o orçamento com você."],
              ["Ajuste e manutenção", "Ajuste de armação e troca de plaquetas para clientes Sanrê."],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-sr-ink pt-5">
                <h2 className="display-caps text-[0.95rem]">{t}</h2>
                <p className="mt-3 text-[0.95rem] text-sr-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {data?.products && data.products.length > 0 && (
          <section className="border-t border-sr-line py-16">
            <div className="bleed">
              <p className="eyebrow">Pronta entrega</p>
              <h2 className="display-md mt-3">Na loja de {u.cidade} agora</h2>
              <div className="grid-vitrine mt-10">
                {data.products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
              <Link href={`/loja?unidade=${u.slug}`} className="link-rule mt-10">Ver tudo com retirada em {u.cidade}</Link>
            </div>
          </section>
        )}

        <section className="border-t border-sr-line bg-sr-sand">
          <div className="bleed flex flex-wrap items-center justify-between gap-6 py-12">
            <p className="text-[1.05rem]">Também estamos em <strong className="font-medium">{outra.cidade}</strong>: {outra.logradouro}.</p>
            <Link href={`/unidades/${outra.slug}`} className="link-rule">Ver a loja de {outra.cidade}</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
