/**
 * Ponte entre as páginas e a Assistente Sanrê (widget de chat).
 *
 * Qualquer tela pode (1) informar o contexto — "a cliente está vendo tal
 * óculos" — para a assistente responder sobre ele, e (2) abrir o chat já com
 * uma pergunta. É um barramento de eventos no `window`, sem estado global de
 * React: o widget vive fora das rotas e sobrevive à navegação.
 *
 * Uso numa página de produto:
 *   useEffect(() => {
 *     definirContextoAssistente({ produto: { slug, titulo, marca, preco, imagem } });
 *     return () => definirContextoAssistente({ produto: null });
 *   }, [slug]);
 *
 * O widget só considera o `produto` na mesma rota em que ele foi definido —
 * se a página esquecer de limpar, a próxima tela não herda o óculos errado.
 * Elementos fixos no rodapé (barra "Adicionar à sacola" no celular) devem
 * levar o atributo `data-assistente-evitar`: o botão flutuante sobe acima
 * deles. Contrato completo em docs/ASSISTENTE.md.
 */

export interface ProdutoContexto {
  slug: string;
  titulo: string;
  marca?: string | null;
  preco?: string | number | null;
  imagem?: string | null;
}

export interface ContextoAssistente {
  /** Caminho atual (preenchido pelo widget). */
  pagina?: string;
  produto?: ProdutoContexto | null;
  /** Unidade preferida, quando a cliente já escolheu. */
  unidade?: "cravinhos" | "ribeirao-preto" | null;
}

const EVENTO_CONTEXTO = "sanre:assistente:contexto";
const EVENTO_ABRIR = "sanre:assistente:abrir";

let contextoAtual: ContextoAssistente = {};

export function definirContextoAssistente(parcial: ContextoAssistente): void {
  contextoAtual = { ...contextoAtual, ...parcial };
  window.dispatchEvent(new CustomEvent(EVENTO_CONTEXTO, { detail: contextoAtual }));
}

export function lerContextoAssistente(): ContextoAssistente {
  return contextoAtual;
}

/** Abre o chat; se vier `mensagem`, ela é enviada como se a cliente tivesse digitado. */
export function abrirAssistente(mensagem?: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: { mensagem } }));
}

export function ouvirContexto(fn: (c: ContextoAssistente) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<ContextoAssistente>).detail);
  window.addEventListener(EVENTO_CONTEXTO, h);
  return () => window.removeEventListener(EVENTO_CONTEXTO, h);
}

export function ouvirAbrir(fn: (mensagem?: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<{ mensagem?: string }>).detail?.mensagem);
  window.addEventListener(EVENTO_ABRIR, h);
  return () => window.removeEventListener(EVENTO_ABRIR, h);
}
