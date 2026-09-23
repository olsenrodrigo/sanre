import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ScanFace, Camera, Repeat2, Lock, ArrowRight, Send } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import FormatoIcone from "@/components/oculos/FormatoIcone";
import { abrirAssistente } from "@/components/assistente/contexto";
import { aplicarSeo } from "@/lib/seo";
import { TIPOS, FORMATOS, slugificar } from "@/lib/oculos";
import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/lib/marca";
import { UNIDADES } from "@shared/unidades";

const IMG = "/uploads/produtos";

const FAIXAS = [
  { rotulo: "Até R$ 300", q: "max=300" },
  { rotulo: "R$ 300 a 600", q: "min=300&max=600" },
  { rotulo: "R$ 600 a 1.000", q: "min=600&max=1000" },
  { rotulo: "R$ 1.000 a 2.000", q: "min=1000&max=2000" },
  { rotulo: "Acima de R$ 2.000", q: "min=2000" },
];

const MURAL = [
  { img: "sr-vitrine-acrilico.webp", post: "DbKDAlhAL78", alt: "Óculos expostos em cubo de acrílico na loja de Ribeirão Preto" },
  { img: "sr-espelho.webp", post: "DbJ0ZG7GjUF", alt: "Cliente se olhando no espelho na inauguração da loja de Ribeirão Preto" },
  { img: "sr-flatlay.webp", post: "DbI1075uNGM", alt: "Duas armações metálicas douradas sobre granilite" },
  { img: "sr-ig-DbD3A6QhdSo.webp", post: "DbD3A6QhdSo", alt: "Campanha Ray-Ban publicada pela Sanrê" },
  { img: "sr-ig-DbEbkkXh-N8.webp", post: "DbEbkkXh-N8", alt: "Campanha Ana Hickmann Eyewear publicada pela Sanrê" },
  { img: "sr-inauguracao.webp", post: "DbLRh87OTLB", alt: "Inauguração da Sanrê na PB Arts Gallery" },
];

function useProdutos(url: string) {
  return useQuery<{ products: ProdutoCard[] }>({
    queryKey: [url],
    queryFn: () => fetch(url).then(r => r.json()),
    staleTime: 60_000,
  });
}

