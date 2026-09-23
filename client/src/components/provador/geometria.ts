/**
 * Onde e em que tamanho desenhar o óculos, a partir dos pontos do rosto.
 *
 * ── Referências no rosto (índices do FaceLandmarker, 478 pontos) ──
 *  · Centro de cada olho = média dos dois cantos (33+133 e 263+362). Não usa
 *    a íris: ela anda com o olhar, os cantos não.
 *  · Inclinação (roll) = ângulo da reta entre os centros dos olhos.
 *  · Centro do óculos = ponte do nariz (168) projetada na linha dos olhos:
 *    a posição horizontal vem da ponte (onde a armação apoia), a vertical vem
 *    dos olhos. Com o rosto virado, a ponte — que fica à frente dos olhos —
 *    já se desloca para o lado certo; somamos um pequeno deslocamento extra
 *    porque a frente da armação fica alguns milímetros à frente da ponte.
 *
 * ── Escala (px por mm) ──
 * Duas medidas do rosto, as duas medidas na linha dos olhos, e a média delas:
 *  · distância entre os centros dos olhos ≈ 63 mm (distância interpupilar
 *    média de adulto);
 *  · largura do rosto nas têmporas (127↔356) ≈ TEMPORAS_MM.
 * TEMPORAS_MM foi calibrada nas fotos de teste para as duas concordarem:
 * razão têmporas/olhos entre 2,18 e 2,37 em oito rostos, média 2,27 →
 * 2,27 × 63 ≈ 143 mm. Média de duas medidas quase independentes
 * treme menos que qualquer uma sozinha: os cantos dos olhos são nítidos, o
 * contorno do rosto oscila com cabelo e fundo.
 *
 * ── Largura do óculos ──
 *  · Com medidas da armação: 2 × lente + ponte + 2 × 6 mm (aro e dobradiça).
 *    Ex.: 58□14 → 142 mm. O PNG frontal é recortado rente à armação, então a
 *    largura do PNG é a largura total da frente.
 *  · Sem medidas: LARGURA_PADRAO_MM — a largura do rosto nas têmporas, isto é,
 *    a armação ocupa o rosto na altura dos olhos.
 *
 * ── Rosto virado (yaw) e inclinado para frente/trás (pitch) ──
 * As duas medidas de escala são pares simétricos, então a projeção delas já
 * encolhe por cos(yaw) — a largura desenhada acompanha sozinha. A altura não
 * encolhe com o yaw: ela usa a largura "de frente" (÷ cos yaw) e encolhe só com
 * o pitch. Yaw e pitch saem das coordenadas 3D dos pontos (z do modelo está na
 * mesma escala de x).
 *
 * ── Tremor ──
 * Cada grandeza passa por um filtro One Euro: média exponencial cujo peso se
 * adapta à velocidade — parado, suaviza forte (não treme); em movimento,
 * suaviza pouco (não atrasa).
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export const DPI_MEDIA_MM = 63;
/** Largura média do rosto nas têmporas (127↔356) — calibrada; ver cabeçalho. */
export const TEMPORAS_MM = 143;
export const LARGURA_PADRAO_MM = TEMPORAS_MM;
/** Aro + dobradiça de cada lado, somados à lente. */
export const ARO_MM = 6;
/** Quanto a frente da armação fica à frente do ponto 168 (ponte do nariz). */
export const PROFUNDIDADE_FRENTE_MM = 8;

const P = {
  olhoDirExterno: 33,
  olhoDirInterno: 133,
  olhoEsqExterno: 263,
  olhoEsqInterno: 362,
  ponte: 168,
  temporaDir: 127,
  temporaEsq: 356,
  testa: 10,
  queixo: 152,
} as const;

/** Pose do óculos em pixels da fonte (vídeo ou foto), sem espelhamento. */
export interface PoseRosto {
  /** Centro: ponte do nariz na linha dos olhos. */
  x: number;
  y: number;
  /** Inclinação da linha dos olhos, em radianos. */
  angulo: number;
  /** Pixels por milímetro ao longo da linha dos olhos (já encolhido pelo yaw). */
  pxPorMm: number;
  /** Seno do yaw, com sinal: > 0 = rosto virado para a direita da imagem. */
  senoYaw: number;
  cosYaw: number;
  cosPitch: number;
}

/** Medidas brutas — usadas na calibração e nos testes. */
export interface MedidasRosto {
  distOlhos: number;
  temporas: number;
  temporas3d: number;
  alturaRosto: number;
  alturaRosto3d: number;
}

