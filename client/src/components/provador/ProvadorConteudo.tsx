/**
 * Interface do provador — carregada sob demanda pelo ProvadorAR.
 *
 * Fluxo: tela inicial (explica e pede a câmera) → câmera ao vivo ou foto →
 * troca de armação sem fechar a câmera → "Tirar foto" gera um PNG com o óculos
 * para baixar ou compartilhar. Tudo roda no aparelho: o vídeo nunca sai do
 * navegador, e a foto escolhida também não.
 *
 * O vídeo é desenhado espelhado (selfie) num canvas junto com o óculos, no
 * mesmo quadro em que o rosto foi detectado: vídeo e óculos nunca descasam, e
 * a foto tirada é exatamente o que a cliente vê.
 */
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageUp,
  LoaderCircle,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { precoBR } from "@/lib/marca";
import { medidaArmacao } from "@/lib/oculos";
import { cn } from "@/lib/utils";
import type { OculosProvador, ProvadorARProps } from "./ProvadorAR";
import { carregarMotor, navegadorSuportaProvador, ProvadorSemSuporte, type Motor } from "./motor";
import { calcularPose, desenharOculos, SuavizadorPose, type PoseRosto } from "./geometria";
import { carregarArmacao, type ArmacaoPronta } from "./armacao";

type Fase = "inicio" | "preparando" | "camera" | "foto" | "negada" | "indisponivel" | "erro";
type MotivoIndisponivel = "sem-camera" | "em-uso" | "inseguro";

interface Captura {
  url: string;
  arquivo: File;
  compartilhavel: boolean;
}

interface Foto {
  base: HTMLCanvasElement;
  pontos: NormalizedLandmark[] | null;
}

/** Lado maior da foto enviada, depois de reduzida (detecção e memória). */
const TAM_MAX_FOTO = 1600;
/** Rosto some por uma piscada ou mão na frente: o óculos esmaece nesse tempo. */
const TOLERANCIA_SEM_ROSTO_MS = 250;
/** Depois disso sem rosto, aparece a orientação para centralizar. */
const AVISO_SEM_ROSTO_MS = 900;

const PRIVACIDADE = "A imagem da câmera é processada só no seu aparelho — nada é enviado nem gravado.";

function nomeOculos(o: OculosProvador | undefined): string {
  if (!o) return "";
  return [o.brand, o.title].filter(Boolean).join(" ");
}

function classificarErroCamera(e: unknown): "negada" | MotivoIndisponivel {
  const nome = (e as { name?: string } | null)?.name ?? "";
  if (nome === "NotAllowedError" || nome === "PermissionDeniedError") return "negada";
  if (nome === "SecurityError") return window.isSecureContext ? "negada" : "inseguro";
  if (nome === "NotReadableError" || nome === "TrackStartError" || nome === "AbortError") return "em-uso";
  return "sem-camera"; // NotFoundError, OverconstrainedError, TypeError…
}

function decodificarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("imagem inválida"));
    img.src = url;
  });
}

/** Assinatura discreta na foto salva: de onde veio e qual armação. */
function assinar(ctx: CanvasRenderingContext2D, w: number, h: number, o: OculosProvador | undefined) {
  const faixa = Math.round(Math.max(30, h * 0.055));
  const fonte = Math.round(faixa * 0.38);
  const margem = Math.round(faixa * 0.5);
  ctx.save();
  ctx.fillStyle = "rgba(20, 20, 20, 0.72)";
  ctx.fillRect(0, h - faixa, w, faixa);
  ctx.fillStyle = "#f6f4f0";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${fonte}px "DM Sans", ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Provador virtual · Óticas Sanrê", margem, h - faixa / 2, w * 0.45);
  const nome = nomeOculos(o);
  if (nome) {
    ctx.textAlign = "right";
    ctx.fillText(nome, w - margem, h - faixa / 2, w * 0.45);
  }
  ctx.restore();
}

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Mantém o Tab dentro do diálogo. */
function prenderFoco(e: KeyboardEvent, raiz: HTMLElement | null) {
  if (!raiz) return;
  const itens = Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
  if (!itens.length) {
    e.preventDefault();
    raiz.focus();
    return;
  }
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  const ativo = document.activeElement;
  if (e.shiftKey && (ativo === primeiro || ativo === raiz || !raiz.contains(ativo))) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && (ativo === ultimo || !raiz.contains(ativo))) {
    e.preventDefault();
    primeiro.focus();
  }
}

