// Acesso a dados dos leads e das receitas.
//
// Usa o mesmo `db` (Drizzle + pool) de server/storage.ts. As queries ficam aqui,
// no módulo de leads, para que o dono de storage.ts não precise conhecer a
// tabela de receitas — e para que o acesso à receita tenha um único lugar.

import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { leads, prescriptionFiles, products, type Lead, type PrescriptionFile } from "@shared/schema";
import { db } from "../storage";
import type { StatusLead, TipoLead } from "./regras";

export interface ProdutoResumo {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  modelCode: string | null;
}

const colunasProduto = {
  id: products.id,
  slug: products.slug,
  title: products.title,
  brand: products.brand,
  modelCode: products.modelCode,
};

/** Só peça ativa e publicada — a mesma regra da vitrine. */
export async function buscarProdutoPublico(slug: string): Promise<ProdutoResumo | undefined> {
  const [p] = await db
    .select(colunasProduto)
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "active"), eq(products.published, true)));
  return p;
}

export interface NovoLead {
  protocol: string;
  kind: TipoLead;
  unitSlug: string | null;
  productId: number | null;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  payload: Record<string, unknown>;
  consentVersion: string;
  consentedAt: Date;
}

export interface NovaReceita {
  token: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Date;
}

export class ProtocoloDuplicadoError extends Error {}

/** Lead e receita na mesma transação: não existe receita sem lead nem lead "com receita" sem arquivo. */
export async function inserirLead(novo: NovoLead, receita?: NovaReceita): Promise<Lead> {
  try {
    return await db.transaction(async tx => {
      const [lead] = await tx.insert(leads).values(novo).returning();
      if (receita) await tx.insert(prescriptionFiles).values({ ...receita, leadId: lead.id });
      return lead;
    });
  } catch (e: any) {
    if (e?.code === "23505" && String(e?.constraint ?? "").includes("protocol")) throw new ProtocoloDuplicadoError();
    throw e;
  }
}

// ─── Painel ───────────────────────────────────────────────────────────────────
export interface FiltroLeads {
  tipo?: TipoLead;
  status?: StatusLead;
  page: number;
  limit: number;
}

export async function listarLeads(f: FiltroLeads) {
  const cond = and(
    f.tipo ? eq(leads.kind, f.tipo) : undefined,
    f.status ? eq(leads.status, f.status) : undefined,
  );
  const temReceita = sql<boolean>`exists (select 1 from ${prescriptionFiles} pf where pf.lead_id = ${leads.id})`;
  const [linhas, [{ total }]] = await Promise.all([
    db
      .select({
        id: leads.id,
        protocolo: leads.protocol,
        tipo: leads.kind,
        status: leads.status,
        unidade: leads.unitSlug,
        nome: leads.name,
        telefone: leads.phone,
        empresa: leads.company,
        criadoEm: leads.createdAt,
        produtoTitulo: products.title,
        produtoMarca: products.brand,
        temReceita,
      })
      .from(leads)
      .leftJoin(products, eq(products.id, leads.productId))
      .where(cond)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit),
    db.select({ total: sql<number>`count(*)::int` }).from(leads).where(cond),
  ]);
  return { linhas, total };
}

export async function obterLead(
  id: number,
): Promise<{ lead: Lead; produto: ProdutoResumo | null; receita: PrescriptionFile | null } | undefined> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return undefined;
  const [produto] = lead.productId
    ? await db.select(colunasProduto).from(products).where(eq(products.id, lead.productId))
    : [];
  const receita = await obterReceitaDoLead(id);
  return { lead, produto: produto ?? null, receita };
}

export async function atualizarStatusLead(id: number, status: StatusLead): Promise<Lead | undefined> {
  const [lead] = await db
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return lead;
}

export async function obterReceitaDoLead(leadId: number): Promise<PrescriptionFile | null> {
  const [r] = await db
    .select()
    .from(prescriptionFiles)
    .where(eq(prescriptionFiles.leadId, leadId))
    .orderBy(desc(prescriptionFiles.createdAt))
    .limit(1);
  return r ?? null;
}

// ─── Expurgo ──────────────────────────────────────────────────────────────────
export async function listarReceitasVencidas(agora: Date): Promise<Pick<PrescriptionFile, "id" | "filePath">[]> {
  return db
    .select({ id: prescriptionFiles.id, filePath: prescriptionFiles.filePath })
    .from(prescriptionFiles)
    .where(and(isNull(prescriptionFiles.purgedAt), lte(prescriptionFiles.expiresAt, agora)));
}

export async function marcarReceitasExpurgadas(ids: number[], agora: Date): Promise<void> {
  if (!ids.length) return;
  await db.update(prescriptionFiles).set({ purgedAt: agora }).where(inArray(prescriptionFiles.id, ids));
}

/** Arquivos que ainda deveriam existir em disco (não expurgados). */
export async function caminhosDeReceitasAtivas(): Promise<string[]> {
  const linhas = await db
    .select({ filePath: prescriptionFiles.filePath })
    .from(prescriptionFiles)
    .where(isNull(prescriptionFiles.purgedAt));
  return linhas.map(l => l.filePath);
}