interface Ponto3 {
  x: number;
  y: number;
  z: number;
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function ponto(p: NormalizedLandmark[], i: number, w: number, h: number): Ponto3 {
  const l = p[i];
  return { x: l.x * w, y: l.y * h, z: l.z * w };
}

function media(a: Ponto3, b: Ponto3): Ponto3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function medirRosto(pontos: NormalizedLandmark[], w: number, h: number): MedidasRosto {
  const pt = (i: number) => ponto(pontos, i, w, h);
  const olhoDir = media(pt(P.olhoDirExterno), pt(P.olhoDirInterno));
  const olhoEsq = media(pt(P.olhoEsqExterno), pt(P.olhoEsqInterno));
  const tD = pt(P.temporaDir);
  const tE = pt(P.temporaEsq);
  const testa = pt(P.testa);
  const queixo = pt(P.queixo);
  return {
    distOlhos: Math.hypot(olhoEsq.x - olhoDir.x, olhoEsq.y - olhoDir.y),
    temporas: Math.hypot(tE.x - tD.x, tE.y - tD.y),
    temporas3d: Math.hypot(tE.x - tD.x, tE.y - tD.y, tE.z - tD.z),
    alturaRosto: Math.hypot(queixo.x - testa.x, queixo.y - testa.y),
    alturaRosto3d: Math.hypot(queixo.x - testa.x, queixo.y - testa.y, queixo.z - testa.z),
  };
}

/** Calcula a pose do óculos para um quadro. `w`/`h` = tamanho da fonte em px. */
export function calcularPose(pontos: NormalizedLandmark[], w: number, h: number): PoseRosto {
  const pt = (i: number) => ponto(pontos, i, w, h);
  const olhoDir = media(pt(P.olhoDirExterno), pt(P.olhoDirInterno));
  const olhoEsq = media(pt(P.olhoEsqExterno), pt(P.olhoEsqInterno));

  const dx = olhoEsq.x - olhoDir.x;
  const dy = olhoEsq.y - olhoDir.y;
  const distOlhos = Math.hypot(dx, dy) || 1;
  const ux = dx / distOlhos;
  const uy = dy / distOlhos;
  const angulo = Math.atan2(dy, dx);

  // Centro: ponte do nariz projetada na linha dos olhos.
  const centroOlhos = media(olhoDir, olhoEsq);
  const ponte = pt(P.ponte);
  const s = (ponte.x - centroOlhos.x) * ux + (ponte.y - centroOlhos.y) * uy;
  const cx = centroOlhos.x + ux * s;
  const cy = centroOlhos.y + uy * s;

  // Yaw pelas têmporas em 3D (base larga = ângulo estável).
  const tD = pt(P.temporaDir);
  const tE = pt(P.temporaEsq);
  const t2d = Math.hypot(tE.x - tD.x, tE.y - tD.y) || 1;
  const tx = (tE.x - tD.x) * ux + (tE.y - tD.y) * uy; // componente na linha dos olhos
  const tz = tE.z - tD.z;
  const yaw = Math.atan2(tz, tx);
  const cosYaw = limitar(Math.cos(yaw), 0.55, 1);
  const senoYaw = limitar(Math.sin(yaw), -0.85, 0.85);

  // Pitch pela reta testa → queixo em 3D.
  const testa = pt(P.testa);
  const queixo = pt(P.queixo);
  const vy = (queixo.x - testa.x) * -uy + (queixo.y - testa.y) * ux; // componente perpendicular aos olhos
  const vz = queixo.z - testa.z;
  const cosPitch = limitar(Math.cos(Math.atan2(vz, vy)), 0.6, 1);

  const pxPorMm = 0.5 * (distOlhos / DPI_MEDIA_MM) + 0.5 * (t2d / TEMPORAS_MM);

  return { x: cx, y: cy, angulo, pxPorMm, senoYaw, cosYaw, cosPitch };
}

// ─── Suavização ──────────────────────────────────────────────────────────────

/**
 * Filtro One Euro (Casiez, Roussel e Vogel, 2012): média exponencial com corte
 * adaptativo. `minCorte` (Hz) controla o tremor parado; `beta`, o atraso em
 * movimento.
 */
class FiltroUmEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(
    private readonly minCorte: number,
    private readonly beta: number,
    private readonly corteDerivada = 1,
  ) {}

  private static alfa(corte: number, dt: number) {
    const tau = 1 / (2 * Math.PI * corte);
    return 1 / (1 + tau / dt);
  }

  filtrar(valor: number, tSegundos: number): number {
    if (this.x === null) {
      this.x = valor;
      this.t = tSegundos;
      return valor;
    }
    const dt = Math.max(1 / 240, tSegundos - this.t);
    this.t = tSegundos;
    const dBruto = (valor - this.x) / dt;
    const aD = FiltroUmEuro.alfa(this.corteDerivada, dt);
    this.dx = aD * dBruto + (1 - aD) * this.dx;
    const corte = this.minCorte + this.beta * Math.abs(this.dx);
    const a = FiltroUmEuro.alfa(corte, dt);
    this.x = a * valor + (1 - a) * this.x;
    return this.x;
  }
}

