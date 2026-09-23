import { useState } from "react";
import { Link } from "wouter";
import { ScanFace } from "lucide-react";
import { precoBR, parcela } from "@/lib/marca";
import { descontoPix } from "@shared/pagamento";
import { FORMATOS, MATERIAIS, rotulo, type ProdutoVitrine } from "@/lib/oculos";
import { UNIDADES } from "@shared/unidades";

export type ProdutoCard = ProdutoVitrine & { status?: string };

interface ProductCardProps {
  product: ProdutoCard;
  /** Prioriza o carregamento das primeiras imagens da grade (LCP). */
  priority?: boolean;
}

/** Foto com modelo (ou ambiente) ocupa o pedestal inteiro; foto de fabricante fica "exposta". */
export function ehFotoEditorial(url: string): boolean {
  return /-(modelo|look|ambiente)\b/i.test(url);
}

/** Tira a marca do começo do título: "Ray-Ban Aviator Classic" → "Aviator Classic". */
export function nomeSemMarca(titulo: string, marca?: string | null): string {
  if (marca && titulo.toLowerCase().startsWith(marca.toLowerCase())) {
    return titulo.slice(marca.length).replace(/^[\s—–-]+/, "");
  }
  return titulo;
}

/**
 * Card de produto — etiqueta de galeria.
 *
 * O óculos fica exposto num pedestal névoa (a foto de fabricante em fundo
 * branco se funde por `multiply`, como se estivesse no cubo de acrílico da
 * loja). No hover entra a segunda foto — de preferência no rosto. Embaixo, a
 * ficha como etiqueta de museu: MARCA, modelo, formato e material, preço.
 */
export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const [hover, setHover] = useState(false);

  const capa = product.mainImage ?? product.images?.[0]?.url ?? null;
  const segunda = (product.images ?? []).map(i => i.url).find(u => u !== capa) ?? null;
  const atual = hover && segunda ? segunda : capa;
  const editorial = atual ? ehFotoEditorial(atual) : false;

  const preco = Number(product.price);
  const temDesconto = !!product.compareAtPrice && Number(product.compareAtPrice) > preco;
  const descontoPct = temDesconto ? Math.round((1 - preco / Number(product.compareAtPrice)) * 100) : 0;
  const esgotado = (product.stockQuantity ?? 1) <= 0 && !product.continueSellingOutOfStock;

  const ficha = [rotulo(FORMATOS, product.frameShape), rotulo(MATERIAIS, product.frameMaterial), product.frameColor]
    .filter(Boolean)
    .join(" · ");

  const unidades = UNIDADES.filter(u => (product.unidades?.[u.slug] ?? 0) > 0);

  const selos: string[] = [];
  if (product.lensPolarized) selos.push("Polarizado");
  if (product.caNumber) selos.push(`CA ${product.caNumber}`);

  return (
    <article
      className="group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={`/loja/produto/${product.slug}`} className="block no-underline" aria-label={`${product.brand ?? ""} ${product.title}`.trim()}>
        <div className="pedestal aspect-vitrine">
          {atual ? (
            <img
              key={atual}
              src={atual}
              alt={product.title}
              width={800}
              height={640}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              className={
                editorial
                  ? "h-full w-full object-cover"
                  : "produto h-full w-full p-[9%] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sr-nude-300">Sem foto</div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {temDesconto && (
              <span className="nav-label bg-sr-ink px-2 py-1 text-[0.62rem] text-sr-paper">−{descontoPct}%</span>
            )}
            {esgotado && (
              <span className="nav-label bg-sr-paper px-2 py-1 text-[0.62rem] text-sr-alert">Esgotado</span>
            )}
          </div>
          {product.tryonImageUrl && (
            <span
              className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 bg-sr-paper/90 px-2 py-1 text-[0.62rem] nav-label text-sr-ink"
              title="Dá para experimentar no provador virtual"
            >
              <ScanFace size={12} className="text-sr-gold-700" aria-hidden />
              Provador
            </span>
          )}
        </div>

        <div className="px-1 pt-4">
          <p className="label-marca">{product.brand}</p>
          <h3 className="mt-1.5 font-sans text-[0.98rem] font-normal leading-snug tracking-normal text-sr-ink">
            {nomeSemMarca(product.title, product.brand)}
          </h3>
          {ficha && <p className="mt-1 text-[0.82rem] text-sr-ink-soft">{ficha}</p>}

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
            {temDesconto && (
              <span className="text-[0.82rem] text-sr-nude-600 line-through">{precoBR(product.compareAtPrice!)}</span>
            )}
            <span className="font-label text-[0.95rem] font-medium text-sr-ink">{precoBR(preco)}</span>
          </div>
          <p className="mt-0.5 text-[0.78rem] text-sr-ink-soft">
            10x de {parcela(preco)} · {precoBR(preco - descontoPix(preco))} no PIX
          </p>

          {(unidades.length > 0 || selos.length > 0) && (
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.74rem] text-sr-ink-soft">
              {unidades.map(u => (
                <span key={u.slug} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sr-ok" aria-hidden />
                  {u.cidade}
                </span>
              ))}
              {selos.map(s => (
                <span key={s} className="text-sr-nude-600">
                  {s}
                </span>
              ))}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
