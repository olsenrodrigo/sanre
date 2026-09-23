/**
 * Peças de formulário da galeria, usadas por FluxoGrau, ReservaDialog e pela
 * página de empresas: painel de diálogo reto (sem raio, sem sombra), opções em
 * fio fino, campos retos e a confirmação com o protocolo.
 */
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { precoBR } from "@/lib/marca";
import type { ProdutoGrau } from "./FluxoGrau";

// ─── Painel (diálogo) ────────────────────────────────────────────────────────
// z-[60]: acima do botão flutuante da assistente (z-[55]), abaixo do painel
// dela (z-[70]) — o modal cobre o atalho, mas a conversa aberta continua por cima.
export function Painel({
  aberto,
  onFechar,
  chapeu,
  titulo,
  descricao,
  children,
  rodape,
}: {
  aberto: boolean;
  onFechar: () => void;
  chapeu: string;
  titulo: string;
  descricao: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-sr-ink/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          // Foco inicial no título (leitor de tela anuncia o diálogo; no celular não sobe teclado).
          onOpenAutoFocus={e => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-titulo-painel]")?.focus();
          }}
          className="fixed inset-0 z-[60] flex flex-col bg-sr-paper text-sr-ink outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[min(54rem,calc(100dvh-3rem))] md:w-[min(42rem,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:border md:border-sr-line"
        >
          <header className="flex items-start justify-between gap-6 border-b border-sr-line px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:pt-7">
            <div className="min-w-0">
              <p className="eyebrow">{chapeu}</p>
              <DialogPrimitive.Title data-titulo-painel tabIndex={-1} className="display-md mt-2 text-balance outline-none">
                {titulo}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">{descricao}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-2 px-2 nav-label text-sr-ink-soft hover:text-sr-ink"
              aria-label="Fechar"
            >
              <span className="hidden sm:inline">Fechar</span>
              <X size={20} aria-hidden />
            </DialogPrimitive.Close>
          </header>
          <div data-painel-corpo className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-8 md:py-7">
            {children}
          </div>
          {rodape && (
            <footer className="border-t border-sr-line bg-sr-paper px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-5">
              {rodape}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Barra de etapas: fios que se preenchem, com o nome da etapa atual. */
export function Etapas({ nomes, atual }: { nomes: string[]; atual: number }) {
  return (
    <div className="mb-7">
      <p className="eyebrow" aria-live="polite">
        Etapa {atual + 1} de {nomes.length} · {nomes[atual]}
      </p>
      <ol className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nomes.length}, minmax(0, 1fr))` }} aria-hidden>
        {nomes.map((n, i) => (
          <li key={n} className={`h-[2px] ${i <= atual ? "bg-sr-ink" : "bg-sr-line"}`} />
        ))}
      </ol>
    </div>
  );
}

/** A armação escolhida, como etiqueta de galeria. */
export function EtiquetaProduto({ produto, nota }: { produto: ProdutoGrau; nota?: string }) {
  return (
    <div className="mb-7 flex items-center gap-4 border border-sr-line bg-white p-3">
      <div className="pedestal aspect-vitrine w-20 shrink-0">
        {produto.mainImage && (
          <img src={produto.mainImage} alt="" className="produto absolute inset-0 h-full w-full p-1.5" loading="lazy" />
        )}
      </div>
      <div className="min-w-0">
        {produto.brand && <p className="label-marca">{produto.brand}</p>}
        <p className="truncate text-[0.95rem] text-sr-ink">{produto.title}</p>
        <p className="dado text-sm text-sr-ink-soft">
          Armação {precoBR(produto.price)}
          {nota ? ` · ${nota}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Opções ──────────────────────────────────────────────────────────────────
interface OpcaoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title"> {
  tipo: "radio" | "checkbox";
  titulo: string;
  nota?: string;
  extra?: ReactNode;
}

/** Opção em fio fino. O input real fica visível para leitor de tela e teclado. */
export const Opcao = forwardRef<HTMLInputElement, OpcaoProps>(function Opcao({ tipo, titulo, nota, extra, className = "", ...input }, ref) {
  return (
    <label
      className={`group relative flex cursor-pointer items-start gap-3.5 border border-sr-line bg-white px-4 py-3.5 transition-colors hover:border-sr-nude-500 has-[:checked]:border-sr-ink has-[:checked]:bg-sr-nude-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sr-nude-600 ${className}`}
    >
      <input ref={ref} type={tipo} className="peer sr-only" {...input} />
      <span
        aria-hidden
        className={`mt-[0.2rem] flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center border border-sr-nude-500 bg-white text-transparent peer-checked:border-sr-ink peer-checked:bg-sr-ink peer-checked:text-sr-paper ${tipo === "radio" ? "rounded-full" : ""}`}
      >
        {tipo === "checkbox" ? <Check size={13} strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug text-sr-ink">{titulo}</span>
        {nota && <span className="mt-0.5 block text-[0.9rem] leading-snug text-sr-ink-soft">{nota}</span>}
        {extra}
      </span>
    </label>
  );
});

/** Opção curta em linha (quando, período, sim/não). */
export const Chip = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { titulo: string }>(
  function Chip({ titulo, ...input }, ref) {
    return (
      <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center border border-sr-line bg-white px-4 text-[0.95rem] text-sr-ink transition-colors hover:border-sr-nude-500 has-[:checked]:border-sr-ink has-[:checked]:bg-sr-ink has-[:checked]:text-sr-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sr-nude-600">
        <input ref={ref} type="radio" className="sr-only" {...input} />
        {titulo}
      </label>
    );
  },
);

// ─── Campos ──────────────────────────────────────────────────────────────────
export function Grupo({
  legenda,
  ajuda,
  erro,
  id,
  children,
}: {
  legenda: string;
  ajuda?: ReactNode;
  erro?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <fieldset aria-describedby={erro ? `${id}-erro` : undefined} className="min-w-0">
      <legend className="text-[1.0625rem] font-medium text-sr-ink">{legenda}</legend>
      {ajuda && <div className="mt-1 text-[0.95rem] text-sr-ink-soft">{ajuda}</div>}
      {/* Erro logo abaixo da pergunta: numa lista longa de opções, embaixo ele some da tela. */}
      <Erro id={`${id}-erro`} mensagem={erro} />
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

export function Erro({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-[0.95rem] text-sr-alert">
      {mensagem}
    </p>
  );
}

const classeCampo =
  "mt-2 block min-h-12 w-full border border-sr-line bg-white px-4 py-3 text-sr-ink placeholder:text-sr-nude-500 focus:border-sr-ink focus:outline-none aria-[invalid=true]:border-sr-alert";

export const CampoTexto = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string; ajuda?: string; opcional?: boolean }
>(function CampoTexto({ rotulo, erro, ajuda, opcional, id, ...input }, ref) {
  const idErro = `${id}-erro`;
  return (
    <div className="campos-retos">
      <label htmlFor={id} className="font-medium text-sr-ink">
        {rotulo}
        {opcional && <span className="ml-1.5 font-normal text-sr-ink-soft">(opcional)</span>}
      </label>
      {ajuda && <p className="text-[0.9rem] text-sr-ink-soft">{ajuda}</p>}
      <input
        ref={ref}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={classeCampo}
        {...input}
      />
      <Erro id={idErro} mensagem={erro} />
    </div>
  );
});

export const CampoArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string; erro?: string; opcional?: boolean }
>(function CampoArea({ rotulo, erro, opcional, id, ...area }, ref) {
  return (
    <div className="campos-retos">
      <label htmlFor={id} className="font-medium text-sr-ink">
        {rotulo}
        {opcional && <span className="ml-1.5 font-normal text-sr-ink-soft">(opcional)</span>}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={3}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={`${classeCampo} resize-y`}
        {...area}
      />
      <Erro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
});

/** Checkbox de consentimento: nunca vem marcado. */
export const Consentimento = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { texto: string; erro?: string; complemento?: ReactNode }
>(function Consentimento({ texto, erro, complemento, id, ...input }, ref) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3.5">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className="peer sr-only"
          {...input}
        />
        <span
          aria-hidden
          className="mt-[0.2rem] flex h-5 w-5 shrink-0 items-center justify-center border border-sr-ink bg-white text-transparent peer-checked:bg-sr-ink peer-checked:text-sr-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sr-nude-600"
        >
          <Check size={14} strokeWidth={2.5} />
        </span>
        <span className="text-[0.95rem] leading-relaxed text-sr-ink-soft">
          {texto} {complemento}
        </span>
      </label>
      <Erro id={`${id}-erro`} mensagem={erro} />
    </div>
  );
});

/**
 * Campo-armadilha para robô: fora da tela, fora da ordem de tabulação e
 * escondido de leitor de tela. Pessoa não preenche; robô preenche e o
 * servidor descarta sem avisar.
 */
export const Armadilha = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Armadilha(props, ref) {
  return (
    <div aria-hidden className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
      <label>
        Site
        <input ref={ref} type="text" tabIndex={-1} autoComplete="off" {...props} />
      </label>
    </div>
  );
});

