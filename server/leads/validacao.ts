// Validação de borda do POST /api/leads (zod).
//
// Toda mensagem é escrita aqui, em português, e nenhuma ecoa o valor recebido:
// a resposta 400 não pode devolver telefone ou e-mail digitado (INV-B).

import { z } from "zod";
import {
  VERSOES_CONSENTIMENTO_CONTATO,
  VERSOES_CONSENTIMENTO_RECEITA,
  normalizarCnpj,
  normalizarTelefone,
} from "./regras";

const msg = (message: string) => ({ errorMap: () => ({ message }) });

const textoOpcional = (max: number, rotulo: string) =>
  z
    .string(msg(`${rotulo} inválido`))
    .trim()
    .max(max, `${rotulo}: até ${max} caracteres`)
    .optional()
    .transform(v => (v ? v : undefined));

const observacoes = textoOpcional(1000, "Observações");

const consentimento = (versoes: readonly [string, ...string[]], rotulo: string) =>
  z.object(
    {
      aceito: z.literal(true, msg(`Marque a autorização de ${rotulo} para continuar`)),
      versao: z.enum(versoes as [string, ...string[]], msg(`Versão do termo de ${rotulo} desconhecida — recarregue a página`)),
    },
    msg(`Marque a autorização de ${rotulo} para continuar`),
  );

export const TRATAMENTOS = ["antirreflexo", "filtro_luz_azul", "fotossensivel", "polarizado", "nenhum"] as const;
export const USOS = ["longe", "perto", "longe_e_perto", "computador", "nao_sei"] as const;
export const QUANDO_RESERVA = ["hoje", "amanha", "esta_semana", "combinar"] as const;
export const PERIODOS = ["manha", "tarde", "noite"] as const;
export const SEGMENTOS = ["industria", "usinas_agronegocio", "construcao", "laboratorio", "outro"] as const;

const detalhesGrau = z.object(
  {
    usoPrincipal: z.enum(USOS, msg("Escolha como você vai usar os óculos")),
    tratamentosDesejados: z
      .array(z.enum(TRATAMENTOS, msg("Tratamento desconhecido")), msg("Tratamentos inválidos"))
      .max(TRATAMENTOS.length, "Tratamentos inválidos")
      .default([])
      .transform(lista => Array.from(new Set(lista)))
      .refine(lista => !(lista.includes("nenhum") && lista.length > 1), "Escolha “nenhum” ou os tratamentos, não os dois"),
    jaUsaMultifocal: z.boolean(msg("Resposta inválida")).optional(),
    receitaDepois: z.boolean(msg("Resposta inválida")).optional(),
    observacoes,
  },
  msg("Detalhes do orçamento ausentes"),
);

const detalhesReserva = z.object(
  {
    quando: z.enum(QUANDO_RESERVA, msg("Escolha quando quer ir à loja")),
    periodo: z.enum(PERIODOS, msg("Período inválido")).optional(),
    observacoes,
  },
  msg("Detalhes da reserva ausentes"),
);

const detalhesEmpresa = z.object(
  {
    cnpj: z
      .string(msg("CNPJ inválido"))
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        const n = normalizarCnpj(v);
        if (!n) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNPJ inválido — confira os números" });
          return z.NEVER;
        }
        return n;
      }),
    quantidade: z.coerce
      .number(msg("Informe a quantidade"))
      .int("Informe um número inteiro")
      .min(1, "Informe ao menos 1 unidade")
      .max(100000, "Quantidade acima do limite — fale com a loja pelo WhatsApp"),
    precisaGrau: z.boolean(msg("Diga se alguém precisa de lente de grau")),
    segmento: z.enum(SEGMENTOS, msg("Segmento inválido")).optional(),
    observacoes,
  },
  msg("Detalhes do pedido ausentes"),
);

const base = {
  nome: z.string(msg("Informe seu nome")).trim().min(2, "Informe seu nome").max(120, "Nome: até 120 caracteres"),
  telefone: z
    .string(msg("Informe seu WhatsApp com DDD"))
    .transform((v, ctx) => {
      const n = normalizarTelefone(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WhatsApp inválido — use DDD + número" });
        return z.NEVER;
      }
      return n;
    }),
  email: z
    .string(msg("E-mail inválido"))
    .trim()
    .toLowerCase()
    .max(160, "E-mail: até 160 caracteres")
    .optional()
    .transform(v => (v ? v : undefined))
    .pipe(z.string().email("E-mail inválido").optional()),
  unidade: z.enum(["cravinhos", "ribeirao-preto"], msg("Escolha uma unidade")).optional(),
  produtoSlug: z
    .string(msg("Produto inválido"))
    .trim()
    .max(200, "Produto inválido")
    .regex(/^[a-z0-9-]*$/, "Produto inválido")
    .optional()
    .transform(v => (v ? v : undefined)),
  empresa: textoOpcional(160, "Empresa"),
  consentimento: consentimento(VERSOES_CONSENTIMENTO_CONTATO, "contato"),
  consentimentoReceita: consentimento(VERSOES_CONSENTIMENTO_RECEITA, "uso da receita").optional(),
};

export const leadSchema = z.discriminatedUnion(
  "tipo",
  [
    z.object({ tipo: z.literal("orcamento_grau"), ...base, detalhes: detalhesGrau }),
    z.object({
      tipo: z.literal("reserva"),
      ...base,
      produtoSlug: base.produtoSlug.pipe(z.string(msg("Escolha a armação que quer reservar"))),
      unidade: z.enum(["cravinhos", "ribeirao-preto"], msg("Escolha a unidade onde quer experimentar")),
      detalhes: detalhesReserva,
    }),
    z.object({
      tipo: z.literal("empresa"),
      ...base,
      empresa: z.string(msg("Informe o nome da empresa")).trim().min(2, "Informe o nome da empresa").max(160, "Empresa: até 160 caracteres"),
      detalhes: detalhesEmpresa,
    }),
  ],
  msg("Tipo de pedido inválido"),
);

export type LeadEntrada = z.infer<typeof leadSchema>;

/** Issues do zod → `{ "detalhes.usoPrincipal": "mensagem" }` (primeira por campo). */
export function camposDoErro(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const chave = issue.path.length ? issue.path.join(".") : "dados";
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}
