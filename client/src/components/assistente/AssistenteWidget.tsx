/**
 * Assistente Sanrê — botão flutuante "Fale com a Sanrê" (montado em App.tsx,
 * fora do admin). O painel do chat é carregado sob demanda: na primeira carga
 * da página só este botão entra no bundle.
 *
 * Contexto: as páginas chamam `definirContextoAssistente` (contexto.ts). O
 * produto só vale na página em que foi definido — ao navegar para outra, ele
 * deixa de ir para a assistente mesmo que a página antiga não o limpe.
 *
 * Para não cobrir botões fixos no rodapé da tela (barra "Adicionar à sacola"
 * no celular, aviso de cookies), o botão sobe acima de qualquer elemento
 * visível com o atributo `data-assistente-evitar`.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageSquareText } from "lucide-react";
import { lerContextoAssistente, ouvirAbrir, ouvirContexto, type ContextoAssistente, type ProdutoContexto } from "./contexto";
import type { ConfigAssistente } from "./protocolo";
import type { PedidoAbrir } from "./PainelAssistente";
import type { ContextoEnvio, ProdutoEnvio } from "./useConversa";

const carregarPainel = () => import("./PainelAssistente");
const PainelAssistente = lazy(carregarPainel);

const EVITAR = '[data-assistente-evitar], [role="dialog"][aria-label="Privacidade"]';

/** Altura ocupada no rodapé da tela por elementos que o botão não pode cobrir. */
function useDeslocamento(): number {
  const [px, setPx] = useState(0);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      raf = 0;
      const h = window.innerHeight;
      let max = 0;
      document.querySelectorAll<HTMLElement>(EVITAR).forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.bottom >= h - 4 && r.top < h && r.height < h * 0.5) max = Math.max(max, h - r.top);
      });
      const arred = Math.round(max);
      setPx(anterior => (anterior === arred ? anterior : arred));
    };
    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };
    agendar();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    const mo = new MutationObserver(agendar);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      mo.disconnect();
    };
  }, []);
  return px;
}

function imagemOk(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length <= 1000 &&
    (/^\/(?!\/)/.test(v) || /^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|svg\+xml|gif)[;,]/i.test(v))
  );
}

/** O que a página mandou, conferido antes de ir para a API (o servidor rejeitaria o resto). */
function produtoSeguro(p: ProdutoContexto | null | undefined): ProdutoEnvio | null {
  if (!p || typeof p.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(p.slug) || p.slug.length > 200) return null;
  const titulo = String(p.titulo ?? "").trim().slice(0, 200);
  if (!titulo) return null;
  const preco =
    typeof p.preco === "number" && Number.isFinite(p.preco) && p.preco >= 0
      ? p.preco
      : typeof p.preco === "string" && p.preco.trim()
        ? p.preco.trim().slice(0, 20)
        : null;
  return {
    slug: p.slug,
    titulo,
    marca: p.marca ? String(p.marca).trim().slice(0, 80) : null,
    preco,
    imagem: imagemOk(p.imagem) ? p.imagem : null,
  };
}

function quandoOcioso(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 2000);
  return () => window.clearTimeout(t);
}

export default function AssistenteWidget() {
  const [location] = useLocation();
  const [config, setConfig] = useState<ConfigAssistente | null>(null);
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [pedido, setPedido] = useState<PedidoAbrir | null>(null);
  const [ctx, setCtx] = useState<{ c: ContextoAssistente; pagina: string }>(() => ({
    c: lerContextoAssistente(),
    pagina: typeof window !== "undefined" ? window.location.pathname : "/",
  }));
  const botaoRef = useRef<HTMLButtonElement>(null);
  const deslocamento = useDeslocamento();

  // Contexto das páginas. Relê ao montar: a página pode ter definido antes deste efeito.
  useEffect(() => {
    setCtx({ c: lerContextoAssistente(), pagina: window.location.pathname });
    return ouvirContexto(c => setCtx({ c, pagina: window.location.pathname }));
  }, []);

  useEffect(
    () =>
      ouvirAbrir(mensagem => {
        setCarregado(true);
        setAberto(true);
        setPedido({ id: Date.now() + Math.random(), texto: mensagem });
      }),
    [],
  );

  // Config (ligado/desligado, modo) sem disputar a primeira pintura.
  useEffect(
    () =>
      quandoOcioso(() => {
        fetch("/api/assistente/config")
          .then(r => (r.ok ? r.json() : null))
          .then((c: ConfigAssistente | null) => c && setConfig(c))
          .catch(() => {});
      }),
    [],
  );

  const contexto: ContextoEnvio = useMemo(() => {
    const pagina = location.slice(0, 300);
    const produto = ctx.pagina === location ? produtoSeguro(ctx.c.produto) : null;
    const unidade = ctx.c.unidade === "cravinhos" || ctx.c.unidade === "ribeirao-preto" ? ctx.c.unidade : null;
    return {
      pagina: /^\/[^\s]*$/.test(pagina) ? pagina : "/",
      ...(produto ? { produto } : {}),
      ...(unidade ? { unidade } : {}),
    };
  }, [ctx, location]);

  const abrir = () => {
    setCarregado(true);
    setAberto(true);
  };
  const fechar = useCallback(() => setAberto(false), []);
  const preCarregar = () => {
    void carregarPainel();
  };

  if (config && !config.ativo) return null;

  return (
    <>
      {!aberto && (
        <button
          ref={botaoRef}
          type="button"
          onClick={abrir}
          onPointerEnter={preCarregar}
          onFocus={preCarregar}
          onTouchStart={preCarregar}
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-controls={carregado ? "assistente-sanre" : undefined}
          aria-label="Fale com a Sanrê: abrir a assistente"
          className="group fixed right-4 z-[55] flex h-[3.25rem] min-w-[3.25rem] items-center justify-center gap-0 bg-sr-ink px-[0.95rem] text-sr-paper outline outline-1 outline-sr-paper/30 transition-[bottom,background-color] duration-300 hover:gap-2.5 hover:bg-sr-chumbo focus-visible:gap-2.5 motion-reduce:transition-none sm:right-6"
          style={{ bottom: `calc(${deslocamento}px + max(1rem, env(safe-area-inset-bottom)))` }}
        >
          <MessageSquareText size={20} strokeWidth={1.6} aria-hidden />
          <span aria-hidden className="max-w-0 overflow-hidden whitespace-nowrap font-label text-[0.72rem] font-medium uppercase tracking-[0.18em] transition-[max-width] duration-300 group-hover:max-w-[12rem] group-focus-visible:max-w-[12rem] motion-reduce:transition-none">
            Fale com a Sanrê
          </span>
        </button>
      )}

      {carregado && (
        <Suspense
          fallback={
            aberto ? (
              <div
                role="status"
                className="fixed bottom-6 right-4 z-[70] border border-sr-ink bg-sr-paper px-5 py-4 text-[0.875rem] text-sr-ink-soft sm:right-6"
              >
                Abrindo a assistente…
              </div>
            ) : null
          }
        >
          <PainelAssistente
            aberto={aberto}
            onFechar={fechar}
            contexto={contexto}
            modo={config?.modo ?? null}
            pedido={pedido}
            botaoRef={botaoRef}
          />
        </Suspense>
      )}
    </>
  );
}
