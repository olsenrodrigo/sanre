/**
 * Detecção de intenção do modo roteiro — determinística, por palavras-chave
 * sobre o texto normalizado (sem acento, minúsculo). Cada intenção soma pontos
 * pelos padrões que casam; vence a maior soma e, no empate, a que vem antes em
 * PRIORIDADE (a mais específica/sensível primeiro).
 */
import { interpretarBusca, temFiltroDeProduto, type FiltrosBusca } from "./catalogo";

export type Intencao =
  | "sensivel"
  | "pessoa"
  | "exame"
  | "ficha"
  | "grau"
  | "empresas"
  | "trocas"
  | "entrega"
  | "pagamento"
  | "provador"
  | "unidades"
  | "marcas"
  | "preco"
  | "busca"
  | "agradecimento"
  | "saudacao"
  | "nao_entendeu";

export type AspectoFicha = "polarizado" | "uv" | "medidas" | "material" | "grau" | "estoque" | "geral";

type Regra = [RegExp, number];

const REGRAS: Partial<Record<Intencao, Regra[]>> = {
  pessoa: [
    [/\b(falar|conversar|atendimento|atender|chamar|ligar|contato)\b.*\b(pessoa|atendente|humano|humana|consultora|consultor|vendedora|vendedor|alguem|gente|equipe|voces)\b/, 3],
    [/\b(atendente|humano|humana|atendimento humano|pessoa de verdade)\b/, 2],
    [/\b(whats ?app|zap|wpp|whats)\b/, 2],
    [/\b(telefone|numero de voces|numero da loja|ligar)\b/, 2],
  ],
  exame: [
    [/\bexames?\b/, 3],
    [/\b(oftalmo|oftalmologista|oculista)\b/, 3],
    [/\bconsulta (de|com) (vista|olhos?)\b/, 3],
    [/\b(medir|medem|mede|aferir) (o |meu )?grau\b/, 3],
    [/\b(fazer|fazem|faz|tirar) (a |uma )?receita\b/, 3],
  ],
  grau: [
    [/\blentes? (de|com) grau\b/, 3],
    [/\breceitas?\b/, 3],
    [/\b(multifoca\w*|progressiva\w*|bifoca\w*|monofoca\w*)\b/, 3],
    [/\b(miopia|astigmatismo|hipermetropia|presbiopia|vista cansada)\b/, 3],
    [/\b(qual|que|melhor) lente\b/, 3],
    [/\b(varilux|zeiss|transitions|fotossensive\w*|antirreflexo|anti-reflexo|filtro azul|luz azul|blue ?cut)\b/, 2],
    [/\borcamento\b/, 2],
    [/\blentes?\b/, 1],
    [/\bgrau\b/, 1],
  ],
  empresas: [
    [/\b(empresas?|corporativ\w*|cnpj|funcionari\w*|colaborador\w*)\b/, 3],
    [/\b(epi|epis|nr-?6|seguranca do trabalho|oculos de (seguranca|protecao))\b/, 3],
  ],
  trocas: [
    [/\b(troca|trocas|trocar|devolu\w*|devolver|arrependimento|reembolso|estorno)\b/, 3],
    [/\b(garantia|defeito|quebrou|quebrado|quebrada|descascou|soltou)\b/, 3],
  ],
  entrega: [
    [/\b(entrega\w*|enviam|envia|envio|frete|correios?|transportadora|rastre\w*)\b/, 3],
    [/\b(retira\w*|buscar na loja|pegar na loja|pego na loja|busco na loja)\b/, 3],
    [/\b(prazo|demora|chega em|quando chega)\b/, 2],
  ],
  pagamento: [
    [/\b(pagamento|pagar|pago|pix|cartao|credito|debito|boleto|crediario)\b/, 3],
    [/\b(parcel\w*|vezes|sem juros|juros|a vista)\b/, 3],
    [/\bdesconto\b/, 2],
  ],
  provador: [
    [/\b(provador|realidade aumentada|virtual)\b/, 3],
    [/\b(provar|experimentar|experimento|experimenta)\b/, 2],
    [/\b(camera|no meu rosto|em mim|como fica (no|em) (meu|mim))\b/, 2],
  ],
  unidades: [
    [/\b(endereco|enderecos|onde (fica|ficam|voces ficam|e a loja|e)|localizacao|como chegar|mapa)\b/, 3],
    [/\b(horario|horarios|abre|abrem|fecha|fecham|funcionamento|aberto|aberta|sabado|domingo|feriado)\b/, 3],
    [/\b(loja fisica|lojas fisicas|unidade|unidades|filial)\b/, 2],
    [/\b(cravinhos|ribeirao|pb arts|galeria)\b/, 1],
    [/\blojas?\b/, 1],
  ],
  marcas: [
    [/\b(marcas?|grifes?)\b/, 2],
    [/\b(trabalham com|vendem|revendem)\b/, 1],
  ],
  preco: [
    [/\bquanto (custa|e|sai|fica|ta|esta|seria)\b/, 2],
    [/\b(preco|precos|valor|valores|custa)\b/, 2],
  ],
  busca: [
    [/\b(oculos|armacao|armacoes|modelo|modelos|opcoes|novidades?|lancamentos?)\b/, 1],
    [/\b(procuro|procurando|quero ver|queria ver|mostra|mostre|mostrar|tem|tem algum|tem alguma|voces tem)\b/, 1],
  ],
  agradecimento: [[/\b(obrigad\w*|brigad\w*|valeu|agradec\w*|tchau|ate mais|ate logo)\b/, 1]],
  saudacao: [[/^(oi+|ola|opa|bom dia|boa tarde|boa noite|hey|hello|e ai|tudo bem)\b/, 1]],
};