function Titulo({ chapeu, titulo, texto, centro = false }: { chapeu: string; titulo: string; texto?: string; centro?: boolean }) {
  return (
    <div className={centro ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{chapeu}</p>
      <h2 className={`display-lg mt-4 traco ${centro ? "traco-centro" : ""}`}>{titulo}</h2>
      {texto && <p className={`mt-6 text-[1.02rem] text-sr-ink-soft ${centro ? "mx-auto" : ""} measure`}>{texto}</p>}
    </div>
  );
}

/** Tile de tipo de óculos com a primeira peça da curadoria no pedestal. */
function TileTipo({ slug, rota, titulo, resumo }: { slug: string; rota: string; titulo: string; resumo: string }) {
  const { data } = useProdutos(`/api/store/products?tipo=${slug}&limit=1&sort=destaque`);
  const p = data?.products?.[0];
  return (
    <Link href={rota} className="group block no-underline">
      <div className="pedestal aspect-[4/3]">
        {p?.mainImage && (
          <img src={p.mainImage} alt="" loading="lazy" className="produto h-full w-full p-[12%] transition-transform duration-700 group-hover:scale-105" />
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h3 className="display-caps text-[0.95rem]">{titulo}</h3>
        <ArrowRight size={16} className="shrink-0 text-sr-nude-600 transition-transform group-hover:translate-x-1" aria-hidden />
      </div>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-sr-ink-soft">{resumo}</p>
    </Link>
  );
}

export default function Home() {
  const [pergunta, setPergunta] = useState("");
  const { data: destaques } = useProdutos("/api/store/products?featured=true&limit=8&sort=destaque");
  const { data: marcas = [] } = useQuery<{ marca: string; total: number }[]>({
    queryKey: ["/api/store/brands"],
    queryFn: () => fetch("/api/store/brands").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    aplicarSeo({
      titulo: "Óticas Sanrê | Óculos de sol, de grau e EPI em Cravinhos e Ribeirão Preto",
      descricao:
        "Ótica em Cravinhos desde 2004 e em Ribeirão Preto na PB Arts Gallery. Ray-Ban, Oakley, Prada, Gucci, Tom Ford e mais, com provador virtual, lentes de grau com receita e retirada na loja.",
      caminho: "/",
    });
  }, []);

  const perguntar = (e: React.FormEvent) => {
    e.preventDefault();
    abrirAssistente(pergunta.trim() || undefined);
    setPergunta("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="grid border-b border-sr-line lg:min-h-[calc(100vh-var(--sr-header)-2.25rem)] lg:grid-cols-[1.05fr_1fr]">
          <div className="order-2 flex flex-col justify-center px-5 py-14 md:px-12 lg:order-1 lg:px-16 xl:px-24">
            <p className="eyebrow">Cravinhos desde 2004 · Ribeirão Preto na PB Arts Gallery</p>
            <h1 className="display-hero mt-6 text-balance">Óculos escolhidos um a um, como obra de galeria.</h1>
            <p className="measure mt-7 text-[1.08rem] leading-relaxed text-sr-ink-soft">
              Grifes internacionais e marcas nacionais, de sol, de grau e de segurança. Experimente no rosto pela câmera,
              mande a receita pelo site e retire na loja mais perto de você.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/oculos-de-sol" className="btn-ink">Óculos de sol</Link>
              <Link href="/oculos-de-grau" className="btn-line">Armações de grau</Link>
            </div>
            <Link href="/provador" className="mt-8 inline-flex items-center gap-2.5 self-start text-sr-ink no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sr-gold text-sr-ink">
                <ScanFace size={17} aria-hidden />
              </span>
              <span className="nav-label border-b border-sr-ink pb-0.5">Abrir o provador virtual</span>
            </Link>
          </div>
          <div className="relative order-1 min-h-[62vh] overflow-hidden bg-sr-ink lg:order-2 lg:min-h-0">
            <img
              src={`${IMG}/sr-hero-galeria.webp`}
              alt="Óculos expostos num cubo de acrílico, como obra, na loja da Sanrê na PB Arts Gallery"
              width={1080}
              height={1350}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <p className="absolute bottom-5 left-5 bg-sr-paper/90 px-3 py-1.5 text-[0.72rem] tracking-[0.04em] text-sr-ink">
              Vitrine de acrílico · Sanrê Ribeirão Preto
            </p>
          </div>
        </section>

        {/* ── Faixa de marcas ─────────────────────────────────────────── */}
        {marcas.length > 0 && (
          <section aria-label="Marcas" className="overflow-hidden border-b border-sr-line bg-sr-paper py-6">
            <div className="marquee-track gap-14 pr-14">
              {[...marcas, ...marcas].map((m, i) => (
                <Link
                  key={`${m.marca}-${i}`}
                  href={`/marcas/${slugificar(m.marca)}`}
                  className="shrink-0 font-label text-[0.95rem] font-normal uppercase tracking-[0.32em] text-sr-ink/80 no-underline hover:text-sr-ink"
                  tabIndex={i >= marcas.length ? -1 : undefined}
                  aria-hidden={i >= marcas.length || undefined}
                >
                  {m.marca}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Por tipo ─────────────────────────────────────────────────── */}
        <section className="bleed section-padding">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Titulo chapeu="O que você procura" titulo="Sol, grau, infantil e segurança" />
            <Link href="/loja" className="link-rule">Ver todos os óculos</Link>
          </div>
          <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {TIPOS.map(t => (
              <TileTipo key={t.slug} slug={t.slug} rota={t.rota} titulo={t.titulo} resumo={t.resumo} />
            ))}
          </div>
        </section>

        {/* ── Provador ─────────────────────────────────────────────────── */}
        <section className="bg-sr-ink text-sr-paper">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[50vh] overflow-hidden">
              <img
                src={`${IMG}/sr-editorial-sol.webp`}
                alt="Mulher usando óculos de sol retangular verde"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
            </div>
            <div className="flex flex-col justify-center px-5 py-16 md:px-12 lg:px-16 xl:px-24">
              <p className="eyebrow-light">Provador virtual</p>
              <h2 className="display-lg mt-4 text-sr-paper">Veja no seu rosto antes de sair de casa.</h2>
              <p className="measure mt-6 text-sr-paper/75">
                Abra a câmera do celular ou do computador, escolha a armação e troque de modelo em um toque. O óculos
                acompanha o movimento da cabeça, no tamanho real da armação.
              </p>
              <ul className="mt-8 grid gap-4 text-[0.95rem] text-sr-paper/85 sm:grid-cols-3">
                <li className="flex gap-3 sm:flex-col sm:gap-2"><Camera size={20} className="text-sr-gold" aria-hidden />Câmera ou foto</li>
                <li className="flex gap-3 sm:flex-col sm:gap-2"><Repeat2 size={20} className="text-sr-gold" aria-hidden />Troca de modelo ao vivo</li>
                <li className="flex gap-3 sm:flex-col sm:gap-2"><Lock size={20} className="text-sr-gold" aria-hidden />Nada sai do seu aparelho</li>
              </ul>
              <div className="mt-10">
                <Link href="/provador" className="btn-gold">
                  <ScanFace size={17} aria-hidden />
                  Experimentar agora
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Curadoria ────────────────────────────────────────────────── */}
        {destaques?.products && destaques.products.length > 0 && (
          <section className="bleed section-padding">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Titulo chapeu="Curadoria Sanrê" titulo="Os que a gente colocaria na vitrine hoje" />
              <Link href="/loja" className="link-rule">Ver a loja inteira</Link>
            </div>
            <div className="grid-vitrine mt-12">
              {destaques.products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 2} />
              ))}
            </div>
          </section>
        )}

        {/* ── Por formato e por preço ──────────────────────────────────── */}
        <section className="border-y border-sr-line bg-white">
          <div className="bleed grid gap-14 py-16 lg:grid-cols-[1.5fr_1fr] lg:gap-20 lg:py-20">
            <div>
              <p className="eyebrow">Por formato</p>
              <div className="mt-6 grid grid-cols-3 gap-px bg-sr-line sm:grid-cols-4">
                {["aviador", "redondo", "quadrado", "retangular", "gatinho", "hexagonal", "oval", "esportivo"].map(fm => (
                  <Link
                    key={fm}
                    href={`/loja?formato=${fm}`}
                    className="group flex flex-col items-center gap-3 bg-white px-3 py-6 text-sr-ink no-underline hover:bg-sr-paper"
                  >
                    <FormatoIcone formato={fm} className="h-7 w-20 transition-transform group-hover:scale-110" />
                    <span className="text-[0.85rem]">{FORMATOS[fm]}</span>
                  </Link>
                ))}
              </div>
              <Link href="/formato-do-rosto" className="link-rule mt-7">Qual formato combina com o meu rosto</Link>
            </div>
            <div>
              <p className="eyebrow">Por faixa de preço</p>
              <ul className="mt-6 border-t border-sr-line">
                {FAIXAS.map(f => (
                  <li key={f.rotulo} className="border-b border-sr-line">
                    <Link href={`/loja?${f.q}`} className="group flex items-center justify-between py-4 text-sr-ink no-underline">
                      <span className="font-display text-[1.25rem] font-light">{f.rotulo}</span>
                      <ArrowRight size={16} className="text-sr-nude-600 transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[0.88rem] text-sr-ink-soft">Todos com PIX 5% menor e até 10x sem juros no cartão.</p>
            </div>
          </div>
        </section>

        {/* ── Lentes de grau ───────────────────────────────────────────── */}
        <section className="bleed section-padding">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <Titulo
              chapeu="Óculos de grau pelo site"
              titulo="A armação você escolhe aqui. As lentes, a consultora monta com a sua receita."
              texto="Trabalhamos com lentes Varilux e Zeiss, entre outras. Nada é cobrado antes de você aprovar o orçamento."
            />
            <ol className="grid gap-px bg-sr-line sm:grid-cols-3">
              {[
                ["01", "Escolha a armação", "Filtre por formato, marca e preço. Experimente no provador."],
                ["02", "Envie a receita", "Foto ou PDF, pelo site. Se ainda não tem, a gente espera."],
                ["03", "Aprove o orçamento", "A consultora confere a receita e manda lentes e valores no WhatsApp."],
              ].map(([n, t, d]) => (
                <li key={n} className="bg-sr-paper p-7">
                  <span className="font-label text-[0.8rem] tracking-[0.2em] text-sr-gold-700">{n}</span>
                  <h3 className="mt-4 font-display text-[1.2rem] font-normal">{t}</h3>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-sr-ink-soft">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-10 flex flex-wrap gap-3 lg:justify-end">
            <Link href="/lentes-de-grau" className="btn-ink">Como funciona</Link>
            <Link href="/oculos-de-grau" className="btn-line">Ver armações</Link>
          </div>
        </section>

        {/* ── Duas lojas ───────────────────────────────────────────────── */}
        <section className="border-t border-sr-line bg-sr-sand">
          <div className="bleed section-padding">
            <Titulo chapeu="Nossas lojas" titulo="Duas cidades, o mesmo cuidado" centro />
            <div className="mt-14 grid gap-10 md:grid-cols-2">
              {UNIDADES.map(u => (
                <article key={u.slug} className="bg-sr-paper">
                  <div className="plate aspect-[4/3]">
                    <img src={u.foto} alt={`Loja Sanrê ${u.cidade}`} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-7 md:p-9">
                    <p className="eyebrow">{u.destaque}</p>
                    <h3 className="display-caps mt-3 text-[1.35rem]">{u.cidade}</h3>
                    <p className="mt-4 text-[0.95rem] leading-relaxed text-sr-ink-soft">{u.resumo}</p>
                    <p className="mt-5 text-[0.95rem] text-sr-ink">
                      {u.logradouro}
                      {u.complemento ? ` · ${u.complemento}` : ""}
                      <br />
                      {u.bairro} · {u.cidade}/{u.uf}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                      <Link href={`/unidades/${u.slug}`} className="link-rule">Conhecer a loja</Link>
                      <a href={u.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-rule">Como chegar</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pergunte à Sanrê ─────────────────────────────────────────── */}
        <section className="bg-sr-ink text-sr-paper">
          <div className="bleed grid gap-10 py-16 md:py-20 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="eyebrow-light">Atendimento na hora</p>
              <h2 className="display-lg mt-4 text-sr-paper">Pergunte à Sanrê.</h2>
              <p className="measure mt-5 text-sr-paper/75">
                Preço, marca, prazo, qual loja tem o modelo, como mandar a receita. A assistente responde aqui ou no
                WhatsApp, e chama uma consultora quando a conversa pede.
              </p>
            </div>
            <form onSubmit={perguntar} className="w-full">
              <label htmlFor="pergunta-home" className="sr-only">Sua pergunta</label>
              <div className="flex items-center border border-sr-paper/30 bg-sr-paper/5 focus-within:border-sr-paper">
                <input
                  id="pergunta-home"
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  maxLength={800}
                  placeholder="Ex.: vocês têm Ray-Ban aviador polarizado em Ribeirão?"
                  className="min-w-0 flex-1 bg-transparent px-5 py-4 text-[1rem] text-sr-paper outline-none placeholder:text-sr-paper/45"
                />
                <button type="submit" className="flex h-14 w-14 shrink-0 items-center justify-center bg-sr-paper text-sr-ink hover:bg-white" aria-label="Enviar pergunta">
                  <Send size={18} aria-hidden />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Quais marcas vocês têm?", "Como envio minha receita?", "Onde fica a loja de Ribeirão?", "Tem EPI com grau?"].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => abrirAssistente(s)}
                    className="border border-sr-paper/25 px-3 py-1.5 text-[0.82rem] text-sr-paper/85 hover:border-sr-paper hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        {/* ── Empresas ─────────────────────────────────────────────────── */}
        <section className="bleed section-padding">
          <div className="grid items-center gap-12 border border-sr-line bg-white p-8 md:p-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="eyebrow">Para empresas</p>
              <h2 className="display-md mt-4">Óculos de segurança com CA — inclusive com lente de grau para quem precisa.</h2>
              <p className="measure mt-5 text-sr-ink-soft">
                Atendemos indústrias, usinas, construtoras e laboratórios da região: medição, receitas dos colaboradores
                e entrega, com condições para contrato corporativo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/empresas" className="btn-ink">Atendimento para empresas</Link>
              <Link href="/epi" className="btn-line">Ver EPIs</Link>
            </div>
          </div>
        </section>

        {/* ── Mural ────────────────────────────────────────────────────── */}
        <section className="border-t border-sr-line py-16 md:py-20">
          <div className="bleed flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">No Instagram</p>
              <h2 className="display-md mt-3">{INSTAGRAM_HANDLE}</h2>
            </div>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="link-rule">Seguir a Sanrê</a>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px bg-sr-line sm:grid-cols-3 lg:grid-cols-6">
            {MURAL.map(m => (
              <a
                key={m.post}
                href={`https://www.instagram.com/p/${m.post}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="plate group block aspect-square"
              >
                <img src={`${IMG}/${m.img}`} alt={m.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </a>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
