import { useEffect } from "react";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { aplicarSeo } from "@/lib/seo";

/** /tamanho-do-oculos — como ler os números da haste (substitui o guia de medidas de roupa). */
export default function TamanhoOculosPage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Como saber o tamanho do óculos",
      descricao: "O que significam os números gravados na haste (ex.: 52□18 140), como comparar com o óculos que você já usa e como escolher a armação do tamanho certo.",
      caminho: "/tamanho-do-oculos",
    });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-sr pb-24 pt-12 md:pt-16">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow">Guia Sanrê</p>
          <h1 className="display-lg mt-4">Como saber o tamanho do óculos</h1>
          <p className="mt-8 border-l-2 border-sr-gold bg-white p-6 text-[1.08rem] leading-relaxed">
            Olhe a parte interna da haste do óculos que você já usa: há três números, como <strong className="dado font-medium">52□18 140</strong>.
            São, em milímetros, a largura de cada lente (52), a ponte entre as lentes (18) e o comprimento da haste (140).
            Toda página de produto da Sanrê mostra os mesmos três números — compare e escolha uma armação com até 2 ou 3 mm de diferença na lente.
          </p>

          <figure className="mt-12 border border-sr-line bg-white p-6">
            <svg viewBox="0 0 360 130" className="w-full text-sr-ink" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <rect x="20" y="30" width="120" height="70" rx="20" />
              <rect x="210" y="30" width="120" height="70" rx="20" />
              <path d="M140 52c14-14 56-14 70 0" />
              <path d="M330 45h26" />
              <g stroke="#998f7c" strokeDasharray="3 3">
                <path d="M20 118h120M20 113v10M140 113v10" />
                <path d="M146 16h58M146 11v10M204 11v10" />
              </g>
              <g fill="#6f6757" stroke="none" fontFamily="Montserrat, sans-serif" fontSize="12">
                <text x="80" y="112" textAnchor="middle">lente 52</text>
                <text x="175" y="11" textAnchor="middle">ponte 18</text>
                <text x="300" y="30" textAnchor="middle">haste 140</text>
              </g>
            </svg>
            <figcaption className="mt-3 text-[0.88rem] text-sr-ink-soft">Os três números da haste, em milímetros.</figcaption>
          </figure>

          <section className="mt-12">
            <h2 className="display-md">Referência de tamanho de lente</h2>
            <table className="mt-5 w-full border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-sr-ink text-left">
                  <th className="py-2 font-medium">Lente</th>
                  <th className="py-2 font-medium">Costuma servir em</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-sr-line"><td className="py-2.5 dado">até 50 mm</td><td>rostos estreitos e crianças maiores</td></tr>
                <tr className="border-b border-sr-line"><td className="py-2.5 dado">51 a 54 mm</td><td>a maioria dos adultos</td></tr>
                <tr className="border-b border-sr-line"><td className="py-2.5 dado">55 mm ou mais</td><td>rostos largos e modelos oversized (muito comum em sol)</td></tr>
              </tbody>
            </table>
            <p className="mt-4 text-[0.92rem] text-sr-ink-soft">
              Óculos de sol costumam ser maiores que armações de grau. Para grau, a altura da lente também importa — especialmente em multifocais, e isso a consultora confere com você.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="display-md">Sem óculos para comparar?</h2>
            <p className="mt-4 leading-relaxed">
              Use o provador virtual: ele desenha a armação no seu rosto na escala das medidas do modelo. Ou passe numa das lojas — o ajuste de armação é gratuito.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/provador" className="btn-ink">Abrir o provador</Link>
              <Link href="/unidades" className="btn-line">Ver as lojas</Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
