/**
 * Painel de leads do site: orçamento de grau, reserva para experimentar e
 * pedidos de empresas (EPI).
 *
 * A receita é dado de saúde (LGPD art. 11): só sai daqui, por download
 * autenticado, enquanto estiver dentro do prazo de 90 dias. O arquivo nunca
 * aparece por URL — o download passa pelo token do painel e vira um blob local.
 */
import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Inbox, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { unidadePorSlug } from "@shared/unidades";
import { PERIODOS, QUANDO, SEGMENTOS, TRATAMENTOS, USOS, mascararTelefone } from "@/components/grau/regras";

const TIPOS: Record<string, string> = {
  orcamento_grau: "Orçamento de grau",
  reserva: "Reserva",
  empresa: "Empresa / EPI",
};

const STATUS: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "#2563eb" },
  em_atendimento: { label: "Em atendimento", color: "#d97706" },
  orcamento_enviado: { label: "Orçamento enviado", color: "#7c3aed" },
  convertido: { label: "Convertido", color: "#059669" },
  descartado: { label: "Descartado", color: "#6b7280" },
};

const rotulo = (lista: readonly { valor: string; titulo: string }[], valor: unknown) =>
  lista.find(i => i.valor === valor)?.titulo ?? (valor ? String(valor) : "—");

const TRATAMENTOS_TODOS = [...TRATAMENTOS, { valor: "nenhum", titulo: "Nenhum por enquanto" }];

interface LinhaLead {
  id: number;
  protocolo: string;
  tipo: string;
  status: string;
  unidade: string | null;
  nome: string;
  telefone: string;
  empresa: string | null;
  criadoEm: string;
  produtoTitulo: string | null;
  produtoMarca: string | null;
  temReceita: boolean;
}

interface DetalheLead {
  id: number;
  protocolo: string;
  tipo: string;
  status: string;
  unidade: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  empresa: string | null;
  origem: string;
  detalhes: Record<string, any>;
  consentimentos: { contato?: { versao: string; em: string }; receita?: { versao: string; em: string } } | null;
  produtoSlugInformado: string | null;
  criadoEm: string;
  atualizadoEm: string;
  produto: { id: number; slug: string; title: string; brand: string | null; nome: string } | null;
  receita: {
    situacao: "disponivel" | "vencida" | "expurgada";
    mimeType: string;
    tamanho: number;
    recebidaEm: string;
    expiraEm: string;
    expurgadaEm: string | null;
  } | null;
}

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function linkWhatsappLead(l: Pick<DetalheLead, "telefone" | "nome" | "protocolo">): string {
  const primeiroNome = l.nome.trim().split(/\s+/)[0] ?? "";
  const texto = `Olá, ${primeiroNome}! Aqui é da Óticas Sanrê, sobre o seu pedido ${l.protocolo}.`;
  return `https://wa.me/55${l.telefone}?text=${encodeURIComponent(texto)}`;
}