const PRIORIDADE: Intencao[] = [
  "sensivel", "pessoa", "exame", "ficha", "grau", "empresas", "trocas", "entrega", "pagamento",
  "provador", "unidades", "marcas", "preco", "busca", "agradecimento", "saudacao",
];

const ASPECTOS: [AspectoFicha, RegExp][] = [
  ["grau", /\b(aceita|pode|posso|da pra|da para|consigo|serve|faz|fazem|monta|montar|colocar|por)\b.*\b(grau|lente de grau|receita)\b|\bcom grau\b/],
  ["polarizado", /\bpolariza\w*\b/],
  ["uv", /\b(uv|uv400|protecao (uv|solar|ultravioleta))\b/],
  ["medidas", /\b(medidas?|tamanho|tamanhos|largura|ponte|haste|calibre|grande|pequeno|serve no meu rosto)\b/],
  ["material", /\b(material|acetato|metal|titanio|feito de|plastico|resistente)\b/],
  ["estoque", /\b(estoque|disponivel|disponibilidade|pronta entrega|ainda tem|acabou|esgotad\w*|tem na loja|tem nas lojas)\b/],
  // "Tenho uma dúvida sobre o Ray-Ban Aviator" (botão da página do produto).
  ["geral", /\b(duvida|duvidas|pergunta|saber mais|informac\w*|detalhes)\b/],
];

export interface Deteccao {
  intencao: Intencao;
  pontos: Partial<Record<Intencao, number>>;
  filtros: FiltrosBusca;
  aspecto?: AspectoFicha;
  cumprimentou: boolean;
}

export function detectarIntencao(
  t: string,
  opts: { temProduto: boolean; sensivel: boolean },
): Deteccao {
  const filtros = interpretarBusca(t);
  const pontos: Partial<Record<Intencao, number>> = {};
  const somar = (i: Intencao, n: number) => {
    pontos[i] = (pontos[i] ?? 0) + n;
  };

  for (const [intencao, regras] of Object.entries(REGRAS) as [Intencao, Regra[]][]) {
    for (const [re, peso] of regras) if (re.test(t)) somar(intencao, peso);
  }

  // Filtro de produto reconhecido (marca, formato, tipo, preço…) é busca.
  if (temFiltroDeProduto(filtros)) {
    let n = 2;
    if (filtros.marca) n += 1;
    if (filtros.formato || filtros.polarizado || filtros.publico) n += 1;
    somar("busca", n);
    // "tem Ray-Ban?", "trabalham com Oakley?" — responde com a vitrine da marca.
    if (filtros.marca) delete pontos.marcas;
  }
  // "óculos de grau" é armação (busca), não orçamento de lente.
  if (filtros.categoria === "oculos-de-grau" && !/\b(receita|lentes?|orcamento)\b/.test(t)) {
    if (pontos.grau) pontos.grau = Math.max(0, pontos.grau - 1);
  }
  if (filtros.categoria === "epi" && pontos.busca) somar("busca", 1);
  // "Tem EPI com grau?" é o serviço para empresas, não só a vitrine de EPI.
  if (filtros.categoria === "epi" && /\bgrau\b/.test(t)) somar("empresas", 2);

  // Pergunta sobre o produto que a cliente está vendo.
  let aspecto: AspectoFicha | undefined;
  if (opts.temProduto) {
    aspecto = ASPECTOS.find(([, re]) => re.test(t))?.[0];
    // "esse aceita lente de grau?" é sobre a armação aberta, não o orçamento genérico.
    if (aspecto) somar("ficha", aspecto === "grau" ? 6 : 4);
    if (pontos.preco) somar("preco", 1);
    // "esse é polarizado?" com produto aberto não é busca de polarizados.
    if (aspecto && !filtros.marca && !filtros.categoria && pontos.busca) pontos.busca = 0;
  }

  if (opts.sensivel) {
    return { intencao: "sensivel", pontos, filtros, aspecto, cumprimentou: false };
  }

  let melhor: Intencao = "nao_entendeu";
  let max = 0;
  for (const i of PRIORIDADE) {
    const p = pontos[i] ?? 0;
    if (p > max) {
      max = p;
      melhor = i;
    }
  }
  const cumprimentou = Boolean(pontos.saudacao) && melhor !== "saudacao";
  return { intencao: melhor, pontos, filtros, aspecto, cumprimentou };
}
