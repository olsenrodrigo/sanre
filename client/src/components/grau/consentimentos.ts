/**
 * Textos de consentimento (LGPD) dos formulários de lead.
 *
 * Cada texto tem uma VERSÃO, e é a versão que o servidor grava no lead como
 * prova do que a cliente leu. Mudou uma vírgula do texto → versão nova aqui E
 * em server/leads/regras.ts (VERSOES_CONSENTIMENTO_*), senão o servidor recusa.
 */

/** Finalidade: retorno do atendimento. Vale para orçamento, reserva e empresas. */
export const CONSENTIMENTO_CONTATO = {
  versao: "contato-v1-2026-09",
  texto:
    "Autorizo a Óticas Sanrê a usar meu nome, WhatsApp e e-mail para responder a este pedido. Esses dados não entram em lista de promoções.",
} as const;

/** Receita é dado de saúde (LGPD art. 11): consentimento próprio, só quando há arquivo. */
export const CONSENTIMENTO_RECEITA = {
  versao: "receita-v1-2026-09",
  texto:
    "Autorizo a Óticas Sanrê a receber e guardar a minha receita, que é um dado de saúde, só para conferir as medidas e preparar este orçamento. Apenas a equipe da loja tem acesso, e o arquivo é apagado automaticamente em até 90 dias.",
} as const;
