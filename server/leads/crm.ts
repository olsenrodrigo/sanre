// Webhook opcional para o CRM (CRM_WEBHOOK_URL + CRM_WEBHOOK_TOKEN).
//
//  - Assíncrono: a cliente recebe o protocolo sem esperar o CRM.
//  - A receita NUNCA vai no webhook — só `temReceita: true`. O arquivo fica na
//    loja; o CRM busca pelo painel, autenticado.
//  - Assinatura: X-Sanre-Assinatura: sha256=<hex HMAC-SHA256 do corpo cru>.
//    Sem token configurado não envia: webhook sem assinatura ensinaria o CRM a
//    aceitar qualquer POST.
//  - Idempotência para o receptor: X-Sanre-Entrega = protocolo (único por lead).
//  - Log só do status HTTP — nunca corpo, URL com credencial ou dado do lead.

import { createHmac } from "node:crypto";

let avisouSemToken = false;

export function assinar(corpo: string, token: string): string {
  return `sha256=${createHmac("sha256", token).update(corpo).digest("hex")}`;
}

export function enviarLeadAoCrm(evento: Record<string, unknown> & { protocolo: string }): void {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return;
  const token = process.env.CRM_WEBHOOK_TOKEN;
  if (!token) {
    if (!avisouSemToken) {
      console.warn("[leads] CRM_WEBHOOK_URL definido sem CRM_WEBHOOK_TOKEN — webhook não enviado.");
      avisouSemToken = true;
    }
    return;
  }

  const corpo = JSON.stringify({ evento: "lead.criado", enviadoEm: new Date().toISOString(), lead: evento });
  setImmediate(async () => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sanre-Evento": "lead.criado",
          "X-Sanre-Entrega": evento.protocolo,
          "X-Sanre-Assinatura": assinar(corpo, token),
        },
        body: corpo,
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) console.warn(`[leads] webhook CRM respondeu ${r.status}`);
    } catch (e: any) {
      console.warn(`[leads] webhook CRM falhou: ${e?.name === "TimeoutError" ? "timeout" : "erro de rede"}`);
    }
  });
}