function Selo({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, color: "#6b7280" };
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${s.color}1f`, color: s.color }}>
      {s.label}
    </span>
  );
}

function Linha({ rotulo: r, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-gray-500">{r}</dt>
      <dd className="min-w-0 break-words text-gray-900">{children}</dd>
    </div>
  );
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<LinhaLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheLead | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const { toast } = useToast();
  const limit = 20;

  const carregar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (tipo) params.set("tipo", tipo);
    if (status) params.set("status", status);
    try {
      const r = await adminFetch(`/api/admin/leads?${params}`);
      const d = await r.json();
      setLeads(d.leads || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, tipo, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarDetalhe = useCallback(async (id: number) => {
    setCarregandoDetalhe(true);
    try {
      const r = await adminFetch(`/api/admin/leads/${id}`);
      setDetalhe(r.ok ? await r.json() : null);
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  useEffect(() => {
    if (selecionado === null) return;
    setDetalhe(null);
    carregarDetalhe(selecionado);
  }, [selecionado, carregarDetalhe]);

  const mudarStatus = async (novo: string) => {
    if (!detalhe || novo === detalhe.status) return;
    setSalvandoStatus(true);
    try {
      const r = await adminFetch(`/api/admin/leads/${detalhe.id}`, { method: "PATCH", body: JSON.stringify({ status: novo }) });
      if (!r.ok) {
        toast({ title: "Não foi possível mudar o status", variant: "destructive" });
        return;
      }
      setDetalhe({ ...detalhe, status: novo });
      setLeads(ls => ls.map(l => (l.id === detalhe.id ? { ...l, status: novo } : l)));
      toast({ title: `Status: ${STATUS[novo]?.label ?? novo}` });
    } finally {
      setSalvandoStatus(false);
    }
  };

  const baixarReceita = async () => {
    if (!detalhe) return;
    setBaixando(true);
    try {
      const r = await adminFetch(`/api/admin/leads/${detalhe.id}/receita`);
      if (r.status === 410) {
        toast({ title: "Receita apagada", description: "O prazo de retenção de 90 dias terminou.", variant: "destructive" });
        carregarDetalhe(detalhe.id);
        return;
      }
      if (!r.ok) {
        toast({ title: "Não foi possível baixar a receita", variant: "destructive" });
        return;
      }
      const blob = await r.blob();
      const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `receita-${detalhe.protocolo}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setBaixando(false);
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} pedido(s) do site — orçamento de grau, reserva e empresas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} className="gap-2">
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm">
        <select
          aria-label="Filtrar por tipo"
          value={tipo}
          onChange={e => { setTipo(e.target.value); setPage(1); }}
          className="rounded-md border px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          aria-label="Filtrar por status"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-md border px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Inbox size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum lead encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 text-left">Protocolo</th>
                    <th className="px-4 py-3 text-left">Contato</th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">Pedido</th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">Unidade</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Data</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id} className="cursor-pointer border-b transition-colors hover:bg-gray-50" onClick={() => setSelecionado(l.id)}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-semibold text-gray-800">{l.protocolo}</p>
                        <p className="text-xs text-gray-400">{TIPOS[l.tipo] ?? l.tipo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-800">{l.nome}</p>
                        <p className="text-xs text-gray-400">{mascararTelefone(l.telefone)}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                        <span className="flex items-center gap-1.5">
                          {l.temReceita && <FileText size={14} className="shrink-0 text-gray-400" aria-label="Com receita" />}
                          <span className="truncate">
                            {l.tipo === "empresa"
                              ? l.empresa
                              : l.produtoTitulo
                                ? [l.produtoMarca, l.produtoTitulo].filter(Boolean).join(" · ")
                                : "Sem armação"}
                          </span>
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-gray-600 lg:table-cell">{unidadePorSlug(l.unidade)?.rotulo ?? "—"}</td>
                      <td className="px-4 py-3 text-center"><Selo status={l.status} /></td>
                      <td className="hidden px-4 py-3 text-right text-xs text-gray-400 sm:table-cell">{data(l.criadoEm)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={e => { e.stopPropagation(); setSelecionado(l.id); }}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-500">
                <span>Página {page} de {pages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={selecionado !== null} onOpenChange={o => { if (!o) setSelecionado(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="pr-8">
            <SheetTitle className="font-mono text-2xl tracking-wide">{detalhe?.protocolo ?? "Lead"}</SheetTitle>
            <SheetDescription>
              {detalhe ? `${TIPOS[detalhe.tipo] ?? detalhe.tipo} · recebido em ${dataHora(detalhe.criadoEm)}` : "Carregando…"}
            </SheetDescription>
          </SheetHeader>

          {carregandoDetalhe && !detalhe ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
            </div>
          ) : detalhe ? (
            <div className="mt-6 space-y-6">
              <section className="rounded-lg border p-4">
                <label htmlFor="lead-status" className="text-xs font-medium uppercase text-gray-500">Status</label>
                <div className="mt-2 flex items-center gap-3">
                  <select
                    id="lead-status"
                    value={detalhe.status}
                    disabled={salvandoStatus}
                    onChange={e => mudarStatus(e.target.value)}
                    className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none"
                  >
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <Selo status={detalhe.status} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-medium uppercase text-gray-500">Contato</h3>
                <dl className="divide-y">
                  <Linha rotulo="Nome">{detalhe.nome}</Linha>
                  <Linha rotulo="WhatsApp">{mascararTelefone(detalhe.telefone)}</Linha>
                  {detalhe.email && <Linha rotulo="E-mail"><a href={`mailto:${detalhe.email}`} className="text-blue-600 hover:underline">{detalhe.email}</a></Linha>}
                  {detalhe.empresa && <Linha rotulo="Empresa">{detalhe.empresa}</Linha>}
                  <Linha rotulo="Unidade">{unidadePorSlug(detalhe.unidade)?.rotulo ?? "Sem preferência"}</Linha>
                </dl>
                <a
                  href={linkWhatsappLead(detalhe)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#1b7a47] px-4 py-2 text-sm font-medium text-white hover:bg-[#16663b]"
                >
                  <MessageCircle size={16} /> Abrir WhatsApp
                </a>
              </section>

              {(detalhe.produto || detalhe.produtoSlugInformado) && (
                <section>
                  <h3 className="mb-1 text-xs font-medium uppercase text-gray-500">Armação</h3>
                  {detalhe.produto ? (
                    <p className="text-sm text-gray-900">
                      {detalhe.produto.nome}
                      {detalhe.produto.nome !== detalhe.produto.title && <span className="text-gray-500"> — {detalhe.produto.title}</span>}{" "}
                      <a href={`/loja/produto/${detalhe.produto.slug}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                        ver na loja
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Produto indisponível no catálogo ({detalhe.produtoSlugInformado})</p>
                  )}
                </section>
              )}

              <section>
                <h3 className="mb-1 text-xs font-medium uppercase text-gray-500">Pedido</h3>
                <dl className="divide-y">
                  {detalhe.tipo === "orcamento_grau" && (
                    <>
                      <Linha rotulo="Uso principal">{rotulo(USOS, detalhe.detalhes.usoPrincipal)}</Linha>
                      <Linha rotulo="Tratamentos">
                        {(detalhe.detalhes.tratamentosDesejados ?? []).length
                          ? (detalhe.detalhes.tratamentosDesejados as string[]).map(t => rotulo(TRATAMENTOS_TODOS, t)).join(", ")
                          : "Não marcou — quer ver as opções"}
                      </Linha>
                      {detalhe.detalhes.jaUsaMultifocal !== undefined && (
                        <Linha rotulo="Já usa multifocal">{detalhe.detalhes.jaUsaMultifocal ? "Sim" : "Não"}</Linha>
                      )}
                    </>
                  )}
                  {detalhe.tipo === "reserva" && (
                    <>
                      <Linha rotulo="Quando">{rotulo(QUANDO, detalhe.detalhes.quando)}</Linha>
                      <Linha rotulo="Período">{detalhe.detalhes.periodo ? rotulo(PERIODOS, detalhe.detalhes.periodo) : "Qualquer horário"}</Linha>
                    </>
                  )}
                  {detalhe.tipo === "empresa" && (
                    <>
                      <Linha rotulo="CNPJ">{detalhe.detalhes.cnpj ? String(detalhe.detalhes.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—"}</Linha>
                      <Linha rotulo="Quantidade">{detalhe.detalhes.quantidade}</Linha>
                      <Linha rotulo="Lente de grau">{detalhe.detalhes.precisaGrau ? "Sim, alguém precisa" : "Não"}</Linha>
                      <Linha rotulo="Segmento">{rotulo(SEGMENTOS, detalhe.detalhes.segmento)}</Linha>
                    </>
                  )}
                  {detalhe.detalhes.observacoes && <Linha rotulo="Observações"><span className="whitespace-pre-line">{detalhe.detalhes.observacoes}</span></Linha>}
                </dl>
              </section>

              {detalhe.tipo === "orcamento_grau" && (
                <section className="rounded-lg border p-4">
                  <h3 className="text-xs font-medium uppercase text-gray-500">Receita</h3>
                  {detalhe.receita?.situacao === "disponivel" ? (
                    <>
                      <p className="mt-2 text-sm text-gray-700">
                        Recebida em {dataHora(detalhe.receita.recebidaEm)} · {(detalhe.receita.tamanho / 1024).toFixed(0)} KB.
                        Apagada automaticamente em {data(detalhe.receita.expiraEm)}.
                      </p>
                      <Button onClick={baixarReceita} disabled={baixando} className="mt-3 gap-2">
                        <Download size={16} /> {baixando ? "Baixando…" : "Baixar receita"}
                      </Button>
                      <p className="mt-3 text-xs text-gray-500">
                        Dado de saúde (LGPD): use só para este orçamento e não encaminhe o arquivo para fora do atendimento.
                      </p>
                    </>
                  ) : detalhe.receita ? (
                    <p className="mt-2 text-sm text-gray-700">
                      {detalhe.receita.expurgadaEm
                        ? `Apagada em ${data(detalhe.receita.expurgadaEm)} — prazo de retenção de 90 dias.`
                        : "Prazo de 90 dias vencido — o arquivo será apagado na próxima rodada de expurgo."}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-700">
                      {detalhe.detalhes.receitaDepois ? "A cliente vai enviar a receita depois (pelo WhatsApp)." : "Sem receita anexada."}
                    </p>
                  )}
                </section>
              )}

              {detalhe.consentimentos && (
                <section>
                  <h3 className="mb-1 text-xs font-medium uppercase text-gray-500">Consentimentos (LGPD)</h3>
                  <dl className="divide-y">
                    {detalhe.consentimentos.contato && (
                      <Linha rotulo="Contato">{detalhe.consentimentos.contato.versao} · {dataHora(detalhe.consentimentos.contato.em)}</Linha>
                    )}
                    {detalhe.consentimentos.receita && (
                      <Linha rotulo="Receita">{detalhe.consentimentos.receita.versao} · {dataHora(detalhe.consentimentos.receita.em)}</Linha>
                    )}
                  </dl>
                </section>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-500">Lead não encontrado.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
