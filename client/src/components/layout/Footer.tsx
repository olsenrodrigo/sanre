import { Link } from "wouter";
import Logo from "@/components/brand/Logo";
import {
  WHATSAPP_LABEL,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  FACEBOOK_URL,
  EMAIL,
  RAZAO_SOCIAL,
  CNPJ,
  whatsappCom,
} from "@/lib/marca";
import { TIPOS } from "@/lib/oculos";
import { UNIDADES } from "@shared/unidades";

const NA_SANRE = [
  { href: "/provador", label: "Provador virtual" },
  { href: "/lentes-de-grau", label: "Lentes de grau com receita" },
  { href: "/formato-do-rosto", label: "Armação para o seu rosto" },
  { href: "/empresas", label: "Empresas e EPI" },
  { href: "/guia", label: "Guias" },
  { href: "/sobre", label: "Sobre a Sanrê" },
];

const AJUDA = [
  { href: "/contato", label: "Contato" },
  { href: "/tamanho-do-oculos", label: "Como saber o tamanho do óculos" },
  { href: "/trocas-e-devolucoes", label: "Trocas, devoluções e garantia" },
  { href: "/privacidade", label: "Privacidade" },
];

/** Rodapé em preto de galeria: as duas lojas em destaque, fios finos, caixa-alta. */
export default function Footer() {
  const ano = new Date().getFullYear();
  return (
    <footer className="bg-sr-ink text-sr-paper">
      <div className="bleed pb-10 pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo className="h-12 w-auto text-sr-paper" />
            <p className="mt-7 max-w-sm text-[0.95rem] leading-relaxed text-sr-paper/75">
              Ótica de Cravinhos desde 2004 e, desde julho de 2026, também em Ribeirão Preto, dentro da PB Arts
              Gallery. Óculos de sol, de grau e de segurança, com atendimento de quem conhece cada cliente pelo nome.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={whatsappCom("Olá! Vim pelo site da Sanrê e queria atendimento.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whats"
              >
                WhatsApp {WHATSAPP_LABEL}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-5">
            <nav aria-label="Óculos">
              <p className="eyebrow-light">Óculos</p>
              <ul className="mt-5 space-y-2.5 text-[0.95rem]">
                {TIPOS.map(t => (
                  <li key={t.slug}>
                    <Link href={t.rota} className="text-sr-paper/85 no-underline hover:text-white">
                      {t.titulo}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/marcas" className="text-sr-paper/85 no-underline hover:text-white">
                    Marcas
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Na Sanrê">
              <p className="eyebrow-light">Na Sanrê</p>
              <ul className="mt-5 space-y-2.5 text-[0.95rem]">
                {NA_SANRE.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sr-paper/85 no-underline hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Ajuda">
              <p className="eyebrow-light">Ajuda</p>
              <ul className="mt-5 space-y-2.5 text-[0.95rem]">
                {AJUDA.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sr-paper/85 no-underline hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a href={`mailto:${EMAIL}`} className="break-all text-sr-paper/85 no-underline hover:text-white">
                    {EMAIL}
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="lg:col-span-3">
            <p className="eyebrow-light">Lojas</p>
            <ul className="mt-5 space-y-6">
              {UNIDADES.map(u => (
                <li key={u.slug} className="border-t border-sr-paper/15 pt-4">
                  <Link href={`/unidades/${u.slug}`} className="no-underline">
                    <span className="font-label text-[0.8rem] font-medium uppercase tracking-[0.2em] text-white">
                      {u.cidade}
                    </span>
                  </Link>
                  <p className="mt-2 text-[0.92rem] leading-relaxed text-sr-paper/75">
                    {u.logradouro}
                    {u.complemento ? ` · ${u.complemento}` : ""}
                    <br />
                    {u.bairro} · {u.cidade}/{u.uf}
                  </p>
                  <a
                    href={u.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[0.85rem] text-sr-nude-300 underline underline-offset-4 hover:text-white"
                  >
                    Como chegar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-sr-paper/15 pt-6 text-[0.8rem] text-sr-paper/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {ano} {RAZAO_SOCIAL} · CNPJ {CNPJ}
          </p>
          <p>PIX · cartão em até 10x sem juros · boleto</p>
          <div className="flex gap-5">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-sr-paper/75 no-underline hover:text-white">
              Instagram {INSTAGRAM_HANDLE}
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="text-sr-paper/75 no-underline hover:text-white">
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
