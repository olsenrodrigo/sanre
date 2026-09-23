// Leads do site: orçamento de lentes de grau, reserva para experimentar e
// pedido de empresas (EPI).
//
// Decreto 24.492/1934, art. 13: o site NÃO indica lente. O que chega aqui são
// preferências declaradas pela cliente; a consultora confere a receita e define
// a solução técnica. Nada é cobrado antes dessa conferência.
//
// LGPD: receita é dado de saúde (art. 11) — ver receitas.ts. Nenhuma linha de
// log deste módulo leva nome, telefone, e-mail, empresa, protocolo de receita
// ou conteúdo de arquivo; o log HTTP de server/index.ts já não loga corpo de
// rota fora do catálogo.

import type { Express, Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { linkWhatsapp } from "@shared/unidades";
import { requireAdmin } from "../auth";
import { enviarLeadAoCrm } from "./crm";
import { limiteLeads, limiteTentativas } from "./limites";
import { nomeDoProduto, whatsappDoLead } from "./mensagem";
import {
  EXTENSOES_RECEITA,
  MAX_BYTES_RECEITA,
  MIMES_RECEITA,
  agendarExpurgoReceitas,
  apagarArquivoReceita,
  caminhoAbsoluto,
  detectarTipo,
  diretorioReceitas,
  extensaoConfere,
  extensaoDoMime,
  gravarReceita,
  purgarReceitasVencidas,
  type ReceitaGravada,
} from "./receitas";
import { gerarProtocolo, STATUS_LEAD, TIPOS_LEAD } from "./regras";
import {
  ProtocoloDuplicadoError,
  atualizarStatusLead,
  buscarProdutoPublico,
  inserirLead,
  listarLeads,
  obterLead,
  obterReceitaDoLead,
  type ProdutoResumo,
} from "./repositorio";
import { camposDoErro, leadSchema } from "./validacao";

export { purgarReceitasVencidas } from "./receitas";

class FormatoInvalidoError extends Error {}

const uploadReceita = multer({
  // Memória: o arquivo cru só toca o disco depois de validado (assinatura,
  // consentimento, dados do lead). Com 8 MB e 5 leads por IP a cada 10 min,
  // o pico de memória é limitado.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_RECEITA, files: 1, fields: 4, fieldSize: 32 * 1024, parts: 6 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk =
      MIMES_RECEITA.includes(file.mimetype) ||
      // HEIC do iPhone chega sem MIME conhecido em vários navegadores; a
      // assinatura do arquivo decide depois.
      ([".heic", ".heif"].includes(ext) && ["", "application/octet-stream"].includes(file.mimetype));
    if (!EXTENSOES_RECEITA.includes(ext) || !mimeOk) return cb(new FormatoInvalidoError());
    cb(null, true);
  },
}).single("receita");

const MSG_FORMATO = "Envie a receita em JPG, PNG, WEBP, HEIC ou PDF.";
const MSG_TAMANHO = "A receita pode ter até 8 MB. Tire outra foto ou envie pelo WhatsApp.";

function ipDe(req: Request): string {
  return req.ip || req.socket.remoteAddress || "desconhecido";
}

function erroValidacao(res: Response, campos: Record<string, string>, status = 400) {
  const primeiro = Object.values(campos)[0] ?? "Confira os dados enviados.";
  return res.status(status).json({ error: primeiro, campos });
}

/** Aceita multipart (campo `dados` com JSON) e, sem arquivo, JSON puro. */
function lerDados(req: Request): { ok: true; valor: unknown } | { ok: false } {
  const bruto = (req.body as Record<string, unknown> | undefined)?.dados;
  if (typeof bruto === "string") {
    try {
      return { ok: true, valor: JSON.parse(bruto) };
    } catch {
      return { ok: false };
    }
  }
  if (bruto && typeof bruto === "object") return { ok: true, valor: bruto };
  if (req.is("application/json") && req.body && typeof req.body === "object") return { ok: true, valor: req.body };
  return { ok: false };
}

