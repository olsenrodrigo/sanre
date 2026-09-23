/**
 * Estado da conversa da Assistente: histórico (persistido), envio para
 * POST /api/assistente/mensagens, boas-vindas e avisos de erro.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apagar, carregar, novoUuid, salvar, MAX_MENSAGENS, type Estado, type Mensagem } from "./armazenamento";
import {
  LIMITE_TEXTO,
  linkPassagemWhatsapp,
  pareceDadoSensivel,
  type RespostaAssistente,
  type SaidaAssistente,
} from "./protocolo";

export interface ProdutoEnvio {
  slug: string;
  titulo: string;
  marca?: string | null;
  preco?: string | number | null;
  imagem?: string | null;
}

export interface ContextoEnvio {
  pagina?: string;
  produto?: ProdutoEnvio | null;
  unidade?: "cravinhos" | "ribeirao-preto" | null;
}

const TIMEOUT_MS = 30_000;

// ─── Textos gerados no navegador ─────────────────────────────────────────────

const CHIPS_GERAIS: RespostaAssistente = {
  tipo: "acoes",
  acoes: [
    { rotulo: "Óculos de sol", enviar: "Quero ver óculos de sol" },
    { rotulo: "Lentes de grau", enviar: "Como funciona o orçamento de lentes de grau?" },
    { rotulo: "Lojas e endereços", enviar: "Onde ficam as lojas?" },
    { rotulo: "Formas de pagamento", enviar: "Quais as formas de pagamento?" },
  ],
};

function chipsProduto(): RespostaAssistente {
  return {
    tipo: "acoes",
    acoes: [
      { rotulo: "Quanto custa?", enviar: "Quanto custa?" },
      { rotulo: "Aceita lente de grau?", enviar: "Essa armação aceita lente de grau?" },
      { rotulo: "Medidas", enviar: "Quais as medidas?" },
      { rotulo: "Formas de pagamento", enviar: "Quais as formas de pagamento?" },
    ],
  };
}

/** Nome curto para a saudação: "Ray-Ban Aviator Classic RB3025" → "Ray-Ban Aviator Classic". */
function nomeCurto(titulo: string): string {
  const semCodigo = titulo.replace(/\s+[A-Z]{1,4}[\s-]?\d{2,5}[A-Z0-9/]*$/i, "").trim();
  return semCodigo.length >= 6 ? semCodigo : titulo;
}

function boasVindas(produto: ProdutoEnvio | null | undefined, primeira: boolean): RespostaAssistente[] {
  if (produto) {
    const nome = nomeCurto(produto.titulo);
    return [
      {
        tipo: "texto",
        texto: primeira
          ? `Olá! Posso te ajudar com o ${nome}? Pergunte sobre preço, medidas, lentes de grau ou retirada na loja.`
          : `Você está vendo o ${nome}. Posso te ajudar com ele?`,
      },
      chipsProduto(),
    ];
  }
  return [
    {
      tipo: "texto",
      texto:
        "Olá! Sou a assistente da Sanrê. Posso te ajudar a encontrar óculos, explicar o orçamento de lentes de grau, formas de pagamento e entrega, ou passar o endereço das lojas de Cravinhos e Ribeirão Preto.",
    },
    CHIPS_GERAIS,
  ];
}

// ─── Validação leve da resposta (o servidor já validou; aqui é defesa) ──────

export function hrefSeguro(h: unknown): h is string {
  if (typeof h !== "string") return false;
  if (/^\/(?!\/)/.test(h)) return true;
  return /^https:\/\//i.test(h);
}

