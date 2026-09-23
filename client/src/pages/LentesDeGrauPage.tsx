/**
 * /lentes-de-grau — como funciona o orçamento de lentes com receita.
 *
 * Página informativa. Decreto 24.492/1934, art. 13: a ótica não indica lente
 * sem receita — então aqui os tipos de lente e os tratamentos são explicados,
 * nunca recomendados. Quem define a lente é a consultora, com a receita.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FluxoGrau from "@/components/grau/FluxoGrau";
import { TRATAMENTOS } from "@/components/grau/regras";
import { aplicarSeo } from "@/lib/seo";
import { whatsappCom } from "@/lib/marca";

const PASSOS = [
  {
    titulo: "Escolha a armação",
    texto: "Na vitrine de grau do site ou numa das lojas. Ainda não escolheu? Dá para pedir o orçamento só das lentes e decidir a armação depois.",
  },
  {
    titulo: "Envie a receita",
    texto: "Foto ou PDF, pelo site ou pelo WhatsApp. Se ainda vai ao oftalmologista, faça o pedido agora e mande a receita quando tiver.",
  },
  {
    titulo: "A consultora confirma o orçamento",
    texto: "Ela confere a receita, define a lente adequada e manda valor e prazo pelo WhatsApp. Nada é cobrado antes — você só paga se aprovar.",
  },
];

const TIPOS_LENTE = [
  {
    nome: "Visão simples",
    texto: "Um único grau em toda a lente — para longe ou para perto. É a lente mais comum.",
  },
  {
    nome: "Multifocal",
    texto: "Longe, meia distância e perto na mesma lente, sem linha aparente. A adaptação costuma levar alguns dias.",
  },
  {
    nome: "Ocupacional",
    texto: "Feita para as distâncias curtas e médias do dia de trabalho: mesa, computador, conversa do outro lado da mesa.",
  },
];

const PERGUNTAS = [
  {
    p: "Minha receita tem validade?",
    r: "Tem. A validade costuma vir escrita pelo médico na própria receita. A consultora confere a data quando recebe; se estiver vencida, ela avisa antes de qualquer orçamento.",
  },
  {
    p: "Vocês aceitam receita de optometrista?",
    r: "A loja confere caso a caso. Envie a receita que você tem e a consultora te responde pelo WhatsApp.",
  },
  {
    p: "Quanto tempo o laboratório leva para fazer as lentes?",
    r: "Depende da lente e dos tratamentos. O prazo é informado no orçamento, antes de você aprovar.",
  },
  {
    p: "Pago alguma coisa para pedir o orçamento?",
    r: "Não. Nada é cobrado antes de a consultora conferir a receita e você aprovar o orçamento.",
  },
  {
    p: "O site escolhe a lente para mim?",
    r: "Não. Você conta como vai usar os óculos e quais tratamentos gostaria de ver; a indicação técnica da lente é feita pela consultora, com a receita em mãos.",
  },
  {
    p: "O que acontece com a foto da minha receita?",
    r: "Ela fica numa área restrita, que só a equipe da loja acessa, e é apagada automaticamente em até 90 dias. A receita só é usada para o seu orçamento.",
  },
];

export default function LentesDeGrauPage() {
  const [fluxoAberto, setFluxoAberto] = useState(false);

  useEffect(() => {
    aplicarSeo({
      titulo: "Lentes de grau com receita",
      descricao:
        "Escolha a armação, envie a foto da receita e receba pelo WhatsApp o orçamento conferido pela consultora da Óticas Sanrê. Nada é cobrado antes.",
      caminho: "/lentes-de-grau",
    });
  }, []);

  const abrir = () => setFluxoAberto(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* ── Abertura ── */}
        <section className="bleed border-b border-sr-line">
          <div className="grid gap-10 py-14 md:grid-cols-12 md:items-center md:gap-8 md:py-20">
            <div className="md:col-span-7">
              <p className="eyebrow">Lentes de grau</p>
              <h1 className="display-hero mt-5 text-balance">Sua armação, com a lente certa para a sua receita</h1>
              <p className="mt-6 max-w-xl text-[1.125rem] text-sr-ink-soft">
                Escolha a armação, envie a foto da receita e receba o orçamento pelo WhatsApp. A consultora confere a receita
                antes de qualquer valor, e nada é cobrado antes dessa conferência.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={abrir} className="btn-ink">
                  Pedir orçamento
                </button>
                <Link href="/oculos-de-grau" className="btn-line no-underline">
                  Escolher armação
                </Link>
              </div>
            </div>
            <div className="md:col-span-5 lg:col-span-4 lg:col-start-9">
              <div className="plate aspect-[5/4] md:aspect-[4/5]">
                <img
                  src="/uploads/produtos/sr-flatlay.webp"
                  alt="Duas armações metálicas sobre fundo claro"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section className="bleed section-padding" aria-labelledby="como-funciona">
          <p className="eyebrow">Como funciona</p>
          <h2 id="como-funciona" className="display-lg traco mt-4 max-w-2xl text-balance">
            Três passos, e a conferência fica com quem entende
          </h2>
          <ol className="mt-12 grid gap-px bg-sr-line md:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="bg-sr-paper pb-8 pt-6 md:pr-10 md:pt-8 md:[&:not(:first-child)]:pl-10">
                <span className="dado font-display text-4xl font-light text-sr-nude-600">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-5 font-display text-xl font-normal">{passo.titulo}</h3>
                <p className="mt-3 max-w-sm text-sr-ink-soft">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Tipos de lente ── */}
        <section className="bg-sand" aria-labelledby="tipos-lente">
          <div className="bleed section-padding grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Tipos de lente</p>
              <h2 id="tipos-lente" className="display-lg traco mt-4 text-balance">
                O que cada lente faz
              </h2>
              <p className="mt-8 max-w-sm text-sr-ink-soft">
                Para você chegar ao orçamento sabendo do que se trata. Qual delas é a sua quem define é a consultora, a partir
                da receita — a legislação das óticas não permite indicar lente sem ela.
              </p>
            </div>
            <dl className="lg:col-span-7 lg:col-start-6">
              {TIPOS_LENTE.map(t => (
                <div key={t.nome} className="grid gap-2 border-t border-sr-nude-300 py-7 md:grid-cols-[14rem_1fr] md:gap-8">
                  <dt className="font-display text-xl font-normal">{t.nome}</dt>
                  <dd className="text-sr-ink-soft">{t.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Tratamentos ── */}
        <section className="bleed section-padding" aria-labelledby="tratamentos">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Tratamentos</p>
              <h2 id="tratamentos" className="display-lg traco mt-4 text-balance">
                O que dá para acrescentar à lente
              </h2>
              <p className="mt-8 max-w-sm text-sr-ink-soft">
                No pedido de orçamento você marca o que gostaria de ver. A consultora confere com a receita o que faz sentido
                e mostra as opções com o valor de cada uma.
              </p>
            </div>
            <ul className="grid gap-px bg-sr-line sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
              {TRATAMENTOS.map(t => (
                <li key={t.valor} className="bg-sr-paper py-7 sm:pr-8 sm:[&:nth-child(even)]:pl-8">
                  <h3 className="font-display text-lg font-normal">{t.titulo}</h3>
                  <p className="mt-2 text-sr-ink-soft">{t.nota}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Marcas de lente ── */}
        <section className="bleed border-y border-sr-line py-14 md:py-16" aria-labelledby="marcas-lente">
          <div className="grid gap-8 md:grid-cols-12 md:items-center">
            <div className="md:col-span-5">
              <p className="eyebrow">Marcas de lente</p>
              <h2 id="marcas-lente" className="display-md mt-4">
                Trabalhamos com Varilux e Zeiss
              </h2>
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <p className="flex flex-wrap items-baseline gap-x-10 gap-y-2 font-display text-3xl font-light uppercase tracking-[0.2em] text-sr-ink md:text-4xl">
                <span>Varilux</span>
                <span>Zeiss</span>
              </p>
              <p className="mt-5 text-sr-ink-soft">
                A consultora apresenta no orçamento as opções disponíveis para a sua receita.
              </p>
            </div>
          </div>
        </section>

        {/* ── Perguntas frequentes ── */}
        <section className="bleed section-padding" aria-labelledby="perguntas">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Perguntas frequentes</p>
              <h2 id="perguntas" className="display-lg traco mt-4 text-balance">
                Antes de pedir o orçamento
              </h2>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              {PERGUNTAS.map(q => (
                <details key={q.p} className="group border-t border-sr-line last:border-b">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-medium text-sr-ink [&::-webkit-details-marker]:hidden">
                    {q.p}
                    <span aria-hidden className="relative h-3.5 w-3.5 shrink-0">
                      <span className="absolute left-0 top-1/2 h-px w-full bg-sr-ink" />
                      <span className="absolute left-1/2 top-0 h-full w-px bg-sr-ink transition-transform group-open:scale-y-0" />
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-6 text-sr-ink-soft">{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fechamento ── */}
        <section className="bg-ink text-sr-paper">
          <div className="bleed grid gap-10 py-16 md:grid-cols-12 md:items-end md:py-24">
            <div className="md:col-span-7">
              <p className="eyebrow-light">Receita em mãos?</p>
              <h2 className="display-lg mt-4 max-w-2xl text-balance text-sr-paper">
                Peça o orçamento agora. A resposta chega pelo WhatsApp.
              </h2>
            </div>
            <div className="flex flex-col gap-3 md:col-span-4 md:col-start-9">
              <button type="button" onClick={abrir} className="btn-light">
                Pedir orçamento
              </button>
              <Link href="/oculos-de-grau" className="btn-light-line no-underline">
                Escolher armação <ArrowRight size={14} aria-hidden />
              </Link>
              <a
                href={whatsappCom("Olá! Vim pelo site da Sanrê e tenho uma dúvida sobre lentes de grau.")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-center text-[0.95rem] text-sr-paper/80 underline underline-offset-4 hover:text-sr-paper"
              >
                Prefere perguntar antes? Fale no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FluxoGrau aberto={fluxoAberto} onFechar={() => setFluxoAberto(false)} produto={null} />
    </div>
  );
}