function honeypotPreenchido(req: Request, dados: unknown): boolean {
  const doCorpo = (req.body as Record<string, unknown> | undefined)?.website;
  const dosDados = dados && typeof dados === "object" ? (dados as Record<string, unknown>).website : undefined;
  return [doCorpo, dosDados].some(v => typeof v === "string" && v.trim() !== "");
}

async function criarComProtocoloUnico(montar: (protocolo: string) => Parameters<typeof inserirLead>[0], receita?: ReceitaGravada) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const protocolo = gerarProtocolo();
    try {
      return await inserirLead(
        montar(protocolo),
        receita && {
          token: receita.token,
          filePath: receita.relativo,
          mimeType: receita.mimeType,
          sizeBytes: receita.sizeBytes,
          expiresAt: receita.expiresAt,
        },
      );
    } catch (e) {
      if (e instanceof ProtocoloDuplicadoError) continue;
      throw e;
    }
  }
  throw new Error("não foi possível gerar protocolo único");
}

/**
 * Segmentos de URL que nunca podem ser servidos: "privado" e o primeiro
 * segmento do diretório de receitas, se ele estiver dentro do projeto.
 */
function segmentosProibidos(): string[] {
  const rel = path.relative(process.cwd(), diretorioReceitas());
  const primeiro = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep)[0] : null;
  return Array.from(new Set(["privado", ...(primeiro ? [primeiro.toLowerCase()] : [])]));
}

/** Decodifica até 3 vezes (%252e → %2e → .) antes de procurar o segmento. */
function tocaAreaPrivada(url: string, proibidos: string[]): boolean {
  let caminho = url.split("?")[0];
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(caminho);
      if (d === caminho) break;
      caminho = d;
    } catch {
      break;
    }
  }
  const segmentos = caminho.toLowerCase().split(/[\\/]+/);
  return segmentos.some(s => proibidos.includes(s));
}

