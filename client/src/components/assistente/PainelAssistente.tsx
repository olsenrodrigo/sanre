/**
 * Painel da Assistente Sanrê — carregado sob demanda (React.lazy) na primeira
 * vez que a cliente abre o chat e mantido montado depois, para a conversa e
 * uma resposta em andamento sobreviverem ao fechar/abrir.
 *
 * Desktop: janela de 400 px no canto inferior direito, não modal.
 * Celular (< 640 px): ocupa a tela, modal, com o foco preso no painel.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { BlocosResposta } from "./BlocosResposta";
import { LIMITE_TEXTO, linkPassagemWhatsapp, pareceDadoSensivel, type ModoAssistente } from "./protocolo";
import { useConversa, type ContextoEnvio } from "./useConversa";

export interface PedidoAbrir {
  id: number;
  texto?: string;
}

export interface PainelAssistenteProps {
  aberto: boolean;
  onFechar: () => void;
  contexto: ContextoEnvio;
  modo: ModoAssistente | null;
  pedido: PedidoAbrir | null;
  botaoRef: RefObject<HTMLButtonElement | null>;
}

const MQ_CELULAR = "(max-width: 639px)";

function useCelular(): boolean {
  const [celular, setCelular] = useState(() => typeof window !== "undefined" && window.matchMedia(MQ_CELULAR).matches);
  useEffect(() => {
    const mq = window.matchMedia(MQ_CELULAR);
    const h = () => setCelular(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return celular;
}

const FOCAVEIS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PainelAssistente({ aberto, onFechar, contexto, modo, pedido, botaoRef }: PainelAssistenteProps) {
  const conversa = useConversa(contexto);
  const { mensagens, enviando, enviar, reenviar, saudar, apagarConversa, ultimaPergunta, sessaoId } = conversa;
  const celular = useCelular();
  const [rascunho, setRascunho] = useState("");
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const avisoId = useId();

  // ── Abrir: boas-vindas + foco ──────────────────────────────────────────────
  useEffect(() => {
    if (!aberto) return;
    saudar(contexto.produto);
    // Teclado virtual só abre sozinho em quem tem mouse; no toque, o foco vai no painel.
    const fino = window.matchMedia("(pointer: fine)").matches;
    const alvo = fino ? campoRef.current : painelRef.current;
    requestAnimationFrame(() => alvo?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // ── Pedido vindo de abrirAssistente(mensagem) ─────────────────────────────
  const ultimoPedido = useRef<number | null>(null);
  useEffect(() => {
    if (!pedido || pedido.id === ultimoPedido.current) return;
    ultimoPedido.current = pedido.id;
    if (pedido.texto?.trim()) enviar(pedido.texto);
  }, [pedido, enviar]);

  // ── Celular: trava a rolagem da página por baixo ─────────────────────────
  useEffect(() => {
    if (!aberto || !celular) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [aberto, celular]);

  // ── Rolagem: resposta nova aparece do começo (com a pergunta em cima) ────
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!aberto || !log) return;
    const comportamento: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const ultima = mensagens[mensagens.length - 1];
    let topo = log.scrollHeight;
    if (!enviando && ultima && ultima.autor !== "cliente" && mensagens.length > 1) {
      const pergunta = log.querySelector<HTMLElement>(`[data-msg="${mensagens[mensagens.length - 2].id}"]`);
      if (pergunta) topo = pergunta.offsetTop - 12;
    }
    log.scrollTo({ top: topo, behavior: comportamento });
  }, [mensagens, enviando, aberto]);

  const fechar = useCallback(() => {
    setConfirmarApagar(false);
    onFechar();
    requestAnimationFrame(() => botaoRef.current?.focus({ preventScroll: true }));
  }, [onFechar, botaoRef]);

  const aoNavegar = useCallback(() => {
    if (celular) fechar();
  }, [celular, fechar]);

  const teclaPainel = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      fechar();
      return;
    }
    if (e.key !== "Tab" || !celular || !painelRef.current) return;
    const focaveis = Array.from(painelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
      el => el.offsetParent !== null,
    );
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === painelRef.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  const ajustarAltura = () => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };

  const submeter = () => {
    if (!rascunho.trim() || enviando) return;
    if (enviar(rascunho)) {
      setRascunho("");
      requestAnimationFrame(ajustarAltura);
    }
  };

  const teclaCampo = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submeter();
    }
  };

  const sensivel = rascunho.length > 5 && pareceDadoSensivel(rascunho);
  const perto = rascunho.length > LIMITE_TEXTO - 100;

  const whatsHeader = linkPassagemWhatsapp({
    sessaoId,
    host: window.location.host,
    produto: contexto.produto ? { slug: contexto.produto.slug, titulo: contexto.produto.titulo } : null,
    unidade: contexto.unidade ?? null,
    pergunta: ultimaPergunta,
  });

  return (
    <div
      ref={painelRef}
      id="assistente-sanre"
      role="dialog"
      aria-modal={celular ? true : undefined}
      aria-labelledby={tituloId}
      tabIndex={-1}
      hidden={!aberto}
      onKeyDown={teclaPainel}
      className="fixed inset-0 z-[70] flex flex-col bg-sr-paper text-sr-ink outline-none sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-[25rem] sm:border sm:border-sr-ink motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
      style={{ height: celular ? "100dvh" : undefined }}
    >
      {/* ── Cabeçalho ── */}
      <header
        className="flex shrink-0 items-center gap-3 bg-sr-ink px-4 pb-3.5 text-sr-paper sm:px-5"
        style={{ paddingTop: celular ? "max(0.875rem, env(safe-area-inset-top))" : "0.875rem" }}
      >
        <div className="min-w-0 flex-1">
          <Logo variante="palavra" decorativo className="h-[0.8rem] w-auto" />
          <h2 id={tituloId} className="mt-1.5 font-sans text-[0.9375rem] font-normal leading-tight tracking-normal text-sr-paper">
            Assistente Sanrê
          </h2>
        </div>
        <a
          href={whatsHeader}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-whats !min-h-[2.5rem] !gap-1.5 !px-3 !text-[0.65rem] no-underline"
          aria-label="Conversar pelo WhatsApp (abre em nova aba)"
        >
          <MessageCircle size={14} aria-hidden />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={fechar}
          className="-mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center text-sr-paper/85 transition-colors hover:text-sr-paper"
          aria-label="Fechar a assistente"
        >
          <X size={20} aria-hidden />
        </button>
      </header>

      {/* ── Faixa: modo + apagar ── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sr-line px-4 py-2 sm:px-5">
        <p className="truncate text-[0.75rem] text-sr-nude-600">
          {modo === "agente" ? "Atendimento com IA" : "Respostas automáticas"}
        </p>
        {confirmarApagar ? (
          <span className="flex shrink-0 items-center gap-2 text-[0.75rem]">
            <span className="text-sr-ink-soft">Apagar tudo?</span>
            <button
              type="button"
              className="font-medium text-sr-alert underline underline-offset-2"
              onClick={() => {
                apagarConversa();
                setConfirmarApagar(false);
                campoRef.current?.focus();
              }}
            >
              Sim
            </button>
            <button type="button" className="text-sr-ink-soft underline underline-offset-2" onClick={() => setConfirmarApagar(false)}>
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="shrink-0 text-[0.75rem] text-sr-nude-600 underline decoration-sr-nude-400 underline-offset-2 hover:text-sr-ink"
            onClick={() => setConfirmarApagar(true)}
          >
            Apagar conversa
          </button>
        )}
      </div>

      {/* ── Conversa ── */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversa com a assistente"
        aria-busy={enviando}
        className="relative flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
      >
        {mensagens.map(m => {
          if (m.autor === "cliente") {
            return (
              <div key={m.id} data-msg={m.id} className="flex justify-end">
                <p
                  className={
                    m.retida
                      ? "max-w-[85%] border border-dashed border-sr-nude-500 px-3.5 py-2.5 text-[0.875rem] italic leading-relaxed text-sr-ink-soft"
                      : "max-w-[85%] whitespace-pre-wrap break-words bg-sr-ink px-3.5 py-2.5 text-[0.9375rem] leading-relaxed text-sr-paper"
                  }
                >
                  <span className="sr-only">Você: </span>
                  {m.texto}
                </p>
              </div>
            );
          }
          if (m.autor === "aviso") {
            return (
              <div key={m.id} data-msg={m.id} className="space-y-2.5 border-l border-sr-alert pl-3.5" role="alert">
                <p className="text-[0.875rem] leading-relaxed text-sr-alert">{m.texto}</p>
                <div className="flex flex-wrap gap-2">
                  {m.reenviar && (
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => reenviar(m.id, m.reenviar!)}
                      className="inline-flex min-h-[2.5rem] items-center border border-sr-ink/70 px-3 font-label text-[0.6875rem] font-medium uppercase tracking-[0.14em] hover:bg-sr-ink hover:text-sr-paper disabled:opacity-50"
                    >
                      Tentar de novo
                    </button>
                  )}
                  <a
                    href={m.whatsappUrl ?? whatsHeader}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[2.5rem] items-center gap-1.5 border border-sr-ink/70 px-3 font-label text-[0.6875rem] font-medium uppercase tracking-[0.14em] no-underline hover:bg-sr-ink hover:text-sr-paper"
                  >
                    <MessageCircle size={13} aria-hidden />
                    WhatsApp
                  </a>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} data-msg={m.id} className="max-w-full">
              <BlocosResposta
                respostas={m.respostas}
                transbordo={m.transbordo}
                desabilitado={enviando}
                onEnviar={t => enviar(t)}
                onNavegou={aoNavegar}
              />
            </div>
          );
        })}

        {enviando && (
          <div role="status" className="flex items-center gap-2.5 border-l border-sr-nude-400 pl-3.5">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 bg-sr-nude-500 motion-safe:animate-pulse"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </span>
            <span className="text-[0.8125rem] text-sr-nude-600">Digitando…</span>
          </div>
        )}
      </div>

      {/* ── Campo ── */}
      <form
        className="shrink-0 border-t border-sr-line bg-white px-4 pt-3 sm:px-5"
        style={{ paddingBottom: celular ? "max(0.75rem, env(safe-area-inset-bottom))" : "0.75rem" }}
        onSubmit={e => {
          e.preventDefault();
          submeter();
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor={`${tituloId}-campo`} className="sr-only">
            Sua mensagem
          </label>
          <textarea
            id={`${tituloId}-campo`}
            ref={campoRef}
            rows={1}
            value={rascunho}
            maxLength={LIMITE_TEXTO}
            onChange={e => {
              setRascunho(e.target.value);
              ajustarAltura();
            }}
            onKeyDown={teclaCampo}
            placeholder="Escreva sua dúvida"
            aria-describedby={avisoId}
            className="max-h-[8.25rem] min-h-[2.75rem] flex-1 resize-none border border-sr-line bg-sr-paper px-3 py-2.5 text-[1rem] leading-snug text-sr-ink placeholder:text-sr-nude-600 focus:border-sr-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={!rascunho.trim() || enviando}
            className="flex h-11 w-11 shrink-0 items-center justify-center bg-sr-ink text-sr-paper transition-colors hover:bg-sr-chumbo disabled:cursor-not-allowed disabled:bg-sr-nude-300"
            aria-label="Enviar mensagem"
          >
            <ArrowUp size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p
            id={avisoId}
            className={`text-[0.75rem] leading-snug ${sensivel ? "text-sr-alert" : "text-sr-nude-600"}`}
            aria-live="polite"
          >
            {sensivel
              ? "Parece que há dados da receita, CPF ou cartão. Por segurança, isso não será enviado por aqui."
              : "Não envie receita, CPF ou dados de cartão por aqui."}
          </p>
          <span className={`dado shrink-0 text-[0.75rem] ${perto ? "text-sr-alert" : "text-sr-nude-600"}`} aria-hidden>
            {rascunho.length}/{LIMITE_TEXTO}
          </span>
        </div>
      </form>
    </div>
  );
}
