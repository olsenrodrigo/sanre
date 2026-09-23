/**
 * Modo roteiro — o que a assistente responde enquanto o agente de IA não
 * existe (ou quando ele falha). Determinístico: intenção por palavra-chave,
 * dados da loja de shared/, preço sempre lido do banco.
 *
 * Regras que não se negociam aqui:
 *  - Decreto 24.492/1934, art. 13: não indicar tipo de lente nem grau.
 *  - Receita é dado de saúde: nunca pedir para colar no chat.
 *  - Horário não confirmado não é informado (shared/unidades.ts).
 *  - Não prometer estoque nem prazo que o sistema não sabe.
 *  - Toda resposta termina com ações (chips).
 */
import type { Product } from "@shared/schema";
import { descontoPix, PIX_DESCONTO } from "@shared/pagamento";
import { UNIDADES, enderecoCompleto, type Unidade } from "@shared/unidades";
import {
  linkPassagemWhatsapp,
  pareceDadoSensivel,
  resumirPergunta,
  type AcaoAssistente,
  type RespostaAssistente,
  type SaidaAssistente,
} from "../../client/src/components/assistente/protocolo";
import { PARCELAS_SEM_JUROS, WHATSAPP_LABEL, parcela, precoBR } from "../../client/src/lib/marca";
import { loadConfig as configFrete } from "../smartenvios/config";
import {
  MARCAS,
  buscarProdutos,
  categoriaDoProduto,
  descreverBusca,
  linkVerTodos,
  produtoPorSlug,
  temFiltroDeProduto,
  type FiltrosBusca,
} from "./catalogo";
import type { ContextoValidado } from "./contrato";
import { detectarIntencao, type AspectoFicha, type Intencao } from "./intencoes";
import { gravarSessao, lerSessao, type EstadoSessao } from "./limites";
import { normalizar } from "./normalizar";

export interface PedidoRoteiro {
  sessaoId: string;
  texto: string;
  contexto?: ContextoValidado;
  /** Host público para o link do produto na mensagem do WhatsApp. */
  host: string | null;
}

export interface ResultadoRoteiro {
  saida: SaidaAssistente;
  intencao: Intencao;
}

// ─── Blocos ──────────────────────────────────────────────────────────────────

const texto = (t: string): RespostaAssistente => ({ tipo: "texto", texto: t });
const acoes = (lista: (AcaoAssistente | null | false | undefined)[]): RespostaAssistente => ({
  tipo: "acoes",
  acoes: lista.filter((a): a is AcaoAssistente => Boolean(a)).slice(0, 5),
});
const enviar = (rotulo: string, frase: string): AcaoAssistente => ({ rotulo, enviar: frase });
const link = (rotulo: string, href: string): AcaoAssistente => ({ rotulo, href });

const PIX_PCT = `${Math.round(PIX_DESCONTO * 100)}%`;

const CHIP = {
  sol: enviar("Óculos de sol", "Quero ver óculos de sol"),
  armacoes: enviar("Armações de grau", "Quero ver armações de óculos de grau"),
  grau: enviar("Lentes de grau", "Como funciona o orçamento de lentes de grau?"),
  lojas: enviar("Lojas e endereços", "Onde ficam as lojas?"),
  pagamento: enviar("Formas de pagamento", "Quais as formas de pagamento?"),
  entrega: enviar("Entrega e retirada", "Como funciona a entrega e a retirada na loja?"),
  trocas: enviar("Trocas e garantia", "Como funciona a troca e a garantia?"),
  provador: link("Provador virtual", "/provador"),
  receita: link("Enviar receita com segurança", "/lentes-de-grau"),
};

function nomeMaterial(m: string): string {
  const mapa: Record<string, string> = {
    acetato: "acetato",
    metal: "metal",
    titanio: "titânio",
    injetado: "material injetado",
    tr90: "TR-90, um material flexível",
    misto: "acetato e metal",
    policarbonato: "policarbonato",
  };
  return mapa[m] ?? m;
}

