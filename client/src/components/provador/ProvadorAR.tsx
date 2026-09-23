/**
 * Provador virtual de óculos em realidade aumentada (ver PLANO.md §Provador).
 *
 * Este arquivo é leve de propósito: só os tipos e um invólucro `lazy`. A
 * interface (ProvadorConteudo) vira um pedaço separado do bundle, e o MediaPipe
 * só é baixado quando a cliente abre a câmera ou escolhe uma foto — a página do
 * produto pode importar o ProvadorAR sem pagar por isso.
 */
import { lazy, Suspense, type ReactNode } from "react";

export interface OculosProvador {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  price: string;
  /** Vista FRONTAL do óculos, PNG com fundo transparente, de preferência no mesmo domínio. */
  tryonImageUrl: string;
  lensWidthMm?: number | null;
  bridgeMm?: number | null;
  templeMm?: number | null;
  frameShape?: string | null;
  mainImage?: string | null;
}

export interface ProvadorARProps {
  oculos: OculosProvador[];
  /** Slug do óculos que abre selecionado. */
  inicial?: string;
  /** "modal" dentro da página do produto; "pagina" em /provador. */
  modo?: "modal" | "pagina";
  onFechar?: () => void;
  /** Avisa a troca de armação (a página usa para atualizar a URL). */
  onTrocar?: (oculos: OculosProvador) => void;
  /** Ações do óculos atual (ex.: "Adicionar à sacola"), abaixo da ficha. */
  acoes?: (oculos: OculosProvador) => ReactNode;
  /** Filtros da lista, acima das miniaturas (só no modo página). */
  filtros?: ReactNode;
}

const Conteudo = lazy(() => import("./ProvadorConteudo"));

function Carregando({ modo }: { modo: "modal" | "pagina" }) {
  if (modo === "modal") {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-sr-ink text-sr-paper" role="status">
        <p className="eyebrow-light">Abrindo o provador</p>
      </div>
    );
  }
  return (
    <div className="flex aspect-[3/4] w-full items-center justify-center bg-sr-ink sm:aspect-[4/3]" role="status">
      <p className="eyebrow-light">Abrindo o provador</p>
    </div>
  );
}

export default function ProvadorAR(props: ProvadorARProps) {
  return (
    <Suspense fallback={<Carregando modo={props.modo ?? "pagina"} />}>
      <Conteudo {...props} />
    </Suspense>
  );
}