export function registerLeadsRoutes(app: Express): void {
  // ─── Guarda da área privada ─────────────────────────────────────────────────
  // Em desenvolvimento o Vite serve qualquer arquivo do projeto por /@fs/<caminho
  // absoluto> — inclusive privado/receitas/. Esta guarda é registrada antes do
  // Vite (e do static de produção) e responde 404 para qualquer URL que passe
  // pela área privada, codificada ou não.
  const proibidos = segmentosProibidos();
  app.use((req, res, next) => {
    if (tocaAreaPrivada(req.originalUrl, proibidos)) return res.status(404).json({ error: "nao_encontrado" });
    next();
  });

  // ─── Público ────────────────────────────────────────────────────────────────
  app.post("/api/leads", (req: Request, res: Response) => {
    const ip = ipDe(req);
    if (limiteTentativas.excedido(ip)) {
      return res.status(429).json({ error: "Muitas tentativas. Tente de novo em alguns minutos ou fale pelo WhatsApp." });
    }
    limiteTentativas.registrar(ip);

    uploadReceita(req, res, async (err: unknown) => {
      if (err instanceof FormatoInvalidoError) return erroValidacao(res, { receita: MSG_FORMATO });
      if ((err as any)?.code === "LIMIT_FILE_SIZE") return erroValidacao(res, { receita: MSG_TAMANHO }, 413);
      if ((err as any)?.code === "LIMIT_UNEXPECTED_FILE") return erroValidacao(res, { receita: "Envie um único arquivo, no campo da receita." });
      if (err) return erroValidacao(res, { dados: "Envio inválido. Recarregue a página e tente de novo." });

      try {
        const lido = lerDados(req);
        if (!lido.ok) return erroValidacao(res, { dados: "Dados do pedido ausentes ou ilegíveis." });

        // Robô preencheu o campo invisível: responde como sucesso e não grava nada.
        if (honeypotPreenchido(req, lido.valor)) {
          const protocolo = gerarProtocolo();
          return res.status(201).json({ protocolo, whatsappUrl: linkWhatsapp(`Olá! Vim pelo site da Sanrê. Protocolo ${protocolo}.`) });
        }

        const parsed = leadSchema.safeParse(lido.valor);
        if (!parsed.success) return erroValidacao(res, camposDoErro(parsed.error));
        const dados = parsed.data;

        // ── Receita ──
        const arquivo = (req as any).file as Express.Multer.File | undefined;
        let tipoArquivo: ReturnType<typeof detectarTipo> = null;
        if (arquivo) {
          if (dados.tipo !== "orcamento_grau") {
            return erroValidacao(res, { receita: "A receita só é recebida no pedido de orçamento de lentes de grau." });
          }
          if (!dados.consentimentoReceita) {
            return erroValidacao(res, { consentimentoReceita: "Para enviar a receita, marque a autorização de uso da receita." });
          }
          tipoArquivo = detectarTipo(arquivo.buffer);
          if (!tipoArquivo || !extensaoConfere(tipoArquivo, arquivo.originalname)) {
            return erroValidacao(res, { receita: MSG_FORMATO });
          }
        }

        if (limiteLeads.excedido(ip)) {
          return res.status(429).json({ error: "Recebemos vários pedidos seus agora há pouco. Continue pelo WhatsApp ou tente mais tarde." });
        }

        // ── Produto ──
        let produto: ProdutoResumo | null = null;
        if (dados.produtoSlug) {
          produto = (await buscarProdutoPublico(dados.produtoSlug)) ?? null;
          if (!produto && dados.tipo === "reserva") {
            return erroValidacao(res, { produtoSlug: "Esta armação não está mais disponível para reserva." });
          }
        }

        const agora = new Date();
        const detalhes: Record<string, unknown> = { ...dados.detalhes };
        if (dados.tipo === "orcamento_grau") detalhes.receitaDepois = arquivo ? false : (dados.detalhes.receitaDepois ?? false);

        const receita = arquivo && tipoArquivo ? await gravarReceita(arquivo.buffer, tipoArquivo) : undefined;
        let lead;
        try {
          lead = await criarComProtocoloUnico(
            protocolo => ({
              protocol: protocolo,
              kind: dados.tipo,
              unitSlug: dados.unidade ?? null,
              productId: produto?.id ?? null,
              name: dados.nome,
              phone: dados.telefone,
              email: dados.email ?? null,
              company: dados.empresa ?? null,
              consentVersion: dados.consentimento.versao,
              consentedAt: agora,
              payload: {
                detalhes,
                ...(dados.produtoSlug && !produto ? { produtoSlugInformado: dados.produtoSlug } : {}),
                consentimentos: {
                  contato: { versao: dados.consentimento.versao, em: agora.toISOString() },
                  ...(receita && dados.consentimentoReceita
                    ? { receita: { versao: dados.consentimentoReceita.versao, em: agora.toISOString() } }
                    : {}),
                },
              },
            }),
            receita,
          );
        } catch (e) {
          if (receita) await apagarArquivoReceita(receita.relativo);
          throw e;
        }
        limiteLeads.registrar(ip);

        enviarLeadAoCrm({
          protocolo: lead.protocol,
          tipo: lead.kind,
          status: lead.status,
          unidade: lead.unitSlug,
          produto: produto ? { slug: produto.slug, nome: nomeDoProduto(produto), titulo: produto.title } : null,
          nome: lead.name,
          telefone: lead.phone,
          email: lead.email,
          empresa: lead.company,
          detalhes,
          temReceita: Boolean(receita),
          consentimentoVersao: lead.consentVersion,
          origem: lead.source,
          criadoEm: lead.createdAt,
        });

        return res.status(201).json({ protocolo: lead.protocol, whatsappUrl: whatsappDoLead(lead.protocol, dados, produto) });
      } catch (e) {
        console.error("[leads] falha ao registrar lead:", (e as Error)?.message);
        return res.status(500).json({ error: "Não foi possível registrar agora. Tente de novo ou fale pelo WhatsApp." });
      }
    });
  });

  // ─── Painel (admin) ─────────────────────────────────────────────────────────
  const filtroSchema = z.object({
    tipo: z.enum(TIPOS_LEAD).optional().catch(undefined),
    status: z.enum(STATUS_LEAD).optional().catch(undefined),
    page: z.coerce.number().int().min(1).max(10_000).catch(1),
    limit: z.coerce.number().int().min(1).max(100).catch(20),
  });

  app.get("/api/admin/leads", requireAdmin, async (req, res) => {
    const f = filtroSchema.parse(req.query);
    const { linhas, total } = await listarLeads(f);
    return res.json({ leads: linhas, total, page: f.page, limit: f.limit });
  });

  const idSchema = z.coerce.number().int().positive();

  app.get("/api/admin/leads/:id", requireAdmin, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Lead não encontrado" });
    const achado = await obterLead(id.data);
    if (!achado) return res.status(404).json({ error: "Lead não encontrado" });
    const { lead, produto, receita } = achado;
    const payload = (lead.payload ?? {}) as Record<string, any>;
    return res.json({
      id: lead.id,
      protocolo: lead.protocol,
      tipo: lead.kind,
      status: lead.status,
      unidade: lead.unitSlug,
      nome: lead.name,
      telefone: lead.phone,
      email: lead.email,
      empresa: lead.company,
      origem: lead.source,
      detalhes: payload.detalhes ?? {},
      consentimentos: payload.consentimentos ?? null,
      produtoSlugInformado: payload.produtoSlugInformado ?? null,
      criadoEm: lead.createdAt,
      atualizadoEm: lead.updatedAt,
      produto: produto ? { ...produto, nome: nomeDoProduto(produto) } : null,
      receita: receita
        ? {
            situacao: receita.purgedAt ? "expurgada" : receita.expiresAt.getTime() <= Date.now() ? "vencida" : "disponivel",
            mimeType: receita.mimeType,
            tamanho: receita.sizeBytes,
            recebidaEm: receita.createdAt,
            expiraEm: receita.expiresAt,
            expurgadaEm: receita.purgedAt,
          }
        : null,
    });
  });

  const patchSchema = z.object({ status: z.enum(STATUS_LEAD, { errorMap: () => ({ message: "Status inválido" }) }) });

  app.patch("/api/admin/leads/:id", requireAdmin, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Lead não encontrado" });
    const body = patchSchema.safeParse(req.body);
    if (!body.success) return erroValidacao(res, camposDoErro(body.error));
    const lead = await atualizarStatusLead(id.data, body.data.status);
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    return res.json({ id: lead.id, status: lead.status, atualizadoEm: lead.updatedAt });
  });

  app.get("/api/admin/leads/:id/receita", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Receita não encontrada" });
    const achado = await obterLead(id.data);
    const receita = achado ? await obterReceitaDoLead(id.data) : null;
    if (!achado || !receita) return res.status(404).json({ error: "Receita não encontrada" });

    if (receita.purgedAt || receita.expiresAt.getTime() <= Date.now()) {
      // Venceu e o expurgo de hora em hora ainda não passou: adianta.
      if (!receita.purgedAt) void purgarReceitasVencidas().catch(() => {});
      return res.status(410).json({ error: "A receita foi apagada pelo prazo de retenção (90 dias)." });
    }
    const abs = caminhoAbsoluto(receita.filePath);
    if (!abs || !fs.existsSync(abs)) return res.status(410).json({ error: "O arquivo da receita não está mais disponível." });

    // Trilha de acesso a dado de saúde: só ids, nunca nome ou protocolo.
    console.log(`[leads] receita do lead ${achado.lead.id} baixada pelo admin ${(req as any).admin?.id ?? "?"}`);

    res.setHeader("Content-Type", receita.mimeType);
    res.setHeader("Content-Length", String(receita.sizeBytes));
    res.setHeader("Content-Disposition", `attachment; filename="receita-${achado.lead.protocol}.${extensaoDoMime(receita.mimeType)}"`);
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    const stream = fs.createReadStream(abs);
    stream.on("error", () => {
      if (!res.headersSent) res.status(410).json({ error: "O arquivo da receita não está mais disponível." });
      else res.destroy();
    });
    stream.pipe(res);
  });

  agendarExpurgoReceitas();
}