function unidadesCitadas(t: string, preferida?: string | null): Unidade[] {
  const cit = UNIDADES.filter(u =>
    u.slug === "cravinhos" ? /\bcravinhos\b/.test(t) : /\b(ribeirao|rp|pb arts|galeria)\b/.test(t),
  );
  if (cit.length) return cit;
  if (preferida) {
    const u = UNIDADES.find(x => x.slug === preferida);
    if (u) return [u, ...UNIDADES.filter(x => x.slug !== preferida)];
  }
  return UNIDADES;
}

function horarioDe(u: Unidade): string | null {
  if (!u.horarioConfirmado || !u.horario.length) return null;
  return u.horario.map(h => `${h.dias}, ${h.abre.replace(":00", "h")} às ${h.fecha.replace(":00", "h")}`).join("; ");
}

// ─── Resposta principal ──────────────────────────────────────────────────────

export async function responderPeloRoteiro(p: PedidoRoteiro): Promise<ResultadoRoteiro> {
  const t = normalizar(p.texto);
  const sensivel = pareceDadoSensivel(p.texto);
  const produtoCtx = p.contexto?.produto ?? null;
  const unidadeCtx = p.contexto?.unidade ?? null;
  const estado = lerSessao(p.sessaoId);
  const det = detectarIntencao(t, { temProduto: Boolean(produtoCtx), sensivel });
  let intencao = det.intencao;

  const wa = (resumo?: string | null) =>
    linkPassagemWhatsapp({
      sessaoId: p.sessaoId,
      host: p.host,
      produto: produtoCtx ? { slug: produtoCtx.slug, titulo: produtoCtx.titulo } : null,
      unidade: unidadeCtx,
      resumo: resumo ?? null,
    });
  const duvida = sensivel ? null : resumirPergunta(p.texto);
  const consultora = (rotulo = "Falar com a consultora", resumo: string | null = duvida) =>
    link(rotulo, wa(resumo));

  const novo: EstadoSessao = { ...estado, naoEntendeu: 0 };
  let respostas: RespostaAssistente[] = [];
  let transbordo: SaidaAssistente["transbordo"];

  // Palavra solta ("wayfarer", "clubmaster") sem outra pista: tenta o catálogo.
  const palavraSolta = intencao === "nao_entendeu" && det.filtros.termos.length > 0;
  if (palavraSolta) intencao = "busca";

  try {
    switch (intencao) {
      case "sensivel": {
        const receita = /\b(od|oe|esferico|cilindrico|eixo|dnp|adicao)\b/.test(t);
        respostas = [
          texto(
            "Por segurança, não envie dados da receita, CPF ou cartão por aqui. Para o orçamento de lentes, use o envio seguro na página Lentes de grau ou mande a receita pelo WhatsApp, direto para a consultora. Pagamento só é feito no checkout do site.",
          ),
          acoes([
            CHIP.receita,
            consultora("Enviar pelo WhatsApp", receita ? "Quero um orçamento de lentes de grau." : null),
            CHIP.pagamento,
          ]),
        ];
        novo.naoEntendeu = estado.naoEntendeu;
        break;
      }

      case "pessoa": {
        const resumo = estado.ultimaDuvida ?? "Quero falar com uma consultora.";
        transbordo = { whatsappUrl: wa(resumo), motivo: "cliente_pediu" };
        respostas = [
          texto(
            `Claro. A consultora da Sanrê atende pelo WhatsApp, no ${WHATSAPP_LABEL}. Toque em Continuar no WhatsApp: a mensagem já vai pronta, com o contexto desta conversa.`,
          ),
          acoes([CHIP.lojas, CHIP.pagamento]),
        ];
        break;
      }

      case "exame":
        respostas = [
          texto(
            "A Sanrê não faz exame de vista. Para ter a receita, procure um médico oftalmologista. Com a receita em mãos, a consultora monta o orçamento das lentes: você pode enviar pela página Lentes de grau ou levar a uma das lojas.",
          ),
          acoes([link("Lentes de grau", "/lentes-de-grau"), CHIP.lojas, consultora()]),
        ];
        break;

      case "grau":
        respostas = await responderGrau(t, produtoCtx?.slug, consultora);
        break;

      case "ficha":
        respostas = await responderFicha(det.aspecto!, produtoCtx!.slug, consultora);
        break;

      case "preco":
        respostas = produtoCtx
          ? await responderPreco(produtoCtx.slug, consultora)
          : [
              texto(
                "Os preços variam por marca e modelo. Me diga qual modelo você procura, ou abra a página do produto e pergunte por aqui. Com lentes de grau, o valor depende da receita e é montado pela consultora.",
              ),
              acoes([enviar("Ray-Ban", "Quero ver Ray-Ban"), enviar("Oakley", "Quero ver Oakley"), CHIP.sol, CHIP.armacoes]),
            ];
        break;

      case "busca": {
        const r = await responderBusca(t, det.filtros, consultora, palavraSolta);
        if (r) respostas = r;
        else {
          intencao = "nao_entendeu";
        }
        break;
      }

      case "empresas": {
        const epi = await buscarProdutos({ categoria: "epi", termos: [] }, 2, false);
        respostas = [
          texto(
            "A Sanrê atende empresas com óculos de segurança (EPI), inclusive EPI com lente de grau para quem usa óculos no dia a dia. Na página Empresas você pede uma proposta com a quantidade e o tipo de uso, e a equipe retorna com modelos com CA e condições.",
          ),
          ...(epi.itens.length ? [{ tipo: "produtos" as const, itens: epi.itens }] : []),
          acoes([
            link("Pedir proposta", "/empresas"),
            link("Óculos de segurança", "/epi"),
            consultora("Falar com a equipe", "Sou de uma empresa e quero uma proposta de óculos de segurança (EPI)."),
          ]),
        ];
        break;
      }

      case "trocas":
        respostas = [
          texto(
            "Compras feitas pelo site podem ser devolvidas em até 7 dias corridos após o recebimento (direito de arrependimento, art. 49 do Código de Defesa do Consumidor). Em caso de defeito, vale a garantia legal e, quando houver, a do fabricante. Para pedir troca, devolução ou garantia, fale com a equipe pelo WhatsApp informando o número do pedido.",
          ),
          acoes([
            link("Trocas e devoluções", "/trocas-e-devolucoes"),
            consultora("Falar com a equipe", "Quero falar sobre troca, devolução ou garantia."),
            CHIP.lojas,
          ]),
        ];
        break;

      case "entrega": {
        const frete = configFrete().rules.freeShippingAbove;
        const gratis = frete > 0 ? ` Em compras acima de ${precoBR(frete)}, o frete é grátis.` : "";
        respostas = [
          texto(
            `Você pode retirar sem custo em uma das lojas, em Cravinhos ou em Ribeirão Preto: é só escolher a retirada ao finalizar a compra. Também enviamos para todo o Brasil; o valor e o prazo do frete aparecem no checkout, a partir do CEP.${gratis}`,
          ),
          acoes([CHIP.lojas, CHIP.pagamento, link("Ir para a sacola", "/loja/carrinho"), consultora()]),
        ];
        break;
      }

      case "pagamento": {
        const partes = [
          `No site, você paga com PIX (${PIX_PCT} de desconto nos produtos), cartão de crédito em até ${PARCELAS_SEM_JUROS}x sem juros ou boleto. O desconto do PIX não vale para o frete.`,
        ];
        if (produtoCtx) {
          const prod = await produtoPorSlug(produtoCtx.slug);
          if (prod) partes.push(detalhePreco(prod));
        }
        respostas = [texto(partes.join(" ")), acoes([CHIP.entrega, CHIP.trocas, link("Ver a vitrine", "/loja"), consultora()])];
        break;
      }

      case "provador":
        respostas = [
          texto(
            "No provador virtual você experimenta as armações pela câmera do celular ou do computador. A imagem é processada no seu próprio aparelho e não é enviada para a loja. Se preferir experimentar pessoalmente, as lojas ficam em Cravinhos e em Ribeirão Preto.",
          ),
          acoes([link("Abrir o provador", "/provador"), CHIP.lojas, consultora()]),
        ];
        break;

      case "unidades": {
        const lista = unidadesCitadas(t, unidadeCtx);
        const perguntouHorario = /\b(horario|horarios|abre|abrem|fecha|fecham|funcionamento|aberto|aberta|sabado|domingo|feriado)\b/.test(t);
        const linhas = lista.map(u => {
          const extra = u.complemento ? ` (${u.complemento.charAt(0).toLowerCase()}${u.complemento.slice(1)})` : "";
          const h = horarioDe(u);
          return `${u.nome}: ${enderecoCompleto(u)}${extra}.${h ? ` Horário: ${h}.` : ""}`;
        });
        const semHorario = lista.some(u => !horarioDe(u));
        const aviso = semHorario
          ? perguntouHorario
            ? `O horário de atendimento ainda está sendo confirmado. Para não te passar informação errada, confirme pelo WhatsApp ${WHATSAPP_LABEL} antes de ir.`
            : `Antes de ir, confirme o horário pelo WhatsApp ${WHATSAPP_LABEL}.`
          : "";
        const intro = lista.length > 1 ? "A Sanrê tem duas lojas:" : "";
        respostas = [
          texto([intro, ...linhas, aviso].filter(Boolean).join("\n")),
          acoes([
            ...lista.map(u => link(`Como chegar — ${u.cidade}`, u.mapsUrl)),
            lista.length === 1 ? link("Conhecer a loja", `/unidades/${lista[0].slug}`) : null,
            consultora(
              "Confirmar horário",
              lista.length === 1 ? `Quero confirmar o horário da loja de ${lista[0].cidade}.` : "Quero confirmar o horário das lojas.",
            ),
          ]),
        ];
        break;
      }

      case "marcas": {
        const sol = MARCAS.filter(m => m.nome !== "Nanovista").map(m => m.nome);
        respostas = [
          texto(
            `A Sanrê trabalha com ${sol.join(", ")} e Nanovista, entre outras. Nas lentes de grau, Varilux e Zeiss. Nem todo modelo da loja está no site: se procura um específico, a consultora confere para você.`,
          ),
          acoes([
            link("Todas as marcas", "/marcas"),
            enviar("Ray-Ban", "Quero ver Ray-Ban"),
            enviar("Oakley", "Quero ver Oakley"),
            enviar("Tom Ford", "Quero ver Tom Ford"),
          ]),
        ];
        break;
      }

      case "agradecimento":
        respostas = [
          texto("Por nada. Se surgir outra dúvida, é só escrever por aqui, ou chamar a consultora no WhatsApp."),
          acoes([CHIP.sol, CHIP.grau, CHIP.lojas, consultora("Falar com a consultora", estado.ultimaDuvida)]),
        ];
        break;

      case "saudacao":
        respostas = produtoCtx
          ? [
              texto(
                `Olá! Posso te ajudar com o ${produtoCtx.titulo}? Pergunte sobre preço, medidas, lentes de grau ou retirada na loja.`,
              ),
              acoes([
                enviar("Quanto custa?", "Quanto custa?"),
                enviar("Aceita lente de grau?", "Essa armação aceita lente de grau?"),
                CHIP.pagamento,
                consultora("Falar com a consultora", null),
              ]),
            ]
          : [
              texto(
                "Olá! Sou a assistente da Sanrê. Posso te ajudar a encontrar óculos, explicar como funciona o orçamento de lentes de grau, formas de pagamento, entrega e as lojas de Cravinhos e Ribeirão Preto.",
              ),
              acoes([CHIP.sol, CHIP.grau, CHIP.lojas, CHIP.pagamento]),
            ];
        break;

      default:
        break;
    }
  } catch (e) {
    // Banco fora do ar não pode virar 500 no chat. Loga só o tipo do erro.
    console.error(`[assistente] roteiro falhou em "${intencao}": ${(e as Error)?.name ?? "erro"}`);
    respostas = [
      texto("Não consegui consultar o catálogo agora. Tente de novo em instantes, ou fale com a consultora pelo WhatsApp."),
      acoes([consultora(), CHIP.lojas]),
    ];
  }

  if (intencao === "nao_entendeu") {
    novo.naoEntendeu = estado.naoEntendeu + 1;
    if (novo.naoEntendeu >= 2) {
      novo.naoEntendeu = 0;
      transbordo = { whatsappUrl: wa(duvida), motivo: "nao_entendeu" };
      respostas = [
        texto("Acho melhor você falar com a consultora: pelo WhatsApp ela continua a partir daqui, com a sua pergunta."),
        acoes([CHIP.sol, CHIP.grau, CHIP.lojas]),
      ];
    } else {
      respostas = [
        texto(
          "Não entendi bem. Posso te ajudar a encontrar óculos por marca, formato ou preço, e tirar dúvidas sobre lentes de grau, pagamento, entrega e as lojas.",
        ),
        acoes([CHIP.sol, CHIP.grau, CHIP.lojas, consultora()]),
      ];
    }
  }

  // Cumprimento junto com a pergunta ("Oi, vocês têm Ray-Ban?").
  if (det.cumprimentou && respostas[0]?.tipo === "texto" && !respostas[0].texto.startsWith("Olá")) {
    respostas[0] = texto(`Olá! ${respostas[0].texto}`);
  }

  // Memória curta: a última dúvida útil vai na mensagem do WhatsApp se ela pedir uma pessoa.
  const semConteudo: Intencao[] = ["pessoa", "saudacao", "agradecimento", "sensivel", "nao_entendeu"];
  if (duvida && !semConteudo.includes(intencao)) novo.ultimaDuvida = duvida;
  gravarSessao(p.sessaoId, novo);

  return {
    intencao,
    saida: { modo: "roteiro", respostas, ...(transbordo ? { transbordo } : {}) },
  };
}

