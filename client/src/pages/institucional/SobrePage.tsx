import { useEffect } from "react";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { aplicarSeo } from "@/lib/seo";
import { UNIDADES } from "@shared/unidades";

const IMG = "/uploads/produtos";

/**
 * Sobre. Fonte do texto: site atual (oticasanre.com.br/sobre), Receita Federal
 * e Instagram. Missão, visão e valores são os publicados pela própria loja.
 */
export default function SobrePage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Sobre a Óticas Sanrê",
      descricao:
        "Fundada em 17 de dezembro de 2004 em Cravinhos, a Sanrê é referência em atendimento personalizado. Em 2026 abriu a segunda loja, em Ribeirão Preto, dentro da PB Arts Gallery.",
      caminho: "/sobre",
      imagem: `${IMG}/sr-loja-cravinhos.webp`,
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bleed pb-14 pt-12 md:pt-20">
          <p className="eyebrow">Desde 2004</p>
          <h1 className="display-hero mt-5 max-w-4xl text-balance">Duas décadas cuidando de como Cravinhos enxerga.</h1>
        </section>

        <section className="grid border-y border-sr-line lg:grid-cols-2">
          <div className="plate min-h-[48vh]">
            <img src={`${IMG}/sr-loja-cravinhos.webp`} alt="Atendimento na loja da Sanrê em Cravinhos" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="px-5 py-14 md:px-12 lg:px-16 lg:py-20">
            <div className="measure space-y-5 text-[1.05rem] leading-relaxed">
              <p>
                A Sanrê abriu as portas em <strong className="font-medium">17 de dezembro de 2004</strong>, no centro de Cravinhos,
                fundada por Regiane Thomazello, técnica óptica. De lá para cá, virou a ótica de famílias inteiras: gente que fez
                o primeiro óculos aqui e hoje traz os filhos.
              </p>
              <p>
                O trabalho é o mesmo desde o começo: orientação completa na escolha de óculos de grau, solares e lentes de
                contato, com foco no conforto, no estilo e na necessidade de cada cliente — e com as marcas nacionais e
                internacionais que a loja escolhe uma a uma.
              </p>
              <p>
                Em <strong className="font-medium">23 de julho de 2026</strong>, a Sanrê abriu a segunda loja, em Ribeirão Preto,
                dentro da PB Arts Gallery. Os óculos ficam expostos em cubos de acrílico, como obra — e o atendimento continua
                sendo com hora marcada, café e tempo para experimentar.
              </p>
            </div>
          </div>
        </section>

        <section className="bleed section-padding">
          <div className="grid gap-px bg-sr-line md:grid-cols-3">
            {[
              ["Missão", "Proporcionar saúde visual com excelência, conforto e estilo."],
              ["Visão", "Ser referência regional em qualidade óptica e atendimento personalizado."],
              ["Valores", "Ética, confiança, inovação e cuidado com o cliente."],
            ].map(([t, d]) => (
              <div key={t} className="bg-sr-paper p-8">
                <p className="eyebrow">{t}</p>
                <p className="mt-4 font-display text-[1.3rem] font-light leading-snug">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid border-t border-sr-line lg:grid-cols-3">
          {[
            [`${IMG}/sr-vitrine-acrilico.webp`, "Vitrine de acrílico na loja de Ribeirão Preto"],
            [`${IMG}/sr-pbarts.webp`, "Totem da PB Arts Gallery com a marca Sanrê"],
            [`${IMG}/sr-inauguracao.webp`, "Inauguração da loja de Ribeirão Preto"],
          ].map(([src, alt]) => (
            <div key={src} className="plate aspect-[4/3]">
              <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
            </div>
          ))}
        </section>

        <section className="bleed section-padding text-center">
          <h2 className="display-md">Venha conhecer</h2>
          <p className="mx-auto mt-4 max-w-xl text-sr-ink-soft">
            {UNIDADES.map(u => `${u.cidade}: ${u.logradouro}`).join(" · ")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/unidades" className="btn-ink">Ver as lojas</Link>
            <Link href="/loja" className="btn-line">Ver os óculos</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