// ─── Confirmação ─────────────────────────────────────────────────────────────
export function Confirmacao({
  protocolo,
  whatsappUrl,
  passos,
  titulo = "Pedido recebido",
}: {
  protocolo: string;
  whatsappUrl: string;
  passos: ReactNode[];
  titulo?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(protocolo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* navegador sem permissão de área de transferência: o protocolo está na tela */
    }
  };
  return (
    <div>
      <p className="eyebrow">{titulo}</p>
      <p className="mt-5 text-[0.95rem] text-sr-ink-soft">Seu protocolo</p>
      <p className="dado mt-1 font-display text-[clamp(2.25rem,9vw,3.5rem)] font-light leading-none tracking-[0.08em] text-sr-ink">
        {protocolo}
      </p>
      <div className="mt-3">
        <button type="button" onClick={copiar} className="link-rule" aria-live="polite">
          {copiado ? "Copiado" : "Copiar protocolo"}
        </button>
      </div>

      <div className="mt-8">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-whats w-full no-underline sm:w-auto">
          Continuar no WhatsApp
        </a>
      </div>
      <p className="mt-3 text-[0.9rem] text-sr-ink-soft">
        A mensagem já vai com o protocolo, para a loja achar o seu pedido na hora.
      </p>

      <div className="rule mt-8 pt-6">
        <p className="eyebrow">O que acontece agora</p>
        <ol className="mt-4 space-y-3">
          {passos.map((p, i) => (
            <li key={i} className="flex gap-4 text-[1rem] leading-relaxed text-sr-ink">
              <span className="dado mt-[0.1rem] font-display text-sm text-sr-nude-600">{String(i + 1).padStart(2, "0")}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Depois de uma validação que falhou, leva a vista até o primeiro erro do contêiner. */
export function rolarParaPrimeiroErro(dentroDe: Element | null | undefined) {
  requestAnimationFrame(() => {
    const alvo = (dentroDe ?? document).querySelector('[role="alert"]');
    alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

/** Mensagem de erro geral do envio, com saída pelo WhatsApp. */
export function ErroEnvio({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="mb-4 border-l-2 border-sr-alert bg-white px-4 py-3 text-[0.95rem] text-sr-alert">
      {mensagem}
    </p>
  );
}