// ─── Intenções com dados do catálogo ─────────────────────────────────────────

type Consultora = (rotulo?: string, resumo?: string | null) => AcaoAssistente;

function detalhePreco(p: Product): string {
  const preco = Number(p.price);
  const pix = Math.round((preco - descontoPix(preco)) * 100) / 100;
  return `O ${p.title} está por ${precoBR(preco)} no site. No PIX, sai por ${precoBR(pix)} (${PIX_PCT} de desconto); no cartão, em até ${PARCELAS_SEM_JUROS}x de ${parcela(preco)} sem juros.`;
}

const NAO_ACHEI_PRODUTO =
  "Não encontrei esse modelo no catálogo do site agora. A consultora confere para você pelo WhatsApp.";

async function responderPreco(slug: string, consultora: Consultora): Promise<RespostaAssistente[]> {
  const p = await produtoPorSlug(slug);
  if (!p) return [texto(NAO_ACHEI_PRODUTO), acoes([consultora(), CHIP.sol])];
  const grau = p.acceptsRx
    ? " Com lentes de grau, o valor das lentes entra no orçamento que a consultora monta a partir da sua receita."
    : "";
  return [
    texto(detalhePreco(p) + grau),
    acoes([
      CHIP.pagamento,
      enviar("Retirar na loja", "Posso retirar na loja?"),
      p.acceptsRx ? enviar("Aceita lente de grau?", "Essa armação aceita lente de grau?") : null,
      consultora(),
    ]),
  ];
}

