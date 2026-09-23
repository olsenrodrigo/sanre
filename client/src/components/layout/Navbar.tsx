import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Menu, X, Search, ScanFace } from "lucide-react";
import { useCart } from "@/context/CartContext";
import Logo from "@/components/brand/Logo";
import { TIPOS, slugificar } from "@/lib/oculos";
import { WHATSAPP_LABEL, whatsappCom } from "@/lib/marca";
import { UNIDADES } from "@shared/unidades";

interface MarcaApi {
  marca: string;
  total: number;
}

/**
 * Cabeçalho único do site e da loja.
 *
 * Barra de serviço preta (as três promessas que decidem a compra: PIX, parcelas,
 * retirada), e embaixo o cabeçalho de galeria: tipos de óculos à esquerda,
 * marca no centro, provador e lojas à direita. Marcas abrem num painel de
 * largura total com a lista real do catálogo.
 */
export default function Navbar() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [painel, setPainel] = useState<"marcas" | "busca" | null>(null);
  const [busca, setBusca] = useState("");
  const { itemCount } = useCart();
  const [location, navigate] = useLocation();
  const campoBusca = useRef<HTMLInputElement>(null);

  const { data: marcas = [] } = useQuery<MarcaApi[]>({
    queryKey: ["/api/store/brands"],
    queryFn: () => fetch("/api/store/brands").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    setMenuAberto(false);
    setPainel(null);
  }, [location]);

  useEffect(() => {
    if (painel === "busca") campoBusca.current?.focus();
  }, [painel]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPainel(null);
        setMenuAberto(false);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Trava o scroll da página com a gaveta aberta
  useEffect(() => {
    document.body.style.overflow = menuAberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAberto]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busca.trim();
    navigate(q ? `/loja?busca=${encodeURIComponent(q)}` : "/loja");
    setPainel(null);
    setMenuAberto(false);
  };

  const ativo = (href: string) => location === href || location.startsWith(`${href}/`);
  const linkNav = (href: string) =>
    `nav-label no-underline transition-colors ${ativo(href) ? "text-sr-nude-600" : "text-sr-ink hover:text-sr-nude-600"}`;

  return (
    <header className="sticky top-0 z-50">
      {/* Barra de serviço */}
      <div className="bg-sr-ink text-sr-paper">
        <div className="bleed flex h-9 items-center justify-between gap-4 text-[0.72rem] tracking-[0.04em]">
          <p className="hidden truncate text-sr-paper/75 md:block">
            Cravinhos desde 2004 · Ribeirão Preto na PB Arts Gallery
          </p>
          <p className="mx-auto truncate md:mx-0">
            PIX com 5% de desconto <span className="text-sr-nude-400">·</span> até 10x sem juros{" "}
            <span className="hidden sm:inline">
              <span className="text-sr-nude-400">·</span> retirada grátis nas lojas
            </span>
          </p>
          <a
            href={whatsappCom("Olá! Vim pelo site da Sanrê e queria atendimento.")}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sr-paper/85 no-underline hover:text-white lg:block"
          >
            WhatsApp {WHATSAPP_LABEL}
          </a>
        </div>
      </div>

      <div className="border-b border-sr-line bg-sr-paper/95 backdrop-blur supports-[backdrop-filter]:bg-sr-paper/85">
        <div className="bleed">
          <div className="grid h-[var(--sr-header)] grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Esquerda: tipos (desktop) / menu (mobile) */}
            <div className="flex items-center">
              <button
                className="-ml-2 p-2.5 text-sr-ink lg:hidden"
                onClick={() => setMenuAberto(true)}
                aria-expanded={menuAberto}
                aria-controls="gaveta-menu"
                aria-label="Abrir menu"
              >
                <Menu size={21} aria-hidden />
              </button>
              <nav className="hidden items-center gap-7 lg:flex" aria-label="Óculos">
                {TIPOS.map(t => (
                  <Link key={t.slug} href={t.rota} className={linkNav(t.rota)}>
                    {t.rotulo}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => setPainel(p => (p === "marcas" ? null : "marcas"))}
                  aria-expanded={painel === "marcas"}
                  className={`nav-label transition-colors ${
                    painel === "marcas" || ativo("/marcas") ? "text-sr-nude-600" : "text-sr-ink hover:text-sr-nude-600"
                  }`}
                >
                  Marcas
                </button>
              </nav>
            </div>

            {/* Centro: marca */}
            <Link href="/" className="justify-self-center text-sr-ink" aria-label="Óticas Sanrê — página inicial">
              <Logo className="h-9 w-auto md:h-11" decorativo />
            </Link>

            {/* Direita */}
            <div className="flex items-center justify-end gap-1 lg:gap-6">
              <Link href="/provador" className={`hidden items-center gap-2 xl:inline-flex ${linkNav("/provador")}`}>
                <ScanFace size={16} aria-hidden className="text-sr-gold" />
                Provador virtual
              </Link>
              <Link href="/unidades" className={`hidden lg:inline ${linkNav("/unidades")}`}>
                Lojas
              </Link>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPainel(p => (p === "busca" ? null : "busca"))}
                  aria-expanded={painel === "busca"}
                  aria-label="Buscar óculos"
                  className="p-2.5 text-sr-ink transition-colors hover:text-sr-nude-600"
                >
                  <Search size={19} aria-hidden />
                </button>
                <Link
                  href="/loja/carrinho"
                  className="flex items-center gap-1.5 p-2.5 text-sr-ink no-underline transition-colors hover:text-sr-nude-600"
                  aria-label={`Sacola${itemCount > 0 ? ` — ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : " vazia"}`}
                >
                  <ShoppingBag size={19} aria-hidden />
                  <span className="font-label text-[0.72rem] font-medium tabular-nums" aria-hidden>
                    {itemCount}
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Painel de busca */}
        {painel === "busca" && (
          <div className="border-t border-sr-line bg-sr-paper">
            <div className="bleed py-8 md:py-12">
              <form onSubmit={buscar} role="search" className="mx-auto max-w-3xl">
                <label htmlFor="busca-topo" className="eyebrow">
                  O que você procura
                </label>
                <div className="mt-3 flex items-end gap-4 border-b border-sr-ink pb-2">
                  <input
                    id="busca-topo"
                    ref={campoBusca}
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Ray-Ban aviador, Prada, polarizado…"
                    className="w-full bg-transparent font-display text-[1.6rem] font-light text-sr-ink outline-none placeholder:text-sr-nude-300 md:text-[2.1rem]"
                  />
                  <button type="submit" className="nav-label shrink-0 pb-2 text-sr-nude-600">
                    Buscar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Painel de marcas */}
        {painel === "marcas" && (
          <div className="hidden border-t border-sr-line bg-sr-paper lg:block">
            <div className="bleed grid grid-cols-[1fr_2.2fr] gap-12 py-10">
              <div>
                <p className="eyebrow">Marcas na Sanrê</p>
                <p className="mt-4 max-w-xs text-[0.95rem] text-sr-ink-soft">
                  Grifes internacionais e marcas nacionais escolhidas pela loja. Todas originais, com nota fiscal e
                  garantia do fabricante.
                </p>
                <Link href="/marcas" className="link-rule mt-6">
                  Ver todas as marcas
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-x-8">
                {marcas.map(m => (
                  <li key={m.marca} className="border-b border-sr-line">
                    <Link
                      href={`/marcas/${slugificar(m.marca)}`}
                      className="flex items-baseline justify-between py-2.5 no-underline"
                    >
                      <span className="label-marca transition-colors hover:text-sr-nude-600">{m.marca}</span>
                      <span className="text-[0.75rem] tabular-nums text-sr-nude-600">{m.total}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Gaveta mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" id="gaveta-menu">
          <button
            className="absolute inset-0 bg-sr-ink/40"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-sr-paper">
            <div className="flex items-center justify-between border-b border-sr-line px-5 py-4">
              <Logo className="h-8 w-auto text-sr-ink" />
              <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="p-2 text-sr-ink">
                <X size={21} aria-hidden />
              </button>
            </div>
            <div className="px-5 py-6">
              <form onSubmit={buscar} role="search" className="mb-6">
                <label htmlFor="busca-mobile" className="eyebrow">
                  Buscar
                </label>
                <div className="mt-2 flex items-center gap-3 border-b border-sr-ink pb-2">
                  <input
                    id="busca-mobile"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Marca, modelo, formato…"
                    className="w-full bg-transparent text-lg text-sr-ink outline-none placeholder:text-sr-nude-300"
                  />
                  <button type="submit" aria-label="Buscar" className="text-sr-nude-600">
                    <Search size={19} />
                  </button>
                </div>
              </form>

              <nav aria-label="Principal">
                <p className="eyebrow mb-1">Óculos</p>
                {TIPOS.map(t => (
                  <Link key={t.slug} href={t.rota} className="block border-b border-sr-line py-3.5 font-display text-lg font-light text-sr-ink no-underline">
                    {t.titulo}
                  </Link>
                ))}
                <Link href="/marcas" className="block border-b border-sr-line py-3.5 font-display text-lg font-light text-sr-ink no-underline">
                  Marcas
                </Link>
                <Link href="/loja" className="block py-3.5 font-display text-lg font-light text-sr-ink no-underline">
                  Ver tudo
                </Link>

                <p className="eyebrow mb-1 mt-7">Na Sanrê</p>
                {[
                  { href: "/provador", label: "Provador virtual" },
                  { href: "/lentes-de-grau", label: "Lentes de grau com receita" },
                  { href: "/formato-do-rosto", label: "Qual armação combina com você" },
                  { href: "/empresas", label: "Empresas e EPI" },
                  ...UNIDADES.map(u => ({ href: `/unidades/${u.slug}`, label: `Loja ${u.cidade}` })),
                  { href: "/sobre", label: "Sobre a Sanrê" },
                  { href: "/contato", label: "Contato" },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="block border-b border-sr-line py-3 text-[0.98rem] text-sr-ink no-underline">
                    {l.label}
                  </Link>
                ))}
              </nav>

              <a
                href={whatsappCom("Olá! Vim pelo site da Sanrê e queria atendimento.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whats mt-8 w-full"
              >
                WhatsApp {WHATSAPP_LABEL}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
