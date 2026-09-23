/**
 * Motor do provador: MediaPipe FaceLandmarker rodando no navegador da cliente.
 *
 * - O pacote `@mediapipe/tasks-vision` entra por `import()` dinâmico: só é
 *   baixado quando alguém abre o provador, e não pesa no bundle das outras
 *   páginas.
 * - O runtime (wasm) é servido pelo próprio site em `/provador/wasm`
 *   (server/index.ts expõe o node_modules) e o modelo em
 *   `/provador/face_landmarker.task` (client/public). Nada depende de CDN
 *   de terceiro e nenhuma imagem sai do aparelho.
 * - Tenta GPU (WebGL) e cai para CPU quando a GPU não está disponível
 *   (navegador sem WebGL2, driver bloqueado, modo headless).
 * - Um único landmarker por aba: fechar e reabrir o provador não baixa nem
 *   compila o modelo de novo.
 */
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

export const CAMINHO_MODELO = "/provador/face_landmarker.task";
export const CAMINHO_WASM = "/provador/wasm";

export type ModoMotor = "VIDEO" | "IMAGE";
export type Aceleracao = "GPU" | "CPU";

/** Pontos do rosto: 478, normalizados 0–1 (z na mesma escala de x). */
export interface ResultadoRosto {
  pontos: NormalizedLandmark[];
}

export type FonteImagem = HTMLCanvasElement | HTMLImageElement | ImageBitmap | HTMLVideoElement;

export interface Motor {
  readonly aceleracao: Aceleracao;
  /** Troca o modo de execução (vídeo ao vivo × foto). Serializado. */
  prepararModo(modo: ModoMotor): Promise<void>;
  /** Um quadro do vídeo. Síncrono — chamado dentro do requestAnimationFrame. */
  detectarVideo(video: HTMLVideoElement, instanteMs: number): ResultadoRosto | null;
  /** Uma foto parada. */
  detectarImagem(fonte: FonteImagem): Promise<ResultadoRosto | null>;
}

let promessa: Promise<Motor> | null = null;

/** Carrega (uma vez por aba) o FaceLandmarker. Rejeita se o modelo não puder rodar. */
export function carregarMotor(): Promise<Motor> {
  if (!promessa) {
    promessa = criarMotor().catch((erro) => {
      // Falhou (rede, navegador sem wasm): permite tentar de novo.
      promessa = null;
      throw erro;
    });
  }
  return promessa;
}

/** true se o navegador tem o mínimo para rodar o provador (wasm + canvas). */
export function navegadorSuportaProvador(): boolean {
  return typeof WebAssembly === "object" && typeof document !== "undefined" && !!document.createElement("canvas").getContext;
}

async function criarMotor(): Promise<Motor> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const arquivos = await FilesetResolver.forVisionTasks(CAMINHO_WASM);

  const criar = (delegate: Aceleracao, modo: ModoMotor) =>
    FaceLandmarker.createFromOptions(arquivos, {
      baseOptions: { modelAssetPath: CAMINHO_MODELO, delegate },
      runningMode: modo,
      numFaces: 1,
      outputFaceBlendshapes: false,
      // A pose sai dos próprios pontos em 3D (geometria.ts); a matriz facial
      // concordou com eles na calibração e não precisa ser calculada.
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  let aceleracao: Aceleracao = "GPU";
  let modoAtual: ModoMotor = "VIDEO";
  let landmarker: FaceLandmarker;
  try {
    landmarker = await criar("GPU", modoAtual);
  } catch {
    aceleracao = "CPU";
    landmarker = await criar("CPU", modoAtual);
  }

  // A GPU pode aceitar a criação e falhar no primeiro quadro (contexto WebGL
  // perdido, driver na lista negra). Nesse caso o motor se recria em CPU.
  let recriando: Promise<void> | null = null;
  let falhou = false;
  const recriarEmCpu = (): Promise<void> => {
    if (!recriando) {
      recriando = (async () => {
        try {
          landmarker.close();
        } catch {
          /* já fechado */
        }
        landmarker = await criar("CPU", modoAtual);
        aceleracao = "CPU";
      })()
        .catch((erro) => {
          falhou = true;
          throw erro;
        })
        .finally(() => {
          recriando = null;
        });
    }
    return recriando;
  };

  let fila: Promise<void> = Promise.resolve();

  const converter = (r: ReturnType<FaceLandmarker["detect"]>): ResultadoRosto | null => {
    const pontos = r.faceLandmarks?.[0];
    if (!pontos || pontos.length < 468) return null;
    return { pontos };
  };

  let falhasGpu = 0;

  const motor: Motor = {
    get aceleracao() {
      return aceleracao;
    },
    prepararModo(modo) {
      fila = fila.then(async () => {
        if (recriando) await recriando;
        if (modoAtual === modo) return;
        await landmarker.setOptions({ runningMode: modo });
        modoAtual = modo;
      });
      return fila;
    },
    detectarVideo(video, instanteMs) {
      if (falhou) throw new Error("motor do provador indisponível");
      if (modoAtual !== "VIDEO" || recriando) return null;
      try {
        const r = converter(landmarker.detectForVideo(video, instanteMs));
        falhasGpu = 0;
        return r;
      } catch (erro) {
        if (aceleracao === "CPU") throw erro;
        // Três quadros seguidos com erro na GPU: recria em CPU e segue.
        if (++falhasGpu >= 3) void recriarEmCpu().catch(() => undefined);
        return null;
      }
    },
    async detectarImagem(fonte) {
      await motor.prepararModo("IMAGE");
      try {
        return converter(landmarker.detect(fonte));
      } catch (erro) {
        if (aceleracao !== "GPU") throw erro;
        await recriarEmCpu();
        if (modoAtual !== "IMAGE") {
          await landmarker.setOptions({ runningMode: "IMAGE" });
          modoAtual = "IMAGE";
        }
        return converter(landmarker.detect(fonte));
      }
    },
  };
  return motor;
}
