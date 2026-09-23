/**
 * Guias por intenção de busca (SEO/GEO).
 *
 * Formato citável: a resposta direta vem primeiro (`resposta`), o
 * aprofundamento depois, e cada guia tem FAQ marcada (FAQPage no servidor).
 * Regra de conteúdo (Decreto 24.492/1934, art. 13): nenhum guia indica lente
 * de grau para ninguém — explica o que existe e manda para o oftalmologista e
 * para a consultora com a receita.
 */
export interface Guia {
  slug: string;
  titulo: string;
  descricao: string;
  resposta: string;
  secoes: { titulo: string; paragrafos: string[] }[];
  faq: { pergunta: string; resposta: string }[];
  links: { rotulo: string; href: string }[];
}

export const GUIAS: Guia[] = [
  {
    slug: "como-escolher-armacao-pelo-formato-do-rosto",
    titulo: "Como escolher a armação pelo formato do rosto",
    descricao:
      "Rosto redondo, quadrado, oval, coração ou alongado: quais formatos de armação costumam equilibrar cada um, e por que a proporção importa mais que a regra.",
    resposta:
      "A regra prática é o contraste: rosto de linhas curvas fica equilibrado com armações de ângulos retos, e rosto de linhas marcadas fica mais suave com armações arredondadas. Mais importante que o formato é a proporção — a armação deve ter mais ou menos a largura do rosto na altura das têmporas e os olhos devem ficar perto do centro das lentes.",
    secoes: [
      {
        titulo: "Os cinco formatos de rosto mais comuns",
        paragrafos: [
          "Redondo: largura e altura parecidas, maçãs cheias e maxilar suave. Quadrados, retangulares e hexagonais alongam e dão estrutura.",
          "Quadrado: testa e maxilar largos e retos. Redondos, ovais e aviadores suavizam os ângulos.",
          "Oval: um pouco mais comprido que largo, com maçãs levemente mais largas. Aceita quase tudo — vale olhar a proporção.",
          "Coração: testa larga e queixo fino. Armações mais leves na parte de baixo, aviadores e redondos equilibram.",
          "Alongado: bem mais comprido que largo. Armações com mais altura de lente e detalhes nas laterais encurtam visualmente.",
        ],
      },
      {
        titulo: "Proporção vale mais que a tabela",
        paragrafos: [
          "Uma armação no formato 'certo' mas larga demais escorrega e deixa os olhos fora do centro da lente. Compare a medida gravada na haste do seu óculos atual com a do modelo novo e, se puder, experimente no provador virtual antes de decidir.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "Como descobrir o formato do meu rosto?",
        resposta:
          "Prenda o cabelo, fique de frente para o espelho e contorne o rosto com batom ou caneta de quadro. Compare largura da testa, das maçãs e do maxilar e o comprimento total. Na dúvida, a consultora da Sanrê ajuda na loja.",
      },
      {
        pergunta: "Posso usar um formato que 'não combina' com meu rosto?",
        resposta: "Pode. As recomendações são referência de equilíbrio, não regra. Estilo pessoal pesa tanto quanto geometria.",
      },
    ],
    links: [
      { rotulo: "Testar pelo formato do rosto", href: "/formato-do-rosto" },
      { rotulo: "Abrir o provador virtual", href: "/provador" },
    ],
  },
  {
    slug: "oculos-polarizado-ou-protecao-uv",
    titulo: "Óculos polarizado ou com proteção UV: qual a diferença",
    descricao:
      "Proteção UV bloqueia a radiação que faz mal aos olhos; polarização corta o reflexo de água, asfalto e vidro. Veja quando cada uma faz diferença.",
    resposta:
      "São coisas diferentes. A proteção UV filtra a radiação ultravioleta e é o que protege a saúde dos olhos — todo óculos de sol original tem. A polarização é um filtro a mais que corta o reflexo ofuscante de superfícies como água, asfalto molhado e para-brisa: melhora conforto e nitidez, mas não substitui a proteção UV.",
    secoes: [
      {
        titulo: "Quando o polarizado faz diferença",
        paragrafos: [
          "Para quem dirige muito, pesca, navega, pratica esportes na água ou na neve e para quem se incomoda com reflexo. No dia a dia da cidade, uma boa lente com proteção UV já resolve.",
          "Uma limitação conhecida: a lente polarizada pode deixar telas de celular, painéis de carro e visores de LCD escuros ou com manchas em certos ângulos.",
        ],
      },
      {
        titulo: "Como saber se o óculos protege",
        paragrafos: [
          "Óculos originais informam a proteção (100% UV, UV400) na etiqueta, na haste ou no certificado. Cor escura não é sinal de proteção: uma lente escura sem filtro dilata a pupila e deixa entrar mais radiação.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "Todo óculos polarizado tem proteção UV?",
        resposta: "Os originais das marcas que vendemos têm os dois filtros. A polarização sozinha não garante proteção UV — confira sempre a informação do fabricante.",
      },
      {
        pergunta: "Óculos de grau pode ser polarizado?",
        resposta: "Sim: existem lentes de grau com polarização. A consultora confirma a viabilidade com a sua receita e a armação escolhida.",
      },
    ],
    links: [
      { rotulo: "Ver óculos polarizados", href: "/oculos-de-sol?lente=polarizado" },
      { rotulo: "Todos os óculos de sol", href: "/oculos-de-sol" },
    ],
  },
  {
    slug: "lente-fotossensivel-vale-a-pena",
    titulo: "Lente fotossensível vale a pena?",
    descricao:
      "Como funciona a lente que escurece no sol, para quem costuma valer a pena, limitações (dentro do carro, tempo de clarear) e como pedir orçamento.",
    resposta:
      "A lente fotossensível escurece com a luz ultravioleta e clareia em ambientes internos. Costuma valer a pena para quem entra e sai de lugares fechados muitas vezes ao dia e não quer carregar dois óculos. Não substitui um óculos de sol para longas exposições, e escurece menos dentro do carro, porque o para-brisa filtra boa parte do UV.",
    secoes: [
      {
        titulo: "O que saber antes de pedir",
        paragrafos: [
          "Ela leva alguns segundos para escurecer e um pouco mais para clarear. O quanto escurece depende da intensidade do UV e da temperatura.",
          "Existem versões em cinza, marrom e outras cores, e ela pode ser combinada com antirreflexo. Quem define a lente adequada à sua receita é a consultora, com base na prescrição do oftalmologista.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "Fotossensível serve para dirigir?",
        resposta: "Dentro do carro ela escurece pouco, porque o para-brisa filtra UV. Para dirigir no sol, um óculos de sol (de grau, se precisar) costuma ser mais confortável.",
      },
      {
        pergunta: "Posso colocar fotossensível na armação que eu escolher?",
        resposta: "Na maioria das armações de grau, sim. A consultora confirma quando recebe a receita e a armação.",
      },
    ],
    links: [
      { rotulo: "Como funciona o óculos de grau pelo site", href: "/lentes-de-grau" },
      { rotulo: "Armações que aceitam grau", href: "/oculos-de-grau" },
    ],
  },
  {
    slug: "quanto-custa-oculos-multifocal",
    titulo: "Quanto custa um óculos multifocal",
    descricao:
      "O que forma o preço do óculos multifocal (lente, índice de refração, tratamentos, armação) e como sair da loja com um orçamento fechado a partir da sua receita.",
    resposta:
      "Não existe preço único: o valor depende da receita, da tecnologia da lente multifocal (mais ou menos campo de visão), do índice de refração (lentes mais finas custam mais), dos tratamentos e da armação. Por isso a Sanrê só passa o preço com a receita em mãos — e o orçamento chega fechado, sem surpresa no caixa.",
    secoes: [
      {
        titulo: "O que entra na conta",
        paragrafos: [
          "Lente: marcas e linhas diferentes (a Sanrê trabalha com Varilux e Zeiss, entre outras) têm desenhos diferentes de campo de visão e adaptação.",
          "Espessura: graus mais altos pedem índices mais altos para a lente não ficar grossa.",
          "Tratamentos: antirreflexo, filtro de luz azul, fotossensível.",
          "Armação: você escolhe à parte, pelo site ou na loja.",
        ],
      },
      {
        titulo: "Adaptação",
        paragrafos: [
          "Os primeiros dias com multifocal pedem adaptação. A Sanrê acompanha: se houver desconforto, a consultora revisa medidas e ajuste.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "Posso mandar a receita pelo site para saber o preço?",
        resposta: "Pode. Em Lentes de grau você envia foto ou PDF da receita e a consultora responde pelo WhatsApp com o orçamento. Nada é cobrado antes da sua aprovação.",
      },
      {
        pergunta: "Qual multifocal é melhor para mim?",
        resposta: "Quem indica é a consultora com base na sua receita e no seu uso (computador, direção, leitura). O site não recomenda lente.",
      },
    ],
    links: [
      { rotulo: "Pedir orçamento com a receita", href: "/lentes-de-grau" },
      { rotulo: "Ver armações de grau", href: "/oculos-de-grau" },
    ],
  },
  {
    slug: "como-saber-se-o-ray-ban-e-original",
    titulo: "Como saber se o Ray-Ban é original",
    descricao:
      "Gravação RB na lente, código do modelo na haste, acabamento e nota fiscal: o que conferir antes de comprar um Ray-Ban, e onde comprar original em Cravinhos e Ribeirão Preto.",
    resposta:
      "Confira quatro coisas: a pequena gravação “RB” na lente esquerda, perto da dobradiça; o código do modelo, da cor e das medidas na parte interna da haste; o acabamento das dobradiças e do logotipo; e, principalmente, a nota fiscal de uma loja autorizada. Preço muito abaixo do mercado é o sinal mais comum de falsificação.",
    secoes: [
      {
        titulo: "Na Sanrê",
        paragrafos: [
          "Todos os óculos vendidos pela Sanrê — nas lojas de Cravinhos e Ribeirão Preto e pelo site — são originais, com nota fiscal e garantia do fabricante.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "Onde comprar Ray-Ban original em Cravinhos?",
        resposta: "Na Sanrê, Rua XV de Novembro, 662A, no centro de Cravinhos, e na loja de Ribeirão Preto, anexa à PB Arts Gallery. Pelo site, com retirada grátis nas duas.",
      },
    ],
    links: [
      { rotulo: "Ver Ray-Ban", href: "/marcas/ray-ban" },
      { rotulo: "Lojas", href: "/unidades" },
    ],
  },
  {
    slug: "oculos-de-seguranca-com-grau",
    titulo: "Óculos de segurança com grau: como funciona",
    descricao:
      "Quem usa óculos de grau e precisa de EPI tem duas saídas: óculos de segurança que recebem lente de grau ou modelos de sobrepor. Veja as diferenças e como a Sanrê atende empresas.",
    resposta:
      "Há dois caminhos: (1) óculos de segurança próprios para receber lente de grau, montados com a receita do colaborador, e (2) óculos de proteção de sobrepor, usados por cima do óculos comum. O primeiro é mais confortável para uso o dia inteiro; o segundo resolve casos pontuais e visitantes. Em ambos, o EPI precisa ter Certificado de Aprovação (CA) válido.",
    secoes: [
      {
        titulo: "Para empresas",
        paragrafos: [
          "A Sanrê atende empresas da região com levantamento das necessidades, receitas dos colaboradores, montagem e entrega. Fale com a gente pela página Empresas.",
        ],
      },
    ],
    faq: [
      {
        pergunta: "O CA vale para o óculos com lente de grau?",
        resposta: "A empresa deve conferir o CA do modelo e as orientações do fabricante sobre montagem com grau. A Sanrê trabalha com modelos próprios para isso.",
      },
    ],
    links: [
      { rotulo: "Atendimento para empresas", href: "/empresas" },
      { rotulo: "Ver EPIs", href: "/epi" },
    ],
  },
];

export function guiaPorSlug(slug: string): Guia | undefined {
  return GUIAS.find(g => g.slug === slug);
}
