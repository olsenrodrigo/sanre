/**
 * Unidades da Óticas Sanrê — fonte única para o site (páginas de unidade,
 * rodapé, checkout com retirada), para o JSON-LD `Optician` renderizado no
 * servidor e para a assistente.
 *
 * Origem dos dados (conferidos em 22/09/2026):
 *  - Cravinhos: Receita Federal (CNPJ 07.151.777/0001-04, matriz, ativa desde
 *    17/12/2004) e site atual oticasanre.com.br/contato.
 *  - Ribeirão Preto: proposta técnica da Sintetiza (14/09/2026) — "Rua Altino
 *    Arantes, 811, anexo à PB Arts Gallery" — e Instagram @oticasanre
 *    (inauguração em 23/07/2026). O CEP é o da PB Arts (Altino Arantes, 795).
 *
 * Horários: NENHUM foi confirmado pela loja. Enquanto `horarioConfirmado` for
 * false o site não publica horário (nem no JSON-LD) e manda consultar pelo
 * WhatsApp — horário errado no Google é pior do que horário nenhum.
 */

export type UnidadeSlug = "cravinhos" | "ribeirao-preto";

export interface Unidade {
  slug: UnidadeSlug;
  nome: string;
  cidade: string;
  uf: "SP";
  desde: string;
  logradouro: string;
  bairro: string;
  cep: string;
  complemento?: string;
  /** Texto curto para chip e seletor. */
  rotulo: string;
  /** Link "como chegar". */
  mapsUrl: string;
  whatsapp: string;
  telefone?: string;
  horarioConfirmado: boolean;
  /** Só é exibido quando `horarioConfirmado` for true. [dia, abre, fecha] */
  horario: { dias: string; abre: string; fecha: string }[];
  resumo: string;
  destaque: string;
  foto: string;
}

export const WHATSAPP_SANRE = "5516991951430";

export const UNIDADES: Unidade[] = [
  {
    slug: "cravinhos",
    nome: "Sanrê Cravinhos",
    cidade: "Cravinhos",
    uf: "SP",
    desde: "2004",
    logradouro: "Rua XV de Novembro, 662A",
    bairro: "Centro",
    cep: "14140-000",
    rotulo: "Cravinhos",
    mapsUrl: "https://maps.app.goo.gl/qHR5ECznyEC47Fx9A",
    whatsapp: WHATSAPP_SANRE,
    horarioConfirmado: false,
    // TODO(loja): confirmar. Guias locais publicam seg–sex 9h–18h e sáb 9h–13h.
    horario: [
      { dias: "Segunda a sexta", abre: "09:00", fecha: "18:00" },
      { dias: "Sábado", abre: "09:00", fecha: "13:00" },
    ],
    resumo:
      "A loja onde tudo começou, no centro de Cravinhos, desde 17 de dezembro de 2004. Ajuste de armação e consultoria de lentes com quem conhece a clientela há duas décadas.",
    destaque: "Desde 2004",
    foto: "/uploads/produtos/sr-loja-cravinhos.webp",
  },
  {
    slug: "ribeirao-preto",
    nome: "Sanrê Ribeirão Preto",
    cidade: "Ribeirão Preto",
    uf: "SP",
    desde: "2026",
    logradouro: "Rua Altino Arantes, 811",
    bairro: "Jardim Sumaré",
    cep: "14020-200",
    complemento: "Anexo à PB Arts Gallery",
    rotulo: "Ribeirão Preto",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Rua+Altino+Arantes+811+Ribeir%C3%A3o+Preto+SP",
    whatsapp: WHATSAPP_SANRE,
    horarioConfirmado: false,
    horario: [],
    resumo:
      "A segunda loja, aberta em 23 de julho de 2026 dentro da PB Arts Gallery: vitrines de acrílico, curadoria de grifes e atendimento com hora marcada.",
    destaque: "Na PB Arts Gallery",
    foto: "/uploads/produtos/sr-loja-ribeirao.webp",
  },
];

export function unidadePorSlug(slug: string | null | undefined): Unidade | undefined {
  return UNIDADES.find(u => u.slug === slug);
}

export function enderecoCompleto(u: Unidade): string {
  return `${u.logradouro} — ${u.bairro}, ${u.cidade}/${u.uf}, CEP ${u.cep}`;
}

/** Link do WhatsApp com mensagem pronta (a mensagem carrega o contexto para a assistente). */
export function linkWhatsapp(mensagem: string, numero: string = WHATSAPP_SANRE): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