function saidaValida(x: unknown): x is SaidaAssistente {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SaidaAssistente>;
  if (!Array.isArray(s.respostas) || !s.respostas.length) return false;
  return s.respostas.every(r => r && (r.tipo === "texto" || r.tipo === "produtos" || r.tipo === "acoes"));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConversa(contexto: ContextoEnvio) {
  const [estado, setEstado] = useState<Estado>(() => carregar());
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const contextoRef = useRef(contexto);
  contextoRef.current = contexto;
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    salvar(estado);
  }, [estado]);

  const acrescentar = useCallback((novas: Mensagem[]) => {
    setEstado(e => ({ ...e, mensagens: [...e.mensagens, ...novas].slice(-MAX_MENSAGENS) }));
  }, []);

  const linkWhats = useCallback((resumo: string | null) => {
    const c = contextoRef.current;
    return linkPassagemWhatsapp({
      sessaoId: estadoRef.current.sessaoId,
      host: typeof window !== "undefined" ? window.location.host : null,
      produto: c.produto ? { slug: c.produto.slug, titulo: c.produto.titulo } : null,
      unidade: c.unidade ?? null,
      resumo,
    });
  }, []);

  const postar = useCallback(
    async (texto: string) => {
      enviandoRef.current = true;
      setEnviando(true);
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const r = await fetch("/api/assistente/mensagens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessaoId: estadoRef.current.sessaoId, texto, contexto: contextoRef.current }),
          signal: ctrl.signal,
        });
        const corpo: unknown = await r.json().catch(() => null);
        if (r.ok && saidaValida(corpo)) {
          acrescentar([
            {
              id: novoUuid(),
              autor: "assistente",
              respostas: corpo.respostas,
              transbordo: corpo.transbordo,
              modo: corpo.modo,
              em: Date.now(),
            },
          ]);
        } else if (r.status === 429) {
          const c = (corpo ?? {}) as { mensagem?: string; whatsappUrl?: string };
          acrescentar([
            {
              id: novoUuid(),
              autor: "aviso",
              texto: c.mensagem || "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.",
              whatsappUrl: hrefSeguro(c.whatsappUrl) ? c.whatsappUrl : undefined,
              em: Date.now(),
            },
          ]);
        } else {
          acrescentar([
            {
              id: novoUuid(),
              autor: "aviso",
              texto: "Não consegui responder agora. Tente de novo ou fale com a consultora pelo WhatsApp.",
              reenviar: r.status >= 500 ? texto : undefined,
              em: Date.now(),
            },
          ]);
        }
      } catch {
        acrescentar([
          {
            id: novoUuid(),
            autor: "aviso",
            texto: "Sem conexão com a assistente. Confira a internet e tente de novo, ou fale com a consultora pelo WhatsApp.",
            reenviar: texto,
            em: Date.now(),
          },
        ]);
      } finally {
        window.clearTimeout(timer);
        enviandoRef.current = false;
        setEnviando(false);
      }
    },
    [acrescentar],
  );

  /** Envia o texto como mensagem da cliente. Devolve false se não enviou. */
  const enviar = useCallback(
    (bruto: string): boolean => {
      const texto = bruto.trim().slice(0, LIMITE_TEXTO);
      if (!texto || enviandoRef.current) return false;

      // Receita, CPF ou cartão não saem do aparelho: a resposta é local.
      if (pareceDadoSensivel(texto)) {
        acrescentar([
          {
            id: novoUuid(),
            autor: "cliente",
            texto: "Mensagem não enviada: tinha dados da receita, CPF ou cartão.",
            retida: true,
            em: Date.now(),
          },
          {
            id: novoUuid(),
            autor: "assistente",
            local: true,
            em: Date.now(),
            respostas: [
              {
                tipo: "texto",
                texto:
                  "Por segurança, essa mensagem não foi enviada: não mande dados da receita, CPF ou cartão por aqui. Para o orçamento de lentes, use o envio seguro na página Lentes de grau ou mande a receita pelo WhatsApp, direto para a consultora.",
              },
              {
                tipo: "acoes",
                acoes: [
                  { rotulo: "Enviar receita com segurança", href: "/lentes-de-grau" },
                  { rotulo: "Enviar pelo WhatsApp", href: linkWhats("Quero um orçamento de lentes de grau.") },
                ],
              },
            ],
          },
        ]);
        return true;
      }

      acrescentar([{ id: novoUuid(), autor: "cliente", texto, em: Date.now() }]);
      void postar(texto);
      return true;
    },
    [acrescentar, linkWhats, postar],
  );

  /** "Tentar de novo" num aviso de erro: some com o aviso e reenvia sem duplicar a pergunta. */
  const reenviar = useCallback(
    (avisoId: string, texto: string) => {
      if (enviandoRef.current) return;
      setEstado(e => ({ ...e, mensagens: e.mensagens.filter(m => m.id !== avisoId) }));
      void postar(texto);
    },
    [postar],
  );

  /** Boas-vindas na primeira abertura, e de novo quando a cliente abre em outro produto. */
  const saudar = useCallback((produto: ProdutoEnvio | null | undefined) => {
    setEstado(e => {
      const slug = produto?.slug ?? null;
      const vazia = e.mensagens.length === 0;
      if (!vazia && (!slug || slug === e.produtoSaudado)) return e;
      const msg: Mensagem = {
        id: novoUuid(),
        autor: "assistente",
        local: true,
        respostas: boasVindas(produto, vazia),
        em: Date.now(),
      };
      return { ...e, produtoSaudado: slug, mensagens: [...e.mensagens, msg].slice(-MAX_MENSAGENS) };
    });
  }, []);

  const apagarConversa = useCallback(() => {
    const novo = apagar();
    setEstado({
      ...novo,
      produtoSaudado: contextoRef.current.produto?.slug ?? null,
      mensagens: [
        {
          id: novoUuid(),
          autor: "assistente",
          local: true,
          respostas: boasVindas(contextoRef.current.produto, true),
          em: Date.now(),
        },
      ],
    });
  }, []);

  const ultimaPergunta =
    [...estado.mensagens]
      .reverse()
      .find((m): m is Extract<Mensagem, { autor: "cliente" }> => m.autor === "cliente" && !m.retida)?.texto ?? null;

  return {
    sessaoId: estado.sessaoId,
    mensagens: estado.mensagens,
    enviando,
    enviar,
    reenviar,
    saudar,
    apagarConversa,
    ultimaPergunta,
  };
}
