/**
 * Prepara a vista frontal do óculos (`tryonImageUrl`) para o desenho.
 *
 * O contrato é "PNG frontal com fundo transparente", mas as fotos de
 * fabricante chegam com vícios que estragam o provador. Tratamos aqui, uma vez
 * por imagem, com cache:
 *  · margem transparente em volta (o PNG do fabricante tem 20–30 % de sobra):
 *    recorta rente à armação, senão a largura calculada em mm não bate;
 *  · sombra pontilhada e reflexo "no chão" abaixo da armação (fotos de
 *    catálogo EssilorLuxottica): o recorte usa só pixels quase opacos, e os
 *    pontos soltos de sombra são apagados;
 *  · fundo branco em vez de transparente: o branco (e o quase-branco sem cor)
 *    vira transparente com rampa suave, o que também deixa a lente incolor
 *    de armação de grau transparente, como deve ser.
 */
import { larguraFrenteMm, type ArmacaoDesenho } from "./geometria";

export interface ArmacaoPronta extends ArmacaoDesenho {
  /** false quando a imagem veio de outro domínio sem CORS: dá para desenhar, não para salvar a foto. */
  exportavel: boolean;
}

const LARGURA_MAX = 1200;

const cache = new Map<string, Promise<Omit<ArmacaoPronta, "larguraMm">>>();

function carregarImagem(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error(`imagem do provador não carregou: ${url}`));
    img.src = url;
  });
}

/** Carrega e prepara a armação. `lenteMm`/`ponteMm` definem a largura real. */
export async function carregarArmacao(
  url: string,
  lenteMm?: number | null,
  ponteMm?: number | null,
): Promise<ArmacaoPronta> {
  let p = cache.get(url);
  if (!p) {
    p = preparar(url).catch((e) => {
      cache.delete(url);
      throw e;
    });
    cache.set(url, p);
  }
  const base = await p;
  return { ...base, larguraMm: larguraFrenteMm(lenteMm, ponteMm) };
}

/** Linha dos olhos: armação alta (aviador, oversized) tem os olhos mais perto do topo. */
function linhaDosOlhos(aspecto: number): number {
  return Math.min(0.5, Math.max(0.4, 0.5 - (aspecto - 0.33) * 0.6));
}

async function preparar(url: string): Promise<Omit<ArmacaoPronta, "larguraMm">> {
  let img: HTMLImageElement;
  let cors = true;
  try {
    img = await carregarImagem(url, true);
  } catch {
    // Outro domínio sem cabeçalho CORS: ainda dá para desenhar.
    cors = false;
    img = await carregarImagem(url, false);
  }

  const escala = Math.min(1, LARGURA_MAX / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(img, 0, 0, w, h);

  let dados: ImageData;
  try {
    if (!cors) throw new Error("sem cors");
    dados = ctx.getImageData(0, 0, w, h);
  } catch {
    // Sem acesso aos pixels: usa a imagem inteira, sem recorte.
    const aspecto = h / w;
    return { fonte: tela, largura: w, altura: h, linhaOlhos: linhaDosOlhos(aspecto), exportavel: false };
  }

  const px = dados.data;
  if (fundoOpacoClaro(px, w, h)) removerFundoBranco(px);
  apagarPontosSoltos(px, w, h);
  ctx.putImageData(dados, 0, 0);

  const caixa = caixaOpaca(px, w, h);
  if (!caixa) throw new Error("imagem do provador vazia");
  const margem = 1;
  const x0 = Math.max(0, caixa.x0 - margem);
  const y0 = Math.max(0, caixa.y0 - margem);
  const x1 = Math.min(w, caixa.x1 + margem + 1);
  const y1 = Math.min(h, caixa.y1 + margem + 1);

  const recorte = document.createElement("canvas");
  recorte.width = x1 - x0;
  recorte.height = y1 - y0;
  recorte.getContext("2d")!.drawImage(tela, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);

  const aspecto = recorte.height / recorte.width;
  return {
    fonte: recorte,
    largura: recorte.width,
    altura: recorte.height,
    linhaOlhos: linhaDosOlhos(aspecto),
    exportavel: true,
  };
}

/** Os quatro cantos opacos e claros = foto em fundo branco, não PNG transparente. */
function fundoOpacoClaro(px: Uint8ClampedArray, w: number, h: number): boolean {
  const cantos = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1];
  return cantos.every((i) => {
    const o = i * 4;
    return px[o + 3] > 250 && px[o] > 235 && px[o + 1] > 235 && px[o + 2] > 235;
  });
}

function removerFundoBranco(px: Uint8ClampedArray) {
  for (let o = 0; o < px.length; o += 4) {
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    if (max - min > 24) continue; // tem cor: é armação
    // 215 → opaco, 245 → transparente
    const t = (min - 215) / 30;
    if (t <= 0) continue;
    px[o + 3] = Math.round(px[o + 3] * Math.max(0, 1 - t));
  }
}

/**
 * Apaga a sombra pontilhada: pixel pouco opaco, sem vizinho opaco e cercado
 * de transparência. A borda suavizada da armação sempre encosta num pixel
 * opaco, e o degradê de uma lente não tem buracos — os dois ficam.
 */
function apagarPontosSoltos(px: Uint8ClampedArray, w: number, h: number) {
  const apagar: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = px[i * 4 + 3];
      if (a === 0 || a >= 110) continue;
      let zeros = 0;
      let opaco = false;
      for (let dy = -1; dy <= 1 && !opaco; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const v = px[((y + dy) * w + x + dx) * 4 + 3];
          if (v >= 128) {
            opaco = true;
            break;
          }
          if (v === 0) zeros++;
        }
      }
      if (!opaco && zeros >= 3) apagar.push(i);
    }
  }
  for (const i of apagar) px[i * 4 + 3] = 0;
}

/**
 * Caixa dos pixels quase opacos (alfa ≥ 200). Linha ou coluna só conta com um
 * mínimo de pixels, para um ponto perdido não esticar o recorte.
 */
function caixaOpaca(px: Uint8ClampedArray, w: number, h: number) {
  const porLinha = new Uint32Array(h);
  const porColuna = new Uint32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] >= 200) {
        porLinha[y]++;
        porColuna[x]++;
      }
    }
  }
  const minLinha = Math.max(2, Math.round(w * 0.004));
  const minColuna = Math.max(2, Math.round(h * 0.004));
  let y0 = -1;
  let y1 = -1;
  let x0 = -1;
  let x1 = -1;
  for (let y = 0; y < h; y++) if (porLinha[y] >= minLinha) { if (y0 < 0) y0 = y; y1 = y; }
  for (let x = 0; x < w; x++) if (porColuna[x] >= minColuna) { if (x0 < 0) x0 = x; x1 = x; }
  if (y0 < 0 || x0 < 0) return null;
  return { x0, y0, x1, y1 };
}
