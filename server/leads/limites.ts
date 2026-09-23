// Limite por IP em janela deslizante, em memória (processo único no PM2).
//
// Dois contadores: tentativas (qualquer POST, barra robô que só manda lixo) e
// leads criados (5 a cada 10 minutos, o suficiente para uma pessoa real que
// pede orçamento de duas armações e reserva uma terceira).
//
// O IP vem de req.ip: atrás de proxy reverso, o app precisa de
// `app.set("trust proxy", 1)` para enxergar o IP real da cliente.

const JANELA_MS = 10 * 60 * 1000;

class LimiteJanela {
  private marcas = new Map<string, number[]>();
  constructor(private readonly maximo: number) {
    setInterval(() => this.limpar(), JANELA_MS).unref();
  }
  private recentes(chave: string): number[] {
    const corte = Date.now() - JANELA_MS;
    const lista = (this.marcas.get(chave) ?? []).filter(t => t > corte);
    this.marcas.set(chave, lista);
    return lista;
  }
  excedido(chave: string): boolean {
    return this.recentes(chave).length >= this.maximo;
  }
  registrar(chave: string): void {
    this.recentes(chave).push(Date.now());
  }
  private limpar(): void {
    const corte = Date.now() - JANELA_MS;
    this.marcas.forEach((lista, chave) => {
      if (!lista.some(t => t > corte)) this.marcas.delete(chave);
    });
  }
}

const maximoLeads = Math.max(1, Number(process.env.LEADS_LIMITE_IP) || 5);

export const limiteTentativas = new LimiteJanela(Math.max(30, maximoLeads * 6));
export const limiteLeads = new LimiteJanela(maximoLeads);
