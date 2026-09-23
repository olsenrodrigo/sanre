import { useEffect, useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ScanFace } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard, { type ProdutoCard } from "@/components/store/ProductCard";
import FormatoIcone from "@/components/oculos/FormatoIcone";
import { aplicarSeo } from "@/lib/seo";
import { FORMATOS } from "@/lib/oculos";

interface Rosto {
  slug: string;
  nome: string;
  como: string;
  formatos: string[];
  porque: string;
  contorno: string;
}

/** Contornos em viewBox 60×80. Referência de equilíbrio, não regra. */
const ROSTOS: Rosto[] = [
  {
    slug: "redondo",
    nome: "Redondo",
    como: "Largura e altura parecidas, maçãs cheias, maxilar suave.",
    formatos: ["quadrado", "retangular", "hexagonal", "geometrico"],
    porque: "Ângulos retos dão estrutura e alongam o rosto.",
    contorno: "M30 8c14 0 24 12 24 30s-10 34-24 34S6 56 6 38 16 8 30 8z",
  },
  {
    slug: "quadrado",
    nome: "Quadrado",
    como: "Testa e maxilar largos, linhas retas.",
    formatos: ["redondo", "oval", "aviador", "gatinho"],
    porque: "Curvas suavizam os ângulos do maxilar.",
    contorno: "M10 10h40c2 0 4 2 4 4v38c0 12-10 20-24 20S6 64 6 52V14c0-2 2-4 4-4z",
  },
  {
    slug: "oval",
    nome: "Oval",
    como: "Um pouco mais comprido que largo, maçãs levemente mais largas.",
    formatos: ["quadrado", "aviador", "gatinho", "redondo", "retangular"],
    porque: "Aceita quase tudo — cuide da proporção com a largura do rosto.",
    contorno: "M30 6c13 0 22 13 22 32 0 20-10 36-22 36S8 58 8 38 17 6 30 6z",
  },
  {
    slug: "coracao",
    nome: "Coração",
    como: "Testa larga, queixo fino.",
    formatos: ["aviador", "redondo", "oval", "browline"],
    porque: "Armações mais leves embaixo equilibram a testa.",
    contorno: "M8 16c0-6 8-10 22-10s22 4 22 10c0 18-6 34-22 56C14 50 8 34 8 16z",
  },
  {
    slug: "alongado",
    nome: "Alongado",
    como: "Bem mais comprido que largo.",
    formatos: ["quadrado", "redondo", "mascara", "browline"],
    porque: "Mais altura de lente e detalhe nas laterais encurtam visualmente.",
    contorno: "M30 4c11 0 18 8 18 20v30c0 12-8 22-18 22S12 66 12 54V24C12 12 19 4 30 4z",
  },
  {
    slug: "diamante",
    nome: "Diamante",
    como: "Maçãs largas, testa e queixo estreitos.",
    formatos: ["gatinho", "oval", "browline", "redondo"],
    porque: "Destacar a linha da sobrancelha equilibra as maçãs.",
    contorno: "M30 6l16 16 6 16-6 18-16 18-16-18-6-18 6-16z",
  },
];

export default function FormatoRostoPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const inicial = new URLSearchParams(search).get("rosto");
  const [escolhido, setEscolhido] = useState<string | null>(inicial);
  const rosto = ROSTOS.find(r => r.slug === escolhido);

  const url = rosto ? `/api/store/products?formato=${rosto.formatos.join(",")}&limit=8&sort=destaque` : null;
  const { data } = useQuery<{ products: ProdutoCard[]; total: number }>({
    queryKey: [url],
    queryFn: () => fetch(url!).then(r => r.json()),
    enabled: !!url,
  });

  useEffect(() => {
    aplicarSeo({
      titulo: "Qual armação combina com o formato do seu rosto",
      descricao: "Escolha o formato do seu rosto — redondo, quadrado, oval, coração, alongado ou diamante — e veja os formatos de armação que costumam equilibrar cada um.",
      caminho: "/formato-do-rosto",
    });
  }, []);

  const escolher = (slug: string) => {
    setEscolhido(slug);
    navigate(`/formato-do-rosto?rosto=${slug}`, { replace: true });
    setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed pb-12 pt-12 md:pt-16">
          <p className="eyebrow">Guia de formato</p>
          <h1 className="display-lg mt-4 traco">Qual armação combina com o seu rosto</h1>
          <p className="measure mt-6 text-sr-ink-soft">
            Escolha o desenho mais parecido com o seu rosto. A sugestão é uma referência de equilíbrio — estilo pessoal
            vale tanto quanto geometria. Na dúvida, experimente no provador.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-px bg-sr-line sm:grid-cols-3 lg:grid-cols-6">
            {ROSTOS.map(r => {
              const ativo = r.slug === escolhido;
              return (
                <button
                  key={r.slug}
                  onClick={() => escolher(r.slug)}
                  aria-pressed={ativo}
                  className={`flex flex-col items-center gap-4 px-4 py-8 text-center transition-colors ${ativo ? "bg-sr-ink text-sr-paper" : "bg-sr-paper text-sr-ink hover:bg-white"}`}
                >
                  <svg viewBox="0 0 60 80" className="h-24 w-20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                    <path d={r.contorno} />
                    <path d="M22 36h5M33 36h5M28 50c1.5 1 2.5 1 4 0" strokeLinecap="round" />
                  </svg>
                  <span className="display-caps text-[0.85rem]">{r.nome}</span>
                  <span className={`text-[0.8rem] leading-snug ${ativo ? "text-sr-paper/75" : "text-sr-ink-soft"}`}>{r.como}</span>
                </button>
              );
            })}
          </div>
        </section>

        {rosto && (
          <section id="resultado" className="scroll-mt-32 border-t border-sr-line bg-white">
            <div className="bleed py-14">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
                <div>
                  <p className="eyebrow">Rosto {rosto.nome.toLowerCase()}</p>
                  <h2 className="display-md mt-3">{rosto.porque}</h2>
                  <Link href="/provador" className="btn-gold mt-8">
                    <ScanFace size={17} aria-hidden /> Ver no meu rosto
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-px bg-sr-line sm:grid-cols-4">
                  {rosto.formatos.map(fm => (
                    <Link key={fm} href={`/loja?formato=${fm}`} className="flex flex-col items-center gap-3 bg-white px-3 py-6 text-sr-ink no-underline hover:bg-sr-paper">
                      <FormatoIcone formato={fm} className="h-7 w-20" />
                      <span className="text-[0.9rem]">{FORMATOS[fm] ?? fm}</span>
                    </Link>
                  ))}
                </div>
              </div>
              {data?.products && data.products.length > 0 && (
                <>
                  <div className="grid-vitrine mt-14">
                    {data.products.map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                  <Link href={`/loja?formato=${rosto.formatos.join(",")}`} className="link-rule mt-10">
                    Ver todos os {data.total} modelos nesses formatos
                  </Link>
                </>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