async function responderFicha(
  aspecto: AspectoFicha,
  slug: string,
  consultora: Consultora,
): Promise<RespostaAssistente[]> {
  const p = await produtoPorSlug(slug);
  if (!p) return [texto(NAO_ACHEI_PRODUTO), acoes([consultora(), CHIP.sol])];
  const categoria = await categoriaDoProduto(p);
  const nome = p.title;
  let frase: string;
  const extras: (AcaoAssistente | null)[] = [];

  switch (aspecto) {
    case "polarizado":
      if (categoria === "oculos-de-grau" || categoria === "epi") {
        frase = `O ${nome} é uma armação de grau: as lentes são definidas no orçamento, a partir da sua receita.`;
      } else if (p.lensPolarized) {
        frase = `Sim, a lente do ${nome} é polarizada: ela reduz o reflexo de superfícies como água, vidro e asfalto.`;
      } else {
        frase = `Pela ficha do site, a lente do ${nome} não é polarizada.`;
        extras.push(enviar("Ver polarizados", "Quero ver óculos polarizados"));
      }
      break;
    case "uv":
      frase = p.uvProtection
        ? `Proteção do ${nome}: ${p.uvProtection}.`
        : `A ficha do site não informa a proteção UV do ${nome}. A consultora confirma para você.`;
      break;
    case "medidas": {
      const m = [
        p.lensWidthMm && `lente ${p.lensWidthMm} mm`,
        p.bridgeMm && `ponte ${p.bridgeMm} mm`,
        p.templeMm && `haste ${p.templeMm} mm`,
        p.lensHeightMm && `altura da lente ${p.lensHeightMm} mm`,
      ].filter(Boolean);
      frase = m.length
        ? `Medidas do ${nome}: ${m.join(", ")}. Para comparar, veja os números gravados na parte interna da haste de um óculos que você já usa.`
        : `A ficha do ${nome} ainda não tem as medidas. A consultora confere para você.`;
      break;
    }
    case "material":
      frase = p.frameMaterial
        ? `A armação do ${nome} é de ${nomeMaterial(p.frameMaterial)}.`
        : `A ficha do site não informa o material do ${nome}. A consultora confirma para você.`;
      break;
    case "grau":
      if (p.acceptsRx) {
        frase = `Sim, a armação do ${nome} aceita lentes de grau. O orçamento das lentes é montado pela consultora seguindo a sua receita; pelo site, você envia a receita com segurança na página Lentes de grau. Por aqui, não envie dados da receita.`;
        extras.push(CHIP.receita);
      } else {
        frase = `A ficha do ${nome} não indica montagem com lentes de grau. A consultora confirma se é possível e mostra armações que aceitam grau.`;
        extras.push(CHIP.armacoes);
      }
      break;
    case "geral":
      frase = `Claro. Sobre o ${nome}, posso te passar o preço, as medidas, o material e se a armação aceita lente de grau. O que você quer saber?`;
      extras.push(enviar("Medidas", "Quais as medidas?"), p.acceptsRx ? enviar("Aceita lente de grau?", "Essa armação aceita lente de grau?") : null);
      break;
    case "estoque":
    default:
      frase =
        "A disponibilidade para compra aparece na página do produto, ao escolher cor e tamanho. Para saber se o modelo está em uma das lojas para experimentar, a consultora confere pelo WhatsApp.";
      break;
  }

  return [
    texto(frase),
    acoes([
      ...extras,
      enviar("Quanto custa?", "Quanto custa?"),
      p.tryonImageUrl ? CHIP.provador : null,
      consultora(),
    ]),
  ];
}

