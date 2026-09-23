// Mensagem pronta do WhatsApp que acompanha o protocolo.
//
// Formato fixo — a assistente reconhece o lead pelo "Protocolo SR-XXXXXX":
//   Olá! Vim pelo site da Sanrê. Protocolo SR-XXXXXX — <resumo>.
// Sem nome, telefone ou e-mail da cliente: o link passa por histórico de
// navegador e por quem mais olhar a tela, e a assistente já tem o lead pelo protocolo.

import { linkWhatsapp, unidadePorSlug, WHATSAPP_SANRE } from "@shared/unidades";
import type { ProdutoResumo } from "./repositorio";
import type { LeadEntrada } from "./validacao";

export function nomeDoProduto(p: Pick<ProdutoResumo, "title" | "brand" | "modelCode">): string {
  if (p.brand && p.modelCode) return `${p.brand} ${p.modelCode}`;
  if (p.brand && !p.title.toLowerCase().includes(p.brand.toLowerCase())) return `${p.brand} ${p.title}`;
  return p.title;
}

export function resumoDoLead(dados: LeadEntrada, produto: ProdutoResumo | null): string {
  const unidade = unidadePorSlug(dados.unidade)?.rotulo;
  switch (dados.tipo) {
    case "orcamento_grau": {
      const alvo = produto ? `orçamento de lentes para a armação ${nomeDoProduto(produto)}` : "orçamento de lentes de grau";
      return unidade ? `${alvo}, atendimento em ${unidade}` : alvo;
    }
    case "reserva":
      return `reserva do ${produto ? nomeDoProduto(produto) : "óculos"} para experimentar em ${unidade ?? "uma das lojas"}`;
    case "empresa": {
      const q = dados.detalhes.quantidade;
      const grau = dados.detalhes.precisaGrau ? ", com lente de grau" : "";
      return `pedido de EPI para ${dados.empresa}, ${q} ${q === 1 ? "unidade" : "unidades"}${grau}`;
    }
  }
}

export function whatsappDoLead(protocolo: string, dados: LeadEntrada, produto: ProdutoResumo | null): string {
  const numero = unidadePorSlug(dados.unidade)?.whatsapp ?? WHATSAPP_SANRE;
  return linkWhatsapp(`Olá! Vim pelo site da Sanrê. Protocolo ${protocolo} — ${resumoDoLead(dados, produto)}.`, numero);
}