export default function ProvadorConteudo({
  oculos,
  inicial,
  modo = "pagina",
  onFechar,
  onTrocar,
  acoes,
  filtros,
}: ProvadorARProps) {
  const modal = modo === "modal";
  const idTitulo = useId();

  const [slug, setSlug] = useState<string | undefined>(() =>
    inicial && oculos.some((o) => o.slug === inicial) ? inicial : oculos[0]?.slug,
  );
  const atual = oculos.find((o) => o.slug === slug) ?? oculos[0];

  const [fase, setFase] = useState<Fase>("inicio");
  const [motivo, setMotivo] = useState<MotivoIndisponivel>("sem-camera");
  /** Erro do motor: falha de carga (tentar de novo resolve) ou navegador sem suporte. */
  const [semSuporte, setSemSuporte] = useState(false);
  const [carregandoMotor, setCarregandoMotor] = useState(false);
  const [motorVideoPronto, setMotorVideoPronto] = useState(false);
  const [semRosto, setSemRosto] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [fotoSemRosto, setFotoSemRosto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [captura, setCaptura] = useState<Captura | null>(null);
  const [erroCaptura, setErroCaptura] = useState<string | null>(null);
  const [armacaoFalhou, setArmacaoFalhou] = useState(false);
  const [status, setStatus] = useState("");
  /** Largura ÷ altura da fonte (vídeo ou foto) — o palco da página acompanha. */
  const [aspectoFonte, setAspectoFonte] = useState<number | null>(null);
  const [aspectoPalco, setAspectoPalco] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const primeiroFocoRef = useRef<HTMLButtonElement>(null);

  const montado = useRef(true);
  const geracao = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const motorRef = useRef<Motor | null>(null);
  const videoProntoRef = useRef(false);
  const armRef = useRef<ArmacaoPronta | null>(null);
  const faseRef = useRef<Fase>("inicio");
  const fotoRef = useRef<Foto | null>(null);
  const suavRef = useRef(new SuavizadorPose());
  const ultimaPoseRef = useRef<PoseRosto | null>(null);
  const ultimoRostoRef = useRef(0);
  const ultimoQuadroRef = useRef(-1);
  const ultimoProcessoRef = useRef(0);
  const semRostoRef = useRef(false);
  const capturaUrlRef = useRef<string | null>(null);
  const onTrocarRef = useRef(onTrocar);
  onTrocarRef.current = onTrocar;

  faseRef.current = fase;
  const ativo = fase === "camera" || fase === "foto";

  // ─── Lista e seleção ───────────────────────────────────────────────────────

  useEffect(() => {
    if (inicial && oculos.some((o) => o.slug === inicial)) setSlug(inicial);
    // Só reage à troca do `inicial` vindo de fora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  useEffect(() => {
    if (oculos.length && !oculos.some((o) => o.slug === slug)) setSlug(oculos[0].slug);
  }, [oculos, slug]);

  // Dependências pelo conteúdo, não pela identidade: a página pode recriar a
  // lista a cada render sem disparar recarga nem aviso de troca.
  // O aviso de troca só sai quando a seleção muda depois da montagem — abrir a
  // página não reescreve a URL por conta própria.
  const atualRef = useRef(atual);
  atualRef.current = atual;
  const slugAvisado = useRef(atual?.slug);
  useEffect(() => {
    const o = atualRef.current;
    if (!o || o.slug === slugAvisado.current) return;
    slugAvisado.current = o.slug;
    onTrocarRef.current?.(o);
  }, [atual?.slug]);

  const trocar = useCallback(
    (novo: string) => {
      setSlug(novo);
      setErroCaptura(null);
      const o = oculos.find((x) => x.slug === novo);
      if (o && (faseRef.current === "camera" || faseRef.current === "foto")) setStatus(`Provando ${nomeOculos(o)}`);
    },
    [oculos],
  );

  const passo = (delta: number) => {
    if (!oculos.length || !atual) return;
    const i = oculos.indexOf(atual);
    trocar(oculos[(i + delta + oculos.length) % oculos.length].slug);
  };

  // ─── Desenho da foto ───────────────────────────────────────────────────────

  const desenharFoto = useCallback(() => {
    const f = fotoRef.current;
    const c = canvasRef.current;
    if (!f || !c) return;
    if (c.width !== f.base.width || c.height !== f.base.height) {
      c.width = f.base.width;
      c.height = f.base.height;
      setAspectoFonte(c.width / c.height);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(f.base, 0, 0);
    const arm = armRef.current;
    if (f.pontos && arm) desenharOculos(ctx, arm, calcularPose(f.pontos, c.width, c.height), false, c.width);
  }, []);

  // Carrega a armação atual (e pré-carrega as vizinhas quando o provador está em uso).
  useEffect(() => {
    const o = atualRef.current;
    if (!o) {
      armRef.current = null;
      return;
    }
    let vivo = true;
    setArmacaoFalhou(false);
    carregarArmacao(o.tryonImageUrl, o.lensWidthMm, o.bridgeMm)
      .then((a) => {
        if (!vivo) return;
        armRef.current = a;
        if (faseRef.current === "foto") desenharFoto();
      })
      .catch(() => {
        if (!vivo) return;
        armRef.current = null;
        setArmacaoFalhou(true);
        if (faseRef.current === "foto") desenharFoto();
      });
    return () => {
      vivo = false;
    };
  }, [atual?.slug, atual?.tryonImageUrl, atual?.lensWidthMm, atual?.bridgeMm, desenharFoto]);

  useEffect(() => {
    const o = atualRef.current;
    if (!ativo || !o || oculos.length < 2) return;
    const i = oculos.indexOf(o);
    for (const v of [oculos[(i + 1) % oculos.length], oculos[(i - 1 + oculos.length) % oculos.length]]) {
      void carregarArmacao(v.tryonImageUrl, v.lensWidthMm, v.bridgeMm).catch(() => undefined);
    }
  }, [ativo, atual?.slug, oculos]);

  // ─── Câmera ────────────────────────────────────────────────────────────────

  const pararCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
    videoProntoRef.current = false;
    setMotorVideoPronto(false);
    ultimoQuadroRef.current = -1;
    ultimaPoseRef.current = null;
    suavRef.current.reiniciar();
  }, []);

  const limparCaptura = useCallback(() => {
    if (capturaUrlRef.current) URL.revokeObjectURL(capturaUrlRef.current);
    capturaUrlRef.current = null;
    setCaptura(null);
    setErroCaptura(null);
  }, []);

  const obterMotor = useCallback(async () => {
    if (motorRef.current) return motorRef.current;
    setCarregandoMotor(true);
    try {
      const m = await carregarMotor();
      motorRef.current = m;
      return m;
    } catch (erro) {
      if (montado.current) setSemSuporte(erro instanceof ProvadorSemSuporte);
      throw erro;
    } finally {
      if (montado.current) setCarregandoMotor(false);
    }
  }, []);

  const falhaMotor = useCallback(() => {
    geracao.current++;
    pararCamera();
    setFase("erro");
  }, [pararCamera]);

  const laco = useCallback(() => {
    rafRef.current = requestAnimationFrame(laco);
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
    // Mesmo quadro: nada a fazer. O limite de tempo cobre navegador que não
    // avança `currentTime` a cada quadro de um stream ao vivo.
    const agora = performance.now();
    if (v.currentTime === ultimoQuadroRef.current && agora - ultimoProcessoRef.current < 66) return;
    ultimoQuadroRef.current = v.currentTime;
    ultimoProcessoRef.current = agora;

    const w = v.videoWidth;
    const h = v.videoHeight;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      setAspectoFonte(w / h);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Selfie: vídeo espelhado. O óculos é desenhado depois, sem espelhar a imagem.
    ctx.setTransform(-1, 0, 0, 1, w, 0);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const motor = motorRef.current;
    if (!motor || !videoProntoRef.current) return;
    let r;
    try {
      r = motor.detectarVideo(v, agora);
    } catch {
      falhaMotor();
      return;
    }
    const arm = armRef.current;
    if (r) {
      const pose = suavRef.current.filtrar(calcularPose(r.pontos, w, h), agora / 1000);
      ultimaPoseRef.current = pose;
      ultimoRostoRef.current = agora;
      if (arm) desenharOculos(ctx, arm, pose, true, w);
      if (semRostoRef.current) {
        semRostoRef.current = false;
        setSemRosto(false);
      }
    } else {
      const passou = agora - ultimoRostoRef.current;
      const pose = ultimaPoseRef.current;
      if (pose && arm && passou < TOLERANCIA_SEM_ROSTO_MS) {
        desenharOculos(ctx, arm, pose, true, w, 1 - passou / TOLERANCIA_SEM_ROSTO_MS);
      } else if (pose) {
        // Quando o rosto voltar, o óculos nasce no lugar novo, sem deslizar.
        ultimaPoseRef.current = null;
        suavRef.current.reiniciar();
      }
      if (passou > AVISO_SEM_ROSTO_MS && !semRostoRef.current) {
        semRostoRef.current = true;
        setSemRosto(true);
        setStatus("Rosto não encontrado. Centralize o rosto e olhe para a câmera.");
      }
    }
  }, [falhaMotor]);

  const abrirCamera = useCallback(async () => {
    const minha = ++geracao.current;
    pararCamera();
    limparCaptura();
    fotoRef.current = null;
    setErroFoto(null);
    setFotoSemRosto(false);
    semRostoRef.current = false;
    setSemRosto(false);

    // Sem WebGL não adianta pedir a câmera: avisa antes da permissão.
    if (!navegadorSuportaProvador()) {
      setSemSuporte(true);
      setFase("erro");
      return;
    }
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      setMotivo(window.isSecureContext ? "sem-camera" : "inseguro");
      setFase("indisponivel");
      return;
    }
    setFase("preparando");
    // O modelo baixa enquanto a cliente responde ao pedido de permissão.
    const motorP = obterMotor();
    motorP.catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (e) {
      if (minha !== geracao.current) return;
      const r = classificarErroCamera(e);
      if (r === "negada") {
        setFase("negada");
      } else {
        setMotivo(r);
        setFase("indisponivel");
      }
      return;
    }
    if (minha !== geracao.current || !montado.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    v.muted = true;
    try {
      await v.play();
    } catch {
      /* vídeo mudo com playsInline não é bloqueado; o laço espera o primeiro quadro */
    }
    if (minha !== geracao.current) return;
    setFase("camera");
    setStatus("Câmera ligada. Olhe para a câmera.");
    rafRef.current = requestAnimationFrame(laco);

    try {
      const motor = await motorP;
      await motor.prepararModo("VIDEO");
      if (minha !== geracao.current) return;
      ultimoRostoRef.current = performance.now();
      videoProntoRef.current = true;
      setMotorVideoPronto(true);
    } catch {
      if (minha === geracao.current) falhaMotor();
    }
  }, [falhaMotor, laco, limparCaptura, obterMotor, pararCamera]);

  // ─── Foto ──────────────────────────────────────────────────────────────────

  const escolherFoto = () => inputRef.current?.click();

  const processarFoto = useCallback(
    async (arquivo: File) => {
      const minha = ++geracao.current;
      pararCamera();
      limparCaptura();
      semRostoRef.current = false;
      setSemRosto(false);
      setFase("foto");
      setErroFoto(null);
      setFotoSemRosto(false);
      setProcessandoFoto(true);
      fotoRef.current = null;
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);

      const url = URL.createObjectURL(arquivo);
      try {
        let img: HTMLImageElement;
        try {
          img = await decodificarImagem(url);
        } catch {
          if (minha === geracao.current) setErroFoto("Não conseguimos abrir essa imagem. Use uma foto em JPG ou PNG.");
          return;
        }
        if (minha !== geracao.current) return;
        const esc = Math.min(1, TAM_MAX_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
        const base = document.createElement("canvas");
        base.width = Math.max(1, Math.round(img.naturalWidth * esc));
        base.height = Math.max(1, Math.round(img.naturalHeight * esc));
        base.getContext("2d")?.drawImage(img, 0, 0, base.width, base.height);
        fotoRef.current = { base, pontos: null };
        desenharFoto();

        let motor: Motor;
        try {
          motor = await obterMotor();
        } catch {
          if (minha === geracao.current) setFase("erro");
          return;
        }
        let pontos: Foto["pontos"] = null;
        try {
          pontos = (await motor.detectarImagem(base))?.pontos ?? null;
        } catch {
          if (minha === geracao.current) setFase("erro");
          return;
        }
        if (minha !== geracao.current) return;
        fotoRef.current = { base, pontos };
        setFotoSemRosto(!pontos);
        setStatus(pontos ? "Foto pronta." : "Não encontramos um rosto nesta foto.");
        desenharFoto();
      } finally {
        URL.revokeObjectURL(url);
        if (minha === geracao.current && montado.current) setProcessandoFoto(false);
      }
    },
    [desenharFoto, limparCaptura, obterMotor, pararCamera],
  );

  const aoEscolherArquivo = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher a mesma foto de novo
    if (arquivo) void processarFoto(arquivo);
  };

  // ─── Voltar / fechar ───────────────────────────────────────────────────────

  const voltarAoInicio = useCallback(() => {
    geracao.current++;
    pararCamera();
    limparCaptura();
    fotoRef.current = null;
    setProcessandoFoto(false);
    setFotoSemRosto(false);
    setErroFoto(null);
    semRostoRef.current = false;
    setSemRosto(false);
    setFase("inicio");
    setAspectoFonte(null);
    setStatus("");
  }, [limparCaptura, pararCamera]);

  const fechar = useCallback(() => {
    voltarAoInicio();
    onFechar?.();
  }, [onFechar, voltarAoInicio]);

  // Desmontou: câmera desligada, sempre.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      geracao.current++;
      pararCamera();
      if (capturaUrlRef.current) URL.revokeObjectURL(capturaUrlRef.current);
    };
  }, [pararCamera]);

  // ─── Tirar foto ────────────────────────────────────────────────────────────

  const tirarFoto = () => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    setErroCaptura(null);
    const saida = document.createElement("canvas");
    saida.width = c.width;
    saida.height = c.height;
    const ctx = saida.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(c, 0, 0);
    assinar(ctx, saida.width, saida.height, atual);
    const nomeArquivo = `provador-sanre-${atual?.slug ?? "oculos"}.png`;
    try {
      saida.toBlob((blob) => {
        if (!blob || !montado.current) {
          if (!blob) setErroCaptura("Não foi possível gerar a foto. Tente de novo.");
          return;
        }
        const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
        let compartilhavel = false;
        try {
          compartilhavel = typeof navigator.share === "function" && !!navigator.canShare?.({ files: [arquivo] });
        } catch {
          compartilhavel = false;
        }
        if (capturaUrlRef.current) URL.revokeObjectURL(capturaUrlRef.current);
        const url = URL.createObjectURL(blob);
        capturaUrlRef.current = url;
        setCaptura({ url, arquivo, compartilhavel });
        setStatus("Foto pronta. Baixe ou compartilhe.");
      }, "image/png");
    } catch {
      // Imagem da armação de outro domínio sem CORS "suja" o canvas.
      setErroCaptura("Esta armação não permite salvar a foto. Use o print da tela.");
    }
  };

  const compartilhar = async () => {
    if (!captura) return;
    try {
      await navigator.share({
        files: [captura.arquivo],
        title: "Provador virtual Óticas Sanrê",
        text: nomeOculos(atual),
      });
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setErroCaptura("Não foi possível compartilhar. Use o botão Baixar foto.");
      }
    }
  };

  // ─── Modal: foco preso, Esc fecha, página sem rolagem ─────────────────────

  const escRef = useRef<() => void>(() => undefined);
  escRef.current = () => {
    if (captura) limparCaptura();
    else if (modal) fechar();
  };

  useEffect(() => {
    if (!modal) return;
    const anterior = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflowAntes = html.style.overflow;
    html.style.overflow = "hidden";
    const id = requestAnimationFrame(() => (primeiroFocoRef.current ?? dialogoRef.current)?.focus());
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        escRef.current();
      } else if (e.key === "Tab") {
        prenderFoco(e, dialogoRef.current);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", aoTeclar);
      html.style.overflow = overflowAntes;
      anterior?.focus?.();
    };
  }, [modal]);

  // Na página, Esc só fecha a prévia da foto tirada.
  useEffect(() => {
    if (modal || !captura) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") limparCaptura();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [modal, captura, limparCaptura]);

  // Proporção do palco na tela, para decidir entre preencher e caber.
  useEffect(() => {
    const el = palcoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (height > 0) setAspectoPalco(Math.round((width / height) * 100) / 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Peças da interface ────────────────────────────────────────────────────

  const botaoPalco =
    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap bg-sr-ink/75 px-3.5 font-label text-[0.66rem] font-medium uppercase tracking-[0.16em] text-sr-paper backdrop-blur-sm transition-colors hover:bg-sr-ink";

  /** Rótulo curto no celular, completo a partir de 640 px. */
  const rotulo = (curto: string, longo: string) => (
    <>
      <span className="sm:hidden">{curto}</span>
      <span className="hidden sm:inline">{longo}</span>
    </>
  );

  /*
   * Na página, o palco ativo toma a proporção da fonte (entre 3:4 e 4:3): uma
   * webcam deitada num palco em pé cortaria as laterais — e o óculos junto.
   */
  const estiloPalco =
    !modal && ativo && aspectoFonte
      ? { aspectRatio: String(Math.min(4 / 3, Math.max(3 / 4, aspectoFonte))) }
      : undefined;

  const aviso = (titulo: string, texto: string, botoes: ReactNode, carregando = false) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      {carregando && <LoaderCircle className="h-6 w-6 animate-spin text-sr-gold motion-reduce:animate-none" aria-hidden="true" />}
      <p className="font-display text-xl font-light text-sr-paper sm:text-2xl">{titulo}</p>
      <p className="max-w-md text-[0.95rem] text-sr-paper/80">{texto}</p>
      {botoes && <div className="mt-2 flex flex-wrap justify-center gap-3">{botoes}</div>}
    </div>
  );

  const botaoFoto = (rotulo = "Usar uma foto") => (
    <button type="button" className="btn-light-line" onClick={escolherFoto}>
      <ImageUp className="h-4 w-4" aria-hidden="true" />
      {rotulo}
    </button>
  );

  const pilula = (texto: string, carregando = false) => (
    <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4" aria-hidden="true">
      <p className="inline-flex items-center gap-2 bg-sr-ink/80 px-4 py-2 text-sm text-sr-paper backdrop-blur-sm">
        {carregando && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        {texto}
      </p>
    </div>
  );

  const nome = nomeOculos(atual);

  // Preencher o palco corta a fonte. Até 30 % de corte, tudo bem (o rosto fica
  // no meio); acima disso — webcam deitada num celular em pé — a armação
  // sairia cortada, então a imagem inteira cabe com faixas pretas.
  const corte =
    aspectoPalco && aspectoFonte ? 1 - Math.min(aspectoPalco / aspectoFonte, aspectoFonte / aspectoPalco) : 0;
  const encaixe = fase === "foto" || corte > 0.3 ? "object-contain" : "object-cover";

  const palco = (
    <div
      ref={palcoRef}
      className={cn(
        "relative isolate overflow-hidden bg-sr-ink text-sr-paper",
        modal ? "h-full w-full" : "aspect-[3/4] w-full sm:aspect-[4/3]",
      )}
      style={estiloPalco}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
      />
      <canvas
        ref={canvasRef}
        hidden={!ativo}
        role="img"
        aria-label={nome ? `Prévia do provador com ${nome}` : "Prévia do provador"}
        className={cn("absolute inset-0 h-full w-full", encaixe)}
      />

      {fase === "inicio" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 py-6 text-center sm:gap-4 sm:px-10">
          {atual && (
            <img
              src={atual.tryonImageUrl}
              alt=""
              className="mb-1 h-auto max-h-[22%] w-[min(62%,24rem)] object-contain"
              decoding="async"
            />
          )}
          <p className="eyebrow-light">Provador virtual</p>
          <p className="display-md text-sr-paper">Abra a câmera para provar</p>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-sr-paper/80">
            A armação acompanha o seu rosto em tempo real.
            <br className="hidden sm:inline" /> Troque de modelo sem fechar a câmera, ou use uma foto de frente.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <button ref={primeiroFocoRef} type="button" className="btn-gold" onClick={abrirCamera}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Abrir câmera
            </button>
            {botaoFoto()}
          </div>
          <p className="mt-1 flex max-w-md items-start gap-2 text-left text-[0.8rem] leading-snug text-sr-paper/70">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sr-gold" aria-hidden="true" />
            {PRIVACIDADE}
          </p>
        </div>
      )}

      {fase === "preparando" &&
        aviso(
          "Abrindo a câmera",
          "Se o navegador perguntar, permita o uso da câmera. " + PRIVACIDADE,
          null,
          true,
        )}

      {fase === "negada" &&
        aviso(
          "A câmera está bloqueada",
          "Para provar ao vivo, libere a câmera para este site nas permissões do navegador (no ícone ao lado do endereço) e tente de novo. Se preferir, use uma foto.",
          <>
            <button type="button" className="btn-gold" onClick={abrirCamera}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Tentar de novo
            </button>
            {botaoFoto()}
          </>,
        )}

      {fase === "indisponivel" &&
        aviso(
          motivo === "em-uso"
            ? "A câmera está em uso"
            : motivo === "inseguro"
              ? "Câmera indisponível nesta conexão"
              : "Não encontramos uma câmera",
          motivo === "em-uso"
            ? "Outro aplicativo ou aba está usando a câmera. Feche-o e tente de novo, ou use uma foto de frente."
            : motivo === "inseguro"
              ? "O navegador só libera a câmera em conexão segura (https). Use uma foto de frente — ela também é processada só no seu aparelho."
              : "Este aparelho não tem câmera disponível. Use uma foto de frente — ela também é processada só no seu aparelho.",
          <>
            {motivo === "em-uso" && (
              <button type="button" className="btn-gold" onClick={abrirCamera}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                Tentar de novo
              </button>
            )}
            {botaoFoto()}
          </>,
        )}

      {fase === "erro" &&
        (semSuporte
          ? aviso(
              "Este navegador não roda o provador",
              "O provador usa a aceleração gráfica do aparelho (WebGL), que está desligada ou indisponível neste navegador. Tente pelo Chrome, Safari, Edge ou Firefox atualizados.",
              <button type="button" className="btn-light" onClick={voltarAoInicio}>
                Voltar
              </button>,
            )
          : aviso(
              "O provador não carregou",
              "Não foi possível iniciar o reconhecimento do rosto neste navegador. Confira a conexão e tente de novo; se continuar, atualize o navegador.",
              <button type="button" className="btn-light" onClick={voltarAoInicio}>
                Tentar de novo
              </button>,
            ))}

      {/* Barra superior do palco */}
      {(ativo || modal) && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {fase === "camera" && (
              <button type="button" className={botaoPalco} onClick={escolherFoto} aria-label="Usar uma foto">
                <ImageUp className="h-4 w-4" aria-hidden="true" />
                {rotulo("Foto", "Usar uma foto")}
              </button>
            )}
            {fase === "foto" && (
              <>
                <button type="button" className={botaoPalco} onClick={abrirCamera} aria-label="Voltar para a câmera">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Câmera
                </button>
                <button type="button" className={botaoPalco} onClick={escolherFoto} aria-label="Escolher outra foto">
                  <ImageUp className="h-4 w-4" aria-hidden="true" />
                  {rotulo("Outra", "Outra foto")}
                </button>
              </>
            )}
          </div>
          {modal ? (
            <button type="button" className={botaoPalco} onClick={fechar} aria-label="Fechar o provador">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          ) : (
            ativo && (
              <button
                type="button"
                className={botaoPalco}
                onClick={voltarAoInicio}
                aria-label={fase === "camera" ? "Desligar câmera" : "Fechar foto"}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {fase === "camera" ? rotulo("Desligar", "Desligar câmera") : rotulo("Fechar", "Fechar foto")}
              </button>
            )
          )}
        </div>
      )}

      {fase === "camera" && (carregandoMotor || !motorVideoPronto) && pilula("Carregando o provador", true)}
      {fase === "foto" && processandoFoto && pilula("Procurando o rosto na foto", true)}
      {ativo && armacaoFalhou && pilula("A imagem desta armação não carregou. Escolha outra.")}

      {fase === "camera" && semRosto && motorVideoPronto && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="aspect-[3/4] h-[62%] rounded-[50%] border border-dashed border-sr-paper/50" />
          <p className="absolute bottom-24 left-1/2 w-max max-w-[90%] -translate-x-1/2 bg-sr-ink/80 px-4 py-2 text-center text-sm text-sr-paper">
            Centralize o rosto e olhe para a câmera
          </p>
        </div>
      )}

      {fase === "foto" && !processandoFoto && (fotoSemRosto || erroFoto) && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 bg-sr-ink/85 px-5 py-5 text-center">
          <p className="max-w-md text-[0.95rem] text-sr-paper">
            {erroFoto ??
              "Não encontramos um rosto nesta foto. Use uma foto de frente, com o rosto inteiro visível e boa luz."}
          </p>
          <button type="button" className="btn-light" onClick={escolherFoto}>
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            Escolher outra foto
          </button>
        </div>
      )}

      {ativo && !captura && !(fase === "foto" && (fotoSemRosto || erroFoto || processandoFoto)) && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4 sm:p-6">
          {erroCaptura && <p className="bg-sr-ink/85 px-3 py-1.5 text-center text-sm text-sr-paper">{erroCaptura}</p>}
          <button type="button" className="btn-light" onClick={tirarFoto} disabled={fase === "camera" && !motorVideoPronto}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {fase === "camera" ? "Tirar foto" : "Salvar imagem"}
          </button>
        </div>
      )}

      {captura && (
        <div
          className="absolute inset-0 z-20 flex flex-col bg-sr-ink"
          role="group"
          aria-label="Foto tirada no provador"
        >
          <div className="flex justify-end p-3 sm:p-4">
            <button type="button" className={botaoPalco} onClick={limparCaptura} aria-label="Voltar ao provador">
              <X className="h-4 w-4" aria-hidden="true" />
              Voltar
            </button>
          </div>
          <div className="relative min-h-0 flex-1 px-4 sm:px-6">
            <img src={captura.url} alt={`Foto no provador com ${nome}`} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 p-3 sm:gap-3 sm:p-4">
            {erroCaptura && <p className="w-full text-center text-sm text-sr-paper">{erroCaptura}</p>}
            <a href={captura.url} download={captura.arquivo.name} className="btn-gold">
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar foto
            </a>
            {captura.compartilhavel && (
              <button type="button" className="btn-light-line" onClick={compartilhar}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Compartilhar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const escuro = modal;

  const ficha = atual ? (
    <div className="min-w-0">
      {atual.brand && <p className={escuro ? "eyebrow-light" : "label-marca"}>{atual.brand}</p>}
      <p
        className={cn(
          "mt-1.5 font-display text-lg font-light leading-snug sm:text-xl",
          escuro ? "text-sr-paper" : "text-sr-ink",
        )}
      >
        {atual.title}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={cn("dado text-base", escuro ? "text-sr-paper" : "text-sr-ink")}>{precoBR(atual.price)}</span>
        {medidaArmacao(atual) && (
          <span className={cn("dado text-sm", escuro ? "text-sr-paper/70" : "text-sr-ink-soft")}>
            Medidas {medidaArmacao(atual)}
          </span>
        )}
      </p>
    </div>
  ) : (
    <p className={escuro ? "text-sr-paper/80" : "text-sr-ink-soft"}>Nenhuma armação nesta seleção.</p>
  );

  const botaoSeta = cn(
    "inline-flex h-11 w-11 items-center justify-center border transition-colors",
    escuro ? "border-white/25 text-sr-paper hover:bg-white/10" : "border-sr-line text-sr-ink hover:border-sr-ink",
  );

  const setas = oculos.length > 1 && (
    <div className="flex shrink-0 gap-1">
      <button type="button" className={botaoSeta} onClick={() => passo(-1)} aria-label="Armação anterior">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={botaoSeta} onClick={() => passo(1)} aria-label="Próxima armação">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );

  const miniaturas = oculos.length > 1 && (
    <div className="min-w-0">
      <p className={escuro ? "eyebrow-light" : "eyebrow"}>
        {oculos.length} armações no provador
      </p>
      <ul
        className={cn(
          "mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none",
          "lg:grid lg:grid-cols-3 lg:overflow-x-visible",
          !escuro && "lg:max-h-[27rem] lg:overflow-y-auto",
        )}
      >
        {oculos.map((o) => {
          const sel = o.slug === atual?.slug;
          return (
            <li key={o.slug} className="w-24 shrink-0 lg:w-auto">
              <button
                type="button"
                onClick={() => trocar(o.slug)}
                aria-pressed={sel}
                aria-label={`Provar ${nomeOculos(o)}`}
                title={nomeOculos(o)}
                className={cn(
                  "block w-full border text-left transition-opacity",
                  sel
                    ? escuro
                      ? "border-sr-gold"
                      : "border-sr-ink"
                    : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <span className="pedestal aspect-vitrine block">
                  <img
                    className="produto absolute inset-0 h-full w-full p-2"
                    src={o.mainImage || o.tryonImageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span
                  className={cn(
                    "block truncate px-1 pb-1 pt-1.5 font-label text-[0.6rem] font-medium uppercase tracking-[0.16em]",
                    escuro ? "text-sr-paper/80" : "text-sr-nude-600",
                  )}
                >
                  {o.brand ?? o.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const extras = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={aoEscolherArquivo}
      />
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </>
  );

  if (!modal) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0">
          {palco}
          {extras}
        </div>
        <aside className="flex min-w-0 flex-col gap-6" aria-label="Armação no provador">
          <div className="flex items-start justify-between gap-4 border-b border-sr-line pb-5">
            {ficha}
            {setas}
          </div>
          {atual && acoes?.(atual)}
          {filtros}
          {miniaturas}
        </aside>
      </div>
    );
  }

  return createPortal(
    <div
      ref={dialogoRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      tabIndex={-1}
      className="fixed inset-0 z-[120] flex flex-col bg-sr-ink text-sr-paper outline-none lg:flex-row"
    >
      <div className="relative min-h-0 flex-1">{palco}</div>
      <aside className="flex max-h-[42vh] shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 px-4 py-4 sm:px-6 lg:max-h-none lg:w-[24rem] lg:gap-6 lg:border-l lg:border-t-0 lg:px-8 lg:py-8">
        <h2 id={idTitulo} className="eyebrow-light">
          Provador virtual
        </h2>
        <div className="flex items-start justify-between gap-4">
          {ficha}
          {setas}
        </div>
        {atual && acoes?.(atual)}
        {miniaturas}
      </aside>
      {extras}
    </div>,
    document.body,
  );
}
