/**
 * Limites de uso e memória curta de sessão do roteiro — tudo em memória do
 * processo (uma instância no PM2). Nada aqui guarda o texto das mensagens.
 */

// ─── Rate limit (janela deslizante de 60 s) ─────────────────────────────────

const JANELA_MS = 60_000;
export const LIMITE_POR_IP = Number(process.env.ASSISTENTE_LIMITE_IP) || 20;
export const LIMITE_POR_SESSAO = Number(process.env.ASSISTENTE_LIMITE_SESSAO) || 10;

const porIp = new Map<string, number[]>();
const porSessao = new Map<string, number[]>();

/** Segundos até liberar (0 = liberado). Poda a janela, não registra nada. */
function espera(mapa: Map<string, number[]>, chave: string, limite: number, agora: number): number {
  const recentes = (mapa.get(chave) ?? []).filter(t => agora - t < JANELA_MS);
  mapa.set(chave, recentes);
  if (recentes.length < limite) return 0;
  // Segundos até a mensagem mais antiga da janela sair dela.
  return Math.max(1, Math.ceil((JANELA_MS - (agora - recentes[0])) / 1000));
}

/**
 * 0 = liberado (e a mensagem é contada no IP e na sessão); >0 = segundos para
 * tentar de novo. Mensagem recusada não conta — senão quem insiste nunca sai.
 */
export function consumirLimite(ip: string, sessaoId: string): number {
  const agora = Date.now();
  const bloqueio = Math.max(
    espera(porIp, ip, LIMITE_POR_IP, agora),
    espera(porSessao, sessaoId, LIMITE_POR_SESSAO, agora),
  );
  if (bloqueio) return bloqueio;
  porIp.get(ip)!.push(agora);
  porSessao.get(sessaoId)!.push(agora);
  return 0;
}

// ─── Memória curta do roteiro ────────────────────────────────────────────────

export interface EstadoSessao {
  /** Quantas mensagens seguidas o roteiro não entendeu. */
  naoEntendeu: number;
  /**
   * Última dúvida útil da cliente, JÁ mascarada e resumida (protocolo.ts) —
   * vai na mensagem do WhatsApp quando ela pede uma pessoa. Nunca é logada.
   */
  ultimaDuvida: string | null;
  atualizadoEm: number;
}

const TTL_SESSAO_MS = 2 * 60 * 60 * 1000;
const MAX_SESSOES = 5000;
const sessoes = new Map<string, EstadoSessao>();

export function lerSessao(sessaoId: string): EstadoSessao {
  const s = sessoes.get(sessaoId);
  if (s && Date.now() - s.atualizadoEm < TTL_SESSAO_MS) return s;
  return { naoEntendeu: 0, ultimaDuvida: null, atualizadoEm: Date.now() };
}

export function gravarSessao(sessaoId: string, estado: EstadoSessao): void {
  sessoes.delete(sessaoId); // reinsere no fim: o Map vira fila por recência
  sessoes.set(sessaoId, { ...estado, atualizadoEm: Date.now() });
  if (sessoes.size > MAX_SESSOES) {
    const maisAntiga = sessoes.keys().next().value;
    if (maisAntiga) sessoes.delete(maisAntiga);
  }
}

// ─── Faxina ──────────────────────────────────────────────────────────────────

setInterval(() => {
  const agora = Date.now();
  for (const mapa of [porIp, porSessao]) {
    for (const [k, v] of Array.from(mapa)) {
      if (!v.length || agora - v[v.length - 1] >= JANELA_MS) mapa.delete(k);
    }
  }
  for (const [k, s] of Array.from(sessoes)) {
    if (agora - s.atualizadoEm >= TTL_SESSAO_MS) sessoes.delete(k);
  }
}, 60_000).unref();
