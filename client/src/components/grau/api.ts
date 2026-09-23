/** Cliente do POST /api/leads (multipart: `dados` em JSON + `receita` opcional). */

export interface RespostaLead {
  protocolo: string;
  whatsappUrl: string;
}

export class ErroLead extends Error {
  constructor(
    message: string,
    readonly campos: Record<string, string> = {},
    readonly status = 0,
  ) {
    super(message);
  }
}

const MSG_GENERICA = "Não foi possível enviar agora. Tente de novo em instantes ou fale com a loja pelo WhatsApp.";

export async function enviarLead(dados: Record<string, unknown>, receita?: File | null): Promise<RespostaLead> {
  const fd = new FormData();
  fd.append("dados", JSON.stringify(dados));
  if (receita) fd.append("receita", receita, receita.name);

  let r: Response;
  try {
    r = await fetch("/api/leads", { method: "POST", body: fd });
  } catch {
    throw new ErroLead("Sem conexão. Confira a internet e tente de novo.");
  }
  const corpo = await r.json().catch(() => null);
  if (r.status === 201 && corpo?.protocolo && corpo?.whatsappUrl) return corpo as RespostaLead;
  if (r.status === 413) {
    throw new ErroLead("A receita pode ter até 8 MB. Tire outra foto ou envie pelo WhatsApp.", { receita: "Arquivo acima de 8 MB." }, 413);
  }
  throw new ErroLead(corpo?.error || MSG_GENERICA, corpo?.campos ?? {}, r.status);
}
