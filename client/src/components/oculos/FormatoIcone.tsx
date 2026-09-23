import type { ReactElement } from "react";

/**
 * Desenho de linha de cada formato de armação (vista frontal).
 * Usado no filtro da vitrine, no menu e no guia de formato de rosto — a cliente
 * reconhece "gatinho" ou "browline" pelo desenho mais rápido do que pelo nome.
 */

const LENTE: Record<string, ReactElement> = {
  redondo: <circle cx="16" cy="12" r="9" />,
  oval: <ellipse cx="16" cy="12" rx="10.5" ry="7.5" />,
  quadrado: <rect x="6" y="3.5" width="19" height="17" rx="2.5" />,
  retangular: <rect x="4.5" y="6.5" width="21.5" height="11" rx="2" />,
  aviador: <path d="M5.5 5.5h20c1.6 0 2.3 1 2 2.6-.9 5.4-4.2 11.4-11.3 11.4C9.6 19.5 5.2 14 4.3 8.3 4 6.6 4.3 5.5 5.5 5.5z" />,
  gatinho: <path d="M3 5.2c6.8-.8 15.4-.4 23.2 1.6.6 4.6-1 11.2-9.4 11.9C9.6 19.3 6 14.5 5 10.2 4.6 8.5 3.8 6.8 3 5.2z" />,
  hexagonal: <path d="M10.5 3.5h11l5 8.5-5 8.5h-11l-5-8.5z" />,
  geometrico: <path d="M11 3.5h10l5 5v7l-5 5H11l-5-5v-7z" />,
  browline: (
    <>
      <path d="M5 8.5c0-2.3 1.3-3.5 3.6-3.5h14.2c2.2 0 3.4 1.2 3.4 3.3" strokeWidth="3.2" />
      <path d="M5 8.5c.2 6 4 10.5 10.3 10.5 6.8 0 10.6-4.8 10.9-10.7" />
    </>
  ),
};

const PONTE = <path d="M25.2 10.5c2.2-2 11.4-2 13.6 0" />;

function Peca({ formato }: { formato: string }) {
  if (formato === "mascara") {
    return (
      <path d="M3.5 7.5C14 4 50 4 60.5 7.5c.5 6.6-2.4 12-10.4 12.2-7 .2-10.8-2.4-13.3-5.9-1.6-2.2-3.9-2.2-5.6 0-2.6 3.5-6.4 6.1-13.3 5.9C9.9 19.5 3 14.2 3.5 7.5z" />
    );
  }
  if (formato === "esportivo") {
    return (
      <>
        <path d="M2.5 9C10 4.5 54 4.5 61.5 9c-1 5.8-4.5 9.6-11.5 9.9-6.4.3-10.4-2.2-13-5.2-2.2-2.4-3.8-2.4-6 0-2.6 3-6.6 5.5-13 5.2C11 18.6 3.6 14.8 2.5 9z" />
        <path d="M2.5 9l-1.8-1.6M61.5 9l1.8-1.6" />
      </>
    );
  }
  const lente = LENTE[formato] ?? LENTE.retangular;
  return (
    <>
      {lente}
      <g transform="translate(64 0) scale(-1 1)">{lente}</g>
      {PONTE}
    </>
  );
}

export default function FormatoIcone({
  formato,
  className = "h-5 w-14",
  titulo,
}: {
  formato: string;
  className?: string;
  titulo?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <Peca formato={formato} />
    </svg>
  );
}
