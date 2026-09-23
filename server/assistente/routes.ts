/**
 * Rotas da Assistente Sanrê (widget de chat do site).
 *
 *   GET  /api/assistente/config     → { ativo, modo, whatsapp }
 *   POST /api/assistente/mensagens  → { modo, respostas[], transbordo? }
 *
 * Com agente configurado (ASSISTENTE_URL + ASSISTENTE_TOKEN), a mensagem vai
 * para ele; sem agente, ou se ele falhar, responde o roteiro. Contrato em
 * docs/ASSISTENTE.md.
 *
 * LGPD: nada aqui loga o texto da cliente nem o sessaoId — só intenção,
 * modo, tipo de falha e latência.
 */
import type { Express, Request, Response } from "express";
import { WHATSAPP_SANRE, linkWhatsapp } from "@shared/unidades";
import {
  pareceDadoSensivel,
  type ConfigAssistente,
  type SaidaAssistente,
} from "@shared/assistente-protocolo";
import { configAgente, consultarAgente } from "./agente";
import { entradaSchema, saidaSchema } from "./contrato";
import { consumirLimite } from "./limites";
import { responderPeloRoteiro } from "./roteiro";

function ativo(): boolean {
  const v = (process.env.ASSISTENTE_ATIVO || "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "nao" || v === "não");
}

/** Host público ("oticasanre.com.br") para o link do produto na mensagem do WhatsApp. */
function hostPublico(req: Request): string | null {
  const configurada = (process.env.PUBLIC_URL || "").trim();
  if (configurada) {
    try {
      return new URL(configurada).host;
    } catch {
      /* cai no Host da requisição */
    }
  }
  const host = req.get("host") || "";
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : null;
}

function ipDe(req: Request): string {
  return req.ip || req.socket.remoteAddress || "desconhecido";
}

function log(msg: string): void {
  console.log(`[assistente] ${msg}`);
}

export function registerAssistenteRoutes(app: Express): void {
  app.get("/api/assistente/config", (_req: Request, res: Response) => {
    const corpo: ConfigAssistente = {
      ativo: ativo(),
      modo: configAgente() ? "agente" : "roteiro",
      whatsapp: WHATSAPP_SANRE,
    };
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(corpo);
  });

  app.post("/api/assistente/mensagens", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    if (!ativo()) {
      return res.status(503).json({ erro: "desativado", mensagem: "A assistente está desligada no momento." });
    }

    const entrada = entradaSchema.safeParse(req.body);
    if (!entrada.success) {
      // Só o caminho dos campos — a mensagem do zod pode ecoar o valor enviado.
      const campos = Array.from(new Set(entrada.error.issues.map(i => i.path.join(".") || "corpo")));
      return res.status(400).json({
        erro: "entrada_invalida",
        mensagem: "Não consegui ler a mensagem. Confira o texto (até 800 caracteres) e tente de novo.",
        campos,
      });
    }
    const { sessaoId, texto, contexto } = entrada.data;

    const espera = consumirLimite(ipDe(req), sessaoId);
    if (espera) {
      res.setHeader("Retry-After", String(espera));
      return res.status(429).json({
        erro: "limite",
        mensagem: `Muitas mensagens em pouco tempo. Aguarde ${espera} segundos e tente de novo, ou fale com a consultora pelo WhatsApp.`,
        tentarEmSegundos: espera,
        whatsappUrl: linkWhatsapp("Olá! Vim pelo site da Sanrê e quero tirar uma dúvida."),
      });
    }

    const inicio = Date.now();
    let saida: SaidaAssistente | null = null;

    // Receita, CPF ou cartão digitados no chat não saem do servidor: o roteiro
    // responde com a orientação de privacidade (o widget já bloqueia antes).
    const sensivel = pareceDadoSensivel(texto);
    if (sensivel && configAgente()) log("agente pulado: dado sensível na mensagem");
    if (configAgente() && !sensivel) {
      const r = await consultarAgente({ sessaoId, texto, contexto });
      if (r.ok) {
        saida = r.saida;
        log(`agente ok ${r.ms}ms`);
      } else {
        log(`agente falhou (${r.erro}${r.status ? ` ${r.status}` : ""}) em ${r.ms}ms — respondendo pelo roteiro`);
      }
    }

    if (!saida) {
      const r = await responderPeloRoteiro({ sessaoId, texto, contexto, host: hostPublico(req) });
      saida = r.saida;
      log(`roteiro intencao=${r.intencao} ${Date.now() - inicio}ms`);
    }

    // O roteiro também passa pelo contrato: se algum texto sair do formato, é bug aqui, não na cliente.
    const conferido = saidaSchema.safeParse(saida);
    if (!conferido.success) {
      console.error("[assistente] resposta fora do contrato:", conferido.error.issues.map(i => i.path.join(".")).join(", "));
      return res.status(500).json({
        erro: "interno",
        mensagem: "Não consegui responder agora. Tente de novo ou fale com a consultora pelo WhatsApp.",
      });
    }
    return res.json(conferido.data);
  });
}
