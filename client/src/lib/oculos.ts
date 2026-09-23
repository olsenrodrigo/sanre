/**
 * Vocabulário do catálogo (fonte: shared/oculos.ts) + tipos da vitrine.
 */
export * from "@shared/oculos";

/** Produto como a vitrine recebe da API. */
export interface ProdutoVitrine {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  modelCode?: string | null;
  price: string;
  compareAtPrice?: string | null;
  categoryId?: number | null;
  frameShape?: string | null;
  frameMaterial?: string | null;
  frameColor?: string | null;
  frameColorHex?: string | null;
  lensColor?: string | null;
  lensPolarized?: boolean;
  lensMirrored?: boolean;
  lensGradient?: boolean;
  lensPhotochromic?: boolean;
  acceptsRx?: boolean;
  audience?: string | null;
  lensWidthMm?: number | null;
  bridgeMm?: number | null;
  templeMm?: number | null;
  lensHeightMm?: number | null;
  caNumber?: string | null;
  tryonImageUrl?: string | null;
  stockQuantity?: number;
  continueSellingOutOfStock?: boolean;
  featured?: boolean;
  mainImage?: string | null;
  images?: { url: string; altText?: string | null }[];
  unidades?: Record<string, number>;
  tags?: string | null;
}