async function responderGrau(
  t: string,
  slug: string | undefined,
  consultora: Consultora,
): Promise<RespostaAssistente[]> {
  const partes: string[] = [];
  if (/\b(varilux|zeiss)\b/.test(t)) partes.push("A Sanrê trabalha com lentes Varilux e Zeiss.");
  if (/\b(qual|que|melhor) lente\b|\b(indica|recomenda|sugere)\b/.test(t)) {
    partes.push("Pelo chat eu não indico tipo de lente nem grau: isso vem da sua receita.");
  }
  partes.push(
    "O orçamento de lentes de grau é montado pela consultora a partir da sua receita, seguindo o que o oftalmologista prescreveu, e o valor é confirmado com você antes de qualquer cobrança.",
  );
  if (slug) {
    const p = await produtoPorSlug(slug);
    if (p?.acceptsRx) partes.push(`Para montar o ${p.title} com as suas lentes, envie a receita pela página Lentes de grau.`);
  }
  partes.push("Para enviar a receita com segurança, use a página Lentes de grau ou o WhatsApp. Por aqui, não envie foto nem dados da receita.");
  return [
    texto(partes.join(" ")),
    acoes([
      CHIP.receita,
      consultora("Enviar pelo WhatsApp", "Quero um orçamento de lentes de grau."),
      enviar("Não tenho receita", "Não tenho receita. Vocês fazem exame de vista?"),
      link("Ver armações de grau", "/oculos-de-grau"),
    ]),
  ];
}