/**
 * Suaviza a pose quadro a quadro. Posição e escala são filtradas em unidades
 * relativas ao tamanho do rosto, para o mesmo ajuste servir a 480p e a 1080p.
 */
export class SuavizadorPose {
  private fx = new FiltroUmEuro(1.2, 1.2);
  private fy = new FiltroUmEuro(1.2, 1.2);
  private fa = new FiltroUmEuro(1.0, 0.6);
  private fe = new FiltroUmEuro(0.8, 0.8);
  private fs = new FiltroUmEuro(1.0, 0.5);
  private fc = new FiltroUmEuro(1.0, 0.5);
  private fp = new FiltroUmEuro(1.0, 0.5);
  private escalaRef = 0;

  reiniciar() {
    this.fx = new FiltroUmEuro(1.2, 1.2);
    this.fy = new FiltroUmEuro(1.2, 1.2);
    this.fa = new FiltroUmEuro(1.0, 0.6);
    this.fe = new FiltroUmEuro(0.8, 0.8);
    this.fs = new FiltroUmEuro(1.0, 0.5);
    this.fc = new FiltroUmEuro(1.0, 0.5);
    this.fp = new FiltroUmEuro(1.0, 0.5);
    this.escalaRef = 0;
  }

  filtrar(p: PoseRosto, tSegundos: number): PoseRosto {
    // Unidade de posição: ~ a distância entre os olhos em px.
    if (!this.escalaRef) this.escalaRef = Math.max(1, p.pxPorMm * DPI_MEDIA_MM);
    const u = this.escalaRef;
    return {
      x: this.fx.filtrar(p.x / u, tSegundos) * u,
      y: this.fy.filtrar(p.y / u, tSegundos) * u,
      angulo: this.fa.filtrar(p.angulo, tSegundos),
      pxPorMm: this.fe.filtrar(p.pxPorMm / (u / DPI_MEDIA_MM), tSegundos) * (u / DPI_MEDIA_MM),
      senoYaw: this.fs.filtrar(p.senoYaw, tSegundos),
      cosYaw: this.fc.filtrar(p.cosYaw, tSegundos),
      cosPitch: this.fp.filtrar(p.cosPitch, tSegundos),
    };
  }
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

export interface ArmacaoDesenho {
  fonte: CanvasImageSource;
  /** Largura e altura da fonte em px (já recortada rente à armação). */
  largura: number;
  altura: number;
  /** Onde fica a linha dos olhos, em fração da altura a partir do topo. */
  linhaOlhos: number;
  /** Largura real da frente, em mm (medidas da armação ou padrão). */
  larguraMm: number;
}

/** Largura total da frente em mm a partir das medidas do catálogo. */
export function larguraFrenteMm(lenteMm?: number | null, ponteMm?: number | null): number {
  if (lenteMm && ponteMm && lenteMm > 20 && lenteMm < 90 && ponteMm > 5 && ponteMm < 40) {
    return 2 * lenteMm + ponteMm + 2 * ARO_MM;
  }
  return LARGURA_PADRAO_MM;
}

/**
 * Desenha o óculos no contexto. Com `espelhar`, a fonte (vídeo) foi desenhada
 * espelhada numa tela de largura `larguraTela`: a posição e o ângulo são
 * espelhados, mas a imagem do óculos NÃO — o logotipo continua legível.
 */
export function desenharOculos(
  ctx: CanvasRenderingContext2D,
  arm: ArmacaoDesenho,
  pose: PoseRosto,
  espelhar: boolean,
  larguraTela: number,
  opacidade = 1,
) {
  const largura = arm.larguraMm * pose.pxPorMm;
  const larguraFrontal = largura / pose.cosYaw;
  const altura = larguraFrontal * (arm.altura / arm.largura) * pose.cosPitch;
  // A frente da armação fica à frente da ponte: com o rosto virado, ela
  // desliza um pouco mais para o lado do nariz.
  const desvio = pose.senoYaw * PROFUNDIDADE_FRENTE_MM * (pose.pxPorMm / pose.cosYaw);

  const x = espelhar ? larguraTela - pose.x : pose.x;
  const angulo = espelhar ? -pose.angulo : pose.angulo;
  const deslocamento = espelhar ? -desvio : desvio;

  ctx.save();
  ctx.globalAlpha = opacidade;
  ctx.translate(x, pose.y);
  ctx.rotate(angulo);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(arm.fonte, -largura / 2 + deslocamento, -altura * arm.linhaOlhos, largura, altura);
  ctx.restore();
}
