/**
 * Blocos de uma resposta da Assistente: texto, cards de produto, chips de
 * ação e o convite para continuar no WhatsApp (transbordo).
 */
import type { MouseEvent, ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { precoBR } from "@/lib/marca";
import type { AcaoAssistente, ProdutoCard, RespostaAssistente, Transbordo } from "./protocolo";
import { hrefSeguro } from "./useConversa";

interface Navegacao {
  /** Chamado depois de uma navegação interna (no celular, fecha o painel). */
  onNavegou: () => void;
}

/** Link do site que navega pelo wouter (sem recarregar) e avisa o painel. */
export function LinkInterno({
  href,
  className,
  children,
  onNavegou,
  rotulo,
}: Navegacao & { href: string; className?: string; children: ReactNode; rotulo?: string }) {
  const [, navegar] = useLocation();
  const clicar = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navegar(href);
    onNavegou();
  };
  return (
    <a href={href} onClick={clicar} className={className} aria-label={rotulo}>
      {children}
    </a>
  );
}

const CHIP =
  "inline-flex min-h-[2.5rem] items-center gap-1.5 border border-sr-ink/70 bg-transparent px-3 py-1.5 text-left font-label text-[0.6875rem] font-medium uppercase leading-tight tracking-[0.14em] text-sr-ink transition-colors hover:bg-sr-ink hover:text-sr-paper disabled:cursor-not-allowed disabled:opacity-50";

function Chip({
  acao,
  desabilitado,
  onEnviar,
  onNavegou,
}: Navegacao & { acao: AcaoAssistente; desabilitado: boolean; onEnviar: (t: string) => void }) {
  if (acao.enviar) {
    const frase = acao.enviar;
    return (
      <button type="button" className={CHIP} disabled={desabilitado} onClick={() => onEnviar(frase)}>
        {acao.rotulo}
      </button>
    );
  }
  if (!hrefSeguro(acao.href)) return null;
  if (acao.href.startsWith("/")) {
    return (
      <LinkInterno href={acao.href} className={CHIP} onNavegou={onNavegou}>
        {acao.rotulo}
      </LinkInterno>
    );
  }
  const whats = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(acao.href);
  return (
    <a href={acao.href} target="_blank" rel="noopener noreferrer" className={CHIP}>
      {whats && <MessageCircle size={13} aria-hidden className="shrink-0" />}
      {acao.rotulo}
      <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

function imagemSegura(src: string | null): src is string {
  return Boolean(src) && (hrefSeguro(src) || /^data:image\//i.test(src!));
}

function Cards({ itens, onNavegou }: Navegacao & { itens: ProdutoCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px border border-sr-line bg-sr-line" aria-label="Produtos sugeridos">
      {itens.slice(0, 4).map(p => (
        <li key={p.slug} className="bg-sr-paper">
          <LinkInterno
            href={`/loja/produto/${encodeURIComponent(p.slug)}`}
            onNavegou={onNavegou}
            className="group block h-full no-underline focus-visible:outline-offset-[-2px]"
          >
            <div className="pedestal aspect-vitrine">
              {imagemSegura(p.imagem) ? (
                <img
                  src={p.imagem}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="produto absolute inset-0 h-full w-full p-3 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-sr-nude-400" aria-hidden>
                  <Logo variante="palavra" decorativo className="h-3 w-auto" />
                </span>
              )}
            </div>
            <div className="px-2.5 pb-3 pt-2.5">
              {p.marca && <p className="label-marca truncate text-[0.625rem]">{p.marca}</p>}
              <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-sr-ink group-hover:underline">
                {p.titulo}
              </p>
              {p.preco !== null && p.preco !== undefined && (
                <p className="dado mt-1.5 text-[0.875rem] font-medium text-sr-ink">{precoBR(p.preco)}</p>
              )}
            </div>
          </LinkInterno>
        </li>
      ))}
    </ul>
  );
}

export function BlocoTransbordo({ transbordo }: { transbordo: Transbordo }) {
  if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(transbordo.whatsappUrl)) return null;
  return (
    <div className="border border-sr-line bg-white p-4">
      <p className="text-[0.875rem] leading-relaxed text-sr-ink-soft">
        A consultora continua pelo WhatsApp, com o contexto desta conversa.
      </p>
      <a
        href={transbordo.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-whats mt-3 w-full no-underline"
      >
        <MessageCircle size={16} aria-hidden />
        Continuar no WhatsApp
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </div>
  );
}

export function BlocosResposta({
  respostas,
  transbordo,
  desabilitado,
  onEnviar,
  onNavegou,
}: Navegacao & {
  respostas: RespostaAssistente[];
  transbordo?: Transbordo;
  desabilitado: boolean;
  onEnviar: (t: string) => void;
}) {
  // A ação vem por último, depois do convite ao WhatsApp.
  const conteudo = respostas.filter(r => r.tipo !== "acoes");
  const acoes = respostas.filter((r): r is Extract<RespostaAssistente, { tipo: "acoes" }> => r.tipo === "acoes");
  return (
    <div className="space-y-3">
      {conteudo.map((r, i) =>
        r.tipo === "texto" ? (
          <p
            key={i}
            className="break-words border-l border-sr-nude-400 pl-3.5 text-[0.9375rem] leading-relaxed text-sr-ink"
          >
            {r.texto
              .split(/\n+/)
              .filter(l => l.trim())
              .map((linha, k) => (
                <span key={k} className={k ? "mt-2 block" : "block"}>
                  {linha}
                </span>
              ))}
          </p>
        ) : r.tipo === "produtos" && r.itens.length ? (
          <Cards key={i} itens={r.itens} onNavegou={onNavegou} />
        ) : null,
      )}
      {transbordo && <BlocoTransbordo transbordo={transbordo} />}
      {acoes.map((r, i) => (
        <div key={`a${i}`} className="flex flex-wrap gap-2 pt-0.5">
          {r.acoes.map((a, j) => (
            <Chip key={j} acao={a} desabilitado={desabilitado} onEnviar={onEnviar} onNavegou={onNavegou} />
          ))}
        </div>
      ))}
    </div>
  );
}
