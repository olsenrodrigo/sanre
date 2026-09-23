/**
 * Validação de borda da Assistente Sanrê (zod). O mesmo esquema de saída vale
 * para o roteiro e para a resposta do agente externo — nada que o agente
 * devolva chega ao navegador sem passar por aqui.
 *
 * Tipos de referência: client/src/components/assistente/protocolo.ts.
 * Contrato documentado: docs/ASSISTENTE.md.
 */
import { z } from "zod";
import type { SaidaAssistente } from "../../client/src/components/assistente/protocolo";
import { LIMITE_TEXTO } from "../../client/src/components/assistente/protocolo";
import { limparControle } from "./normalizar";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Link que pode virar `href` no navegador: caminho do site ou https. Nunca javascript:/data:. */
export function hrefSeguro(v: string): boolean {
  if (/^\/(?!\/)/.test(v)) return !/[\s\\]/.test(v);
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Imagem de card: caminho do site, https ou data:image (o seed pode usar). */
function imagemSegura(v: string): boolean {
  return hrefSeguro(v) || /^data:image\/(png|jpe?g|webp|svg\+xml|gif)[;,]/i.test(v);
}

const textoLivre = (max: number) =>
  z
    .string()
    .transform(s => limparControle(s).trim())
    .pipe(z.string().min(1).max(max));

// ─── Entrada: POST /api/assistente/mensagens ────────────────────────────────

const produtoContextoSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9][a-z0-9-]*$/i, "slug inválido"),
  titulo: textoLivre(200),
  marca: z.string().trim().max(80).nullish(),
  preco: z.union([z.number().nonnegative().finite(), z.string().trim().max(20)]).nullish(),
  imagem: z.string().trim().max(1000).refine(imagemSegura, "imagem inválida").nullish(),
});

export const contextoSchema = z
  .object({
    pagina: z
      .string()
      .trim()
      .max(300)
      .regex(/^\/[^\s]*$/, "pagina deve ser um caminho do site")
      .optional(),
    produto: produtoContextoSchema.nullish(),
    unidade: z.enum(["cravinhos", "ribeirao-preto"]).nullish(),
  })
  .strip();

export const entradaSchema = z.object({
  sessaoId: z.string().trim().regex(UUID_V4, "sessaoId deve ser UUID v4"),
  texto: textoLivre(LIMITE_TEXTO),
  contexto: contextoSchema.optional(),
});

export type EntradaAssistente = z.infer<typeof entradaSchema>;
export type ContextoValidado = z.infer<typeof contextoSchema>;

// ─── Saída: roteiro e agente ─────────────────────────────────────────────────

const precoSchema = z
  .union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)])
  .transform(v => Number(v))
  .pipe(z.number().nonnegative().finite());

const produtoCardSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9][a-z0-9-]*$/i),
  titulo: z.string().min(1).max(200),
  marca: z.string().max(80).nullable().optional().transform(v => v ?? null),
  preco: precoSchema.nullable().optional().transform(v => v ?? null),
  imagem: z
    .string()
    .max(200_000)
    .refine(imagemSegura)
    .nullable()
    .optional()
    .transform(v => v ?? null),
});

const acaoSchema = z
  .object({
    rotulo: z.string().trim().min(1).max(60),
    href: z.string().trim().max(2000).refine(hrefSeguro, "href precisa ser caminho do site ou https").optional(),
    enviar: z.string().trim().min(1).max(LIMITE_TEXTO).optional(),
  })
  .refine(a => Boolean(a.href) !== Boolean(a.enviar), "ação precisa de href OU enviar");

export const respostaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("texto"), texto: z.string().trim().min(1).max(4000) }),
  z.object({ tipo: z.literal("produtos"), itens: z.array(produtoCardSchema).min(1).max(8) }),
  z.object({ tipo: z.literal("acoes"), acoes: z.array(acaoSchema).min(1).max(6) }),
]);

const whatsappUrlSchema = z
  .string()
  .max(4000)
  .refine(v => /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(v), "whatsappUrl precisa ser wa.me");

export const transbordoSchema = z.object({
  whatsappUrl: whatsappUrlSchema,
  motivo: z.string().trim().min(1).max(120),
});

/** Resposta do agente externo. `modo` é ignorado: quem responde pelo agente é "agente". */
export const respostaAgenteSchema = z.object({
  modo: z.string().optional(),
  respostas: z.array(respostaSchema).min(1).max(12),
  transbordo: transbordoSchema.optional(),
});

export const saidaSchema = z.object({
  modo: z.enum(["agente", "roteiro"]),
  respostas: z.array(respostaSchema).min(1).max(12),
  transbordo: transbordoSchema.optional(),
});

// O esquema e o tipo público precisam andar juntos.
type Saida = z.infer<typeof saidaSchema>;
const _mesmoFormato: (s: Saida) => SaidaAssistente = s => s;
void _mesmoFormato;