async function responderBusca(
  t: string,
  f: FiltrosBusca,
  consultora: Consultora,
  palavraSolta: boolean,
): Promise<RespostaAssistente[] | null> {
  const filtro = temFiltroDeProduto(f);
  const comFiltro = filtro || f.termos.length > 0;
  // "Procuro um óculos que não achei no site."
  if (!comFiltro && /\bnao (achei|encontrei|acho|encontro)\b|\b(nao (tem|esta) no site|fora do site)\b/.test(t)) {
    return [
      texto(
        "Nem todo modelo da loja está no site. Me diga a marca e o modelo que você procura; se não estiver aqui, a consultora confere nas lojas pelo WhatsApp, e por lá você pode mandar uma foto do óculos.",
      ),
      acoes([
        consultora("Perguntar à consultora", "Procuro um modelo que não encontrei no site."),
        enviar("Marcas da loja", "Quais marcas vocês trabalham?"),
        link("Ver a vitrine", "/loja"),
      ]),
    ];
  }
  // Só palavra livre ("chanel", "wayfarer"): busca exata, sem "opção próxima".
  const r = await buscarProdutos(f, 4, filtro);
  const descricao = descreverBusca(f);
  if (!r.itens.length) {
    // Palavra solta que não achou nada ("zzzz"): não é busca, é "não entendi".
    if (palavraSolta) return null;
    if (!filtro && f.termos.length) {
      return [
        texto(
          `Não encontrei "${f.termos.join(" ")}" entre os óculos do site agora. Se for um modelo específico, a consultora confere para você pelo WhatsApp.`,
        ),
        acoes([consultora("Perguntar à consultora"), link("Ver a vitrine", "/loja"), enviar("Marcas da loja", "Quais marcas vocês trabalham?")]),
      ];
    }
    return semResultado(comFiltro ? descricao : "óculos", consultora);
  }

  const confirmaMarca =
    f.marca && /\b(trabalham|trabalha|tem|vendem|vende|revendem)\b/.test(t) ? `Sim, a Sanrê trabalha com ${f.marca}. ` : "";
  let abertura: string;
  if (!comFiltro) {
    abertura = "Separei alguns modelos do site. Me diga a marca, o formato ou a faixa de preço que eu filtro para você.";
  } else if (r.aproximado) {
    abertura = `Não encontrei exatamente ${descricao} no site agora. Estes são os mais próximos:`;
  } else {
    abertura =
      r.itens.length === 1
        ? `Encontrei este modelo de ${descricao} no site. No PIX, ${PIX_PCT} de desconto.`
        : `Encontrei estes modelos de ${descricao} no site. No PIX, ${PIX_PCT} de desconto.`;
  }

  return [
    texto(confirmaMarca + abertura),
    { tipo: "produtos", itens: r.itens },
    acoes(
      comFiltro
        ? [
            link(r.total > r.itens.length ? `Ver todos (${r.total})` : "Ver na vitrine", linkVerTodos(f)),
            f.categoria === "epi" ? link("Proposta para empresa", "/empresas") : CHIP.provador,
            consultora(),
          ]
        : [CHIP.sol, CHIP.armacoes, enviar("Até R$ 500", "Óculos até 500 reais"), link("Ver a vitrine", "/loja")],
    ),
  ];
}

function semResultado(descricao: string, consultora: Consultora): RespostaAssistente[] {
  return [
    texto(
      `Não encontrei ${descricao} publicado no site agora. Nem todo modelo da loja está no site: a consultora confere para você pelo WhatsApp.`,
    ),
    acoes([consultora("Perguntar à consultora"), link("Ver a vitrine", "/loja"), enviar("Marcas da loja", "Quais marcas vocês trabalham?")]),
  ];
}
