/**
 * Fichas das marcas (páginas /marcas/:slug).
 *
 * Só fatos de conhecimento público e estáveis: origem, ano de fundação, pelo
 * que a marca é conhecida em óculos. Nada de licenciamento (muda com contrato)
 * e nada de "a melhor". A página só existe se a marca tiver produto publicado.
 */
export interface FichaMarca {
  nome: string;
  origem: string;
  resumo: string;
  destaque?: string;
}

export const MARCAS: Record<string, FichaMarca> = {
  "ray-ban": {
    nome: "Ray-Ban",
    origem: "Estados Unidos, 1937",
    resumo:
      "Nasceu fazendo óculos para pilotos e criou dois dos desenhos mais copiados da história: o Aviator e o Wayfarer. Hoje tem de clássicos em metal a armações de grau em acetato.",
    destaque: "Aviator, Wayfarer, Clubmaster e Round",
  },
  oakley: {
    nome: "Oakley",
    origem: "Califórnia, Estados Unidos, 1975",
    resumo:
      "Referência em óculos esportivos: armações leves e envolventes e lentes que realçam contraste. Tem também modelos de uso diário e armações de grau.",
    destaque: "Holbrook, Frogskins, Sutro e lentes Prizm",
  },
  prada: {
    nome: "Prada",
    origem: "Milão, Itália, 1913",
    resumo:
      "Óculos de linhas arquitetônicas, acetatos encorpados e o logotipo triangular. A Prada Linea Rossa é a linha esportiva da marca.",
  },
  "prada-linea-rossa": {
    nome: "Prada Linea Rossa",
    origem: "Milão, Itália",
    resumo: "A linha esportiva da Prada: materiais leves, desenho técnico e o detalhe vermelho que dá nome à coleção.",
  },
  gucci: {
    nome: "Gucci",
    origem: "Florença, Itália, 1921",
    resumo: "Grifes de moda com armações marcantes: acetatos coloridos, metais trabalhados e o monograma GG.",
  },
  valentino: {
    nome: "Valentino",
    origem: "Roma, Itália, 1960",
    resumo: "Alta-costura italiana levada aos óculos: detalhes em rebite, formatos femininos e acabamento de joalheria.",
  },
  "tom-ford": {
    nome: "Tom Ford",
    origem: "Estados Unidos, 2005",
    resumo: "Acetatos grossos, formatos clássicos e o “T” metálico nas hastes. Óculos de sol e de grau com acabamento de luxo.",
  },
  carrera: {
    nome: "Carrera",
    origem: "Áustria, 1956",
    resumo: "Nasceu nos esportes de velocidade e ficou famosa pelos aviadores e máscaras de linhas ousadas.",
  },
  "michael-kors": {
    nome: "Michael Kors",
    origem: "Nova York, Estados Unidos, 1981",
    resumo: "Luxo acessível: metais dourados, formatos amplos e acabamentos elegantes para o dia a dia.",
  },
  ferragamo: {
    nome: "Ferragamo",
    origem: "Florença, Itália, 1927",
    resumo: "Da tradição do couro e dos sapatos italianos, óculos com o detalhe Gancini e acabamento refinado.",
  },
  lacoste: {
    nome: "Lacoste",
    origem: "França, 1933",
    resumo: "O jacaré do tênis em armações esportivas e casuais, leves e resistentes.",
  },
  "calvin-klein": {
    nome: "Calvin Klein",
    origem: "Nova York, Estados Unidos, 1968",
    resumo: "Minimalismo americano: linhas limpas, cores neutras e armações fáceis de usar.",
  },
  guess: {
    nome: "Guess",
    origem: "Los Angeles, Estados Unidos, 1981",
    resumo: "Óculos com atitude e detalhes de logotipo, com bom custo para quem gosta de marca.",
  },
  "ana-hickmann": {
    nome: "Ana Hickmann",
    origem: "Brasil",
    resumo: "Marca brasileira de óculos assinada pela apresentadora: formatos femininos, metais e acetatos com brilho.",
  },
  hb: {
    nome: "HB",
    origem: "Brasil",
    resumo: "Marca nacional com óculos esportivos e casuais, armações resistentes e preço acessível.",
  },
  "just-cavalli": {
    nome: "Just Cavalli",
    origem: "Itália",
    resumo: "A linha jovem de Roberto Cavalli: estampas, cores e formatos ousados.",
  },
  "vogue-eyewear": {
    nome: "Vogue Eyewear",
    origem: "Itália, 1973",
    resumo: "Armações de moda com ótimo custo, em muitas cores e formatos femininos.",
  },
  persol: {
    nome: "Persol",
    origem: "Turim, Itália, 1917",
    resumo: "A flecha nas hastes e as dobradiças Meflecto: óculos italianos clássicos, feitos à mão.",
  },
  "emporio-armani": {
    nome: "Emporio Armani",
    origem: "Milão, Itália, 1981",
    resumo: "O desenho contemporâneo de Giorgio Armani em armações leves e sóbrias.",
  },
  nanovista: {
    nome: "Nanovista",
    origem: "Espanha",
    resumo: "Armações infantis flexíveis, feitas para resistir à rotina da criança.",
  },
  speedo: {
    nome: "Speedo",
    origem: "Austrália, 1914",
    resumo: "Da natação para os óculos: armações esportivas e infantis resistentes.",
  },
  "3m": {
    nome: "3M",
    origem: "Estados Unidos",
    resumo: "Óculos de proteção com Certificado de Aprovação (CA) para indústria, construção e laboratório.",
  },
  msa: {
    nome: "MSA",
    origem: "Estados Unidos",
    resumo: "Equipamentos de proteção individual, incluindo óculos de segurança com CA.",
  },
  steelflex: {
    nome: "Steelflex",
    origem: "Brasil",
    resumo: "Fabricante brasileira de EPI com linha completa de óculos de segurança com CA.",
  },
  kalipso: {
    nome: "Kalipso",
    origem: "Brasil",
    resumo: "Óculos de proteção brasileiros com CA, com modelos de sobrepor para quem usa grau.",
  },
  "delta-plus": {
    nome: "Delta Plus",
    origem: "França",
    resumo: "Equipamentos de proteção individual com óculos de segurança certificados.",
  },
};

export function fichaMarca(slug: string, nome?: string): FichaMarca {
  return (
    MARCAS[slug] ?? {
      nome: nome ?? slug,
      origem: "",
      resumo: `Óculos ${nome ?? slug} originais, com nota fiscal e garantia do fabricante.`,
    }
  );
}
