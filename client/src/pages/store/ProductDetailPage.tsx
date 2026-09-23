import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useParams, Link } from "wouter";
import { ScanFace, Store, ShieldCheck, Receipt, MessageCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard, { type ProdutoCard, ehFotoEditorial, nomeSemMarca } from "@/components/store/ProductCard";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { trackViewItem, trackAddToCart, useAnalyticsReady } from "@/lib/analytics";
import ReviewsSection from "@/components/store/ReviewsSection";
import BundleOffer, { type ApiBundle } from "@/components/store/BundleOffer";
import FluxoGrau from "@/components/grau/FluxoGrau";
import ReservaDialog from "@/components/reserva/ReservaDialog";
import { definirContextoAssistente, abrirAssistente } from "@/components/assistente/contexto";
import { corHex, precoBR, parcela, whatsappCom } from "@/lib/marca";
import { descontoPix } from "@shared/pagamento";
import { UNIDADES } from "@shared/unidades";
import { aplicarSeo, aplicarJsonLdProduto, removerJsonLdProduto } from "@/lib/seo";
import { FORMATOS, MATERIAIS, PUBLICOS, rotulo, slugificar, medidaArmacao, type ProdutoVitrine } from "@/lib/oculos";

// O provador (MediaPipe) só é baixado quando a cliente pede para experimentar.
const ProvadorAR = lazy(() => import("@/components/provador/ProvadorAR"));

interface ProductImage { id: number; url: string; altText?: string | null; isMain: boolean; position: number }
interface Variant {
  id: number; sku?: string | null; price: string; compareAtPrice?: string | null;
  stockQuantity: number; option1?: string | null; option2?: string | null;
  imageUrl?: string | null; active: boolean;
}
type Product = ProdutoVitrine & {
  description?: string | null;
  sku?: string | null;
  status: string;
  uvProtection?: string | null;
  safetyNorms?: string | null;
  images: ProductImage[];
  variants: Variant[];
  categoria?: { slug: string; name: string } | null;
};

/** Linha da ficha técnica (etiqueta de museu). */
function Linha({ rotulo: r, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-4 border-b border-sr-line py-3 text-[0.93rem] sm:grid-cols-[11rem_1fr]">
      <dt className="text-sr-ink-soft">{r}</dt>
      <dd className="text-sr-ink">{children}</dd>
    </div>
  );
}

/** Desenho das três medidas gravadas na haste. */
function DiagramaMedidas({ lente, ponte, haste }: { lente: number; ponte: number; haste?: number | null }) {
  return (
    <figure className="mt-5 border border-sr-line bg-white p-5">
      <svg viewBox="0 0 320 110" className="w-full max-w-sm text-sr-ink" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <rect x="20" y="22" width="110" height="62" rx="18" />
        <rect x="190" y="22" width="110" height="62" rx="18" />
        <path d="M130 44c12-12 48-12 60 0" />
        <g stroke="#998f7c" strokeDasharray="3 3">
          <path d="M20 100h110M20 96v8M130 96v8" />
          <path d="M136 12h48M136 8v8M184 8v8" />
        </g>
        <g fill="#6f6757" stroke="none" fontFamily="Montserrat, sans-serif" fontSize="11">
          <text x="75" y="99" textAnchor="middle" dy="-6">{lente} mm</text>
          <text x="160" y="9" textAnchor="middle">{ponte} mm</text>
          {haste ? <text x="245" y="104" textAnchor="middle">haste {haste} mm</text> : null}
        </g>
      </svg>
      <figcaption className="mt-3 text-[0.85rem] text-sr-ink-soft">
        Largura da lente · ponte · haste. Compare com os números gravados na haste do óculos que você já usa.{" "}
        <Link href="/tamanho-do-oculos" className="underline underline-offset-4">Como medir</Link>
      </figcaption>
    </figure>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [varianteId, setVarianteId] = useState<number | null>(null);
  const [foto, setFoto] = useState(0);
  const [bundles, setBundles] = useState<ApiBundle[]>([]);
  const [relacionados, setRelacionados] = useState<ProdutoCard[]>([]);
  const [provadorAberto, setProvadorAberto] = useState(false);
  const [grauAberto, setGrauAberto] = useState(false);
  const [reservaAberta, setReservaAberta] = useState(false);
  const { addToCart, loading: cartLoading } = useCart();
  const { toast } = useToast();
  const analyticsOn = useAnalyticsReady();

  useEffect(() => {
    setLoading(true);
    setFoto(0);
    fetch(`/api/store/products/${slug}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: Product | null) => {
        setProduct(data);
        if (!data) return;
        const disponivel = data.variants?.find(v => v.active && v.stockQuantity > 0) ?? data.variants?.[0];
        setVarianteId(disponivel?.id ?? null);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));

    fetch(`/api/store/products/${slug}/related`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setBundles(d?.bundles ?? []);
        setRelacionados(d?.related ?? []);
      })
      .catch(() => {});
  }, [slug]);

  // SEO + JSON-LD Product (o servidor entrega o mesmo no HTML inicial)
  useEffect(() => {
    if (!product) return;
    const caminho = `/loja/produto/${product.slug}`;
    const imagens = product.images.map(i => i.url);
    aplicarSeo({
      titulo: `${product.title}${product.frameColor ? ` ${product.frameColor}` : ""}`,
      descricao: (product.description || product.title).slice(0, 300),
      caminho,
      imagem: imagens[0] ?? null,
      tipo: "product",
    });
    aplicarJsonLdProduto({
      nome: product.title,
      descricao: product.description,
      sku: product.sku,
      imagens,
      preco: product.price,
      disponivel: (product.stockQuantity ?? 0) > 0 || !!product.continueSellingOutOfStock,
      caminho,
      marca: product.brand ?? undefined,
    });
    definirContextoAssistente({
      produto: {
        slug: product.slug,
        titulo: product.title,
        marca: product.brand,
        preco: product.price,
        imagem: product.mainImage ?? imagens[0] ?? null,
      },
    });
    return () => {
      removerJsonLdProduto();
      definirContextoAssistente({ produto: null });
    };
  }, [product]);

  useEffect(() => {
    if (product && analyticsOn) {
      trackViewItem({ slug: product.slug, name: product.title, price: Number(product.price) });
    }
  }, [product, analyticsOn]);

  const ativos = useMemo(() => product?.variants?.filter(v => v.active) ?? [], [product]);
  const variante = ativos.find(v => v.id === varianteId) ?? ativos[0] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="bleed grid gap-10 py-10 lg:grid-cols-[1.25fr_1fr]">
          <div className="pedestal aspect-vitrine animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse bg-sr-nude-100" />
            <div className="h-9 w-3/4 animate-pulse bg-sr-nude-100" />
            <div className="h-24 animate-pulse bg-sr-nude-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="bleed py-28 text-center">
          <p className="eyebrow">Página não encontrada</p>
          <h1 className="display-lg mt-4">Este óculos não está mais no site</h1>
          <p className="mx-auto mt-4 max-w-md text-sr-ink-soft">
            Pode ter saído do catálogo ou mudado de endereço. Veja os modelos disponíveis agora.
          </p>
          <Link href="/loja" className="btn-ink mt-8 no-underline">
            Ver os óculos
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const imagens = [...product.images].sort((a, b) => a.position - b.position);
  const fotoAtual = imagens[Math.min(foto, imagens.length - 1)];

  const preco = Number(variante?.price ?? product.price);
  const precoDe = variante?.compareAtPrice ?? product.compareAtPrice;
  const estoque = variante?.stockQuantity ?? product.stockQuantity ?? 0;
  const vendivel = estoque > 0 || !!product.continueSellingOutOfStock;
  const temDesconto = !!precoDe && Number(precoDe) > preco;
  const nome = nomeSemMarca(product.title, product.brand);
  const medida = medidaArmacao(product);
  const unidadesComSaldo = UNIDADES.filter(u => (product.unidades?.[u.slug] ?? 0) > 0);
  const lentes = [
    product.lensPolarized && "polarizada",
    product.lensMirrored && "espelhada",
    product.lensGradient && "degradê",
    product.lensPhotochromic && "fotossensível",
  ].filter(Boolean);
  const ehEpi = product.categoria?.slug === "epi" || !!product.caNumber;

  const produtoResumo = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    price: String(preco),
    mainImage: product.mainImage ?? imagens[0]?.url ?? null,
  };

  const adicionar = async () => {
    await addToCart(product.id, variante?.id ?? null, 1);
    trackAddToCart({ slug: product.slug, name: product.title, price: preco, quantity: 1 });
    toast({ title: "Adicionado à sacola", description: `${product.brand ?? ""} ${nome}`.trim() });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <div className="bleed pt-6">
          <nav aria-label="Trilha" className="text-[0.8rem] text-sr-ink-soft">
            <Link href="/" className="no-underline hover:text-sr-ink">Início</Link>
            <span className="mx-2 text-sr-nude-400">/</span>
            {product.categoria ? (
              <Link href={`/${product.categoria.slug}`} className="no-underline hover:text-sr-ink">
                {product.categoria.name}
              </Link>
            ) : (
              <Link href="/loja" className="no-underline hover:text-sr-ink">Óculos</Link>
            )}
            {product.brand && (
              <>
                <span className="mx-2 text-sr-nude-400">/</span>
                <Link href={`/marcas/${slugificar(product.brand)}`} className="no-underline hover:text-sr-ink">
                  {product.brand}
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="bleed grid gap-10 pb-16 pt-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:gap-16">
          {/* Galeria */}
          <section aria-label="Fotos">
            <div className="pedestal aspect-vitrine">
              {fotoAtual ? (
                <img
                  key={fotoAtual.url}
                  src={fotoAtual.url}
                  alt={fotoAtual.altText || `${product.title} — foto ${foto + 1}`}
                  width={1200}
                  height={960}
                  fetchPriority="high"
                  className={ehFotoEditorial(fotoAtual.url) ? "h-full w-full object-cover" : "produto h-full w-full p-[7%]"}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sr-nude-300">Sem foto</div>
              )}
              {product.tryonImageUrl && (
                <button
                  type="button"
                  onClick={() => setProvadorAberto(true)}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-sr-paper/95 px-4 py-2.5 nav-label text-sr-ink shadow-sm hover:bg-white"
                >
                  <ScanFace size={16} className="text-sr-gold-700" aria-hidden />
                  Experimentar no rosto
                </button>
              )}
            </div>
            {imagens.length > 1 && (
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {imagens.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setFoto(i)}
                    aria-label={`Ver foto ${i + 1}`}
                    aria-current={i === foto ? "true" : undefined}
                    className={`pedestal aspect-vitrine border ${i === foto ? "border-sr-ink" : "border-transparent hover:border-sr-nude-400"}`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      className={ehFotoEditorial(img.url) ? "h-full w-full object-cover" : "produto h-full w-full p-2"}
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Compra */}
          <section aria-label="Comprar" className="lg:sticky lg:top-[calc(var(--sr-header)+3rem)] lg:h-fit">
            {product.brand && (
              <Link href={`/marcas/${slugificar(product.brand)}`} className="label-marca no-underline hover:text-sr-nude-600">
                {product.brand}
              </Link>
            )}
            <h1 className="mt-3 font-display text-[1.9rem] font-light leading-tight md:text-[2.3rem]">{nome}</h1>
            <p className="mt-2 text-[0.92rem] text-sr-ink-soft dado">
              {[product.modelCode, product.frameColor, product.lensColor && `lente ${product.lensColor}`].filter(Boolean).join(" · ")}
            </p>

            <div className="mt-6 border-y border-sr-line py-5">
              <div className="flex flex-wrap items-baseline gap-3">
                {temDesconto && <span className="text-sr-nude-600 line-through">{precoBR(precoDe!)}</span>}
                <span className="font-display text-[1.75rem] font-normal">{precoBR(preco)}</span>
              </div>
              <p className="mt-1 text-[0.9rem] text-sr-ink-soft">
                em até 10x de {parcela(preco)} sem juros ou{" "}
                <strong className="font-medium text-sr-ink">{precoBR(preco - descontoPix(preco))} no PIX</strong>
              </p>
            </div>

            {ativos.length > 1 && (
              <div className="mt-6">
                <p className="nav-label">Cor</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ativos.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVarianteId(v.id)}
                      aria-pressed={v.id === variante?.id}
                      className={`flex items-center gap-2 border px-3 py-2 text-[0.85rem] ${v.id === variante?.id ? "border-sr-ink" : "border-sr-line bg-white"}`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: corHex(v.option2 ?? "") }} aria-hidden />
                      {v.option2 ?? v.option1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Disponibilidade por loja */}
            <div className="mt-6 space-y-1.5 text-[0.9rem]">
              {UNIDADES.map(u => {
                const qtd = product.unidades?.[u.slug] ?? 0;
                return (
                  <p key={u.slug} className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${qtd > 0 ? "bg-sr-ok" : "bg-sr-nude-300"}`} aria-hidden />
                    <span className="text-sr-ink">{u.cidade}</span>
                    <span className="text-sr-ink-soft">{qtd > 0 ? "— pronta entrega na loja" : "— sob consulta"}</span>
                  </p>
                );
              })}
            </div>

            <div className="mt-7 grid gap-2.5">
              <button onClick={adicionar} disabled={!vendivel || cartLoading} className="btn-ink w-full">
                {vendivel ? "Adicionar à sacola" : "Indisponível no site"}
              </button>
              {product.acceptsRx && (
                <button onClick={() => setGrauAberto(true)} className="btn-line w-full">
                  Comprar com lentes de grau
                </button>
              )}
              {product.tryonImageUrl && (
                <button onClick={() => setProvadorAberto(true)} className="btn-gold w-full">
                  <ScanFace size={17} aria-hidden />
                  Experimentar no provador virtual
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button onClick={() => setReservaAberta(true)} className="link-rule">
                Reservar para provar na loja
              </button>
              <button onClick={() => abrirAssistente(`Tenho uma dúvida sobre o ${product.title}.`)} className="link-rule">
                Tirar dúvida
              </button>
            </div>

            <ul className="mt-8 grid gap-3 border-t border-sr-line pt-6 text-[0.88rem] text-sr-ink-soft">
              <li className="flex gap-3"><Store size={17} className="mt-0.5 shrink-0 text-sr-nude-600" aria-hidden />Retirada grátis em Cravinhos ou Ribeirão Preto, ou entrega pelo correio.</li>
              <li className="flex gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-sr-nude-600" aria-hidden />Produto original, com nota fiscal e garantia do fabricante.</li>
              <li className="flex gap-3"><Receipt size={17} className="mt-0.5 shrink-0 text-sr-nude-600" aria-hidden />Ajuste de armação gratuito nas lojas.</li>
            </ul>
          </section>
        </div>

        {/* Ficha técnica + descrição */}
        <section className="border-t border-sr-line bg-white">
          <div className="bleed grid gap-12 py-16 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="eyebrow">Ficha técnica</p>
              <dl className="mt-5 border-t border-sr-line">
                {product.brand && <Linha rotulo="Marca">{product.brand}</Linha>}
                {product.modelCode && <Linha rotulo="Modelo"><span className="dado">{product.modelCode}</span></Linha>}
                {product.frameShape && <Linha rotulo="Formato">{rotulo(FORMATOS, product.frameShape)}</Linha>}
                {product.frameMaterial && <Linha rotulo="Material">{rotulo(MATERIAIS, product.frameMaterial)}</Linha>}
                {product.frameColor && <Linha rotulo="Cor da armação">{product.frameColor}</Linha>}
                {product.lensColor && (
                  <Linha rotulo="Lente">
                    {product.lensColor}
                    {lentes.length > 0 && <span className="text-sr-ink-soft"> · {lentes.join(", ")}</span>}
                  </Linha>
                )}
                {product.uvProtection && <Linha rotulo="Proteção">{product.uvProtection}</Linha>}
                {medida && <Linha rotulo="Medidas"><span className="dado">{medida}</span></Linha>}
                {product.lensHeightMm && <Linha rotulo="Altura da lente"><span className="dado">{product.lensHeightMm} mm</span></Linha>}
                {product.audience && <Linha rotulo="Para quem">{rotulo(PUBLICOS, product.audience)}</Linha>}
                <Linha rotulo="Lente de grau">{product.acceptsRx ? "Aceita — a consultora monta com a sua receita" : "Não indicado"}</Linha>
                {ehEpi && product.caNumber && <Linha rotulo="CA">{product.caNumber}</Linha>}
                {ehEpi && product.safetyNorms && <Linha rotulo="Norma">{product.safetyNorms}</Linha>}
              </dl>
              {product.lensWidthMm && product.bridgeMm && (
                <DiagramaMedidas lente={product.lensWidthMm} ponte={product.bridgeMm} haste={product.templeMm} />
              )}
            </div>
            <div>
              <p className="eyebrow">Sobre este modelo</p>
              <div className="mt-5 max-w-prose space-y-4 text-[1.02rem] leading-relaxed text-sr-ink">
                {(product.description ?? "").split(/\n{2,}/).filter(Boolean).map((par, i) => (
                  <p key={i}>{par}</p>
                ))}
              </div>
              {product.acceptsRx && (
                <div className="mt-10 border-l-2 border-sr-gold pl-5">
                  <p className="nav-label">Com lentes de grau</p>
                  <p className="mt-2 text-[0.95rem] text-sr-ink-soft">
                    Você escolhe a armação e envia a receita. A consultora confere, indica as lentes e manda o orçamento
                    pelo WhatsApp — nada é cobrado antes da sua confirmação.
                  </p>
                  <button onClick={() => setGrauAberto(true)} className="link-rule mt-4">
                    Pedir orçamento com esta armação
                  </button>
                </div>
              )}
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href={whatsappCom(`Olá! Vim pelo site da Sanrê. Tenho interesse no ${product.title}${product.frameColor ? ` (${product.frameColor})` : ""}: ${window.location.origin}/loja/produto/${product.slug}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whats"
                >
                  <MessageCircle size={16} aria-hidden />
                  Falar no WhatsApp
                </a>
              </div>
              {unidadesComSaldo.length > 0 && (
                <p className="mt-6 text-[0.88rem] text-sr-ink-soft">
                  Para ver ao vivo: {unidadesComSaldo.map(u => u.cidade).join(" e ")}. Reserve antes e o óculos fica separado para você.
                </p>
              )}
            </div>
          </div>
        </section>

        {bundles.length > 0 && (
          <section className="bleed py-12">
            {bundles.map(b => (
              <BundleOffer key={b.id} bundle={b} primaryColor="#141414" />
            ))}
          </section>
        )}

        <section className="bleed py-12">
          <ReviewsSection slug={product.slug} primaryColor="#141414" />
        </section>

        {relacionados.length > 0 && (
          <section className="border-t border-sr-line py-16">
            <div className="bleed">
              <p className="eyebrow">Na mesma linha</p>
              <h2 className="display-md mt-3">Outros modelos para comparar</h2>
              <div className="grid-vitrine mt-10">
                {relacionados.slice(0, 4).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />

      {provadorAberto && product.tryonImageUrl && (
        <Suspense fallback={null}>
          <ProvadorAR
            modo="modal"
            inicial={product.slug}
            onFechar={() => setProvadorAberto(false)}
            oculos={[
              {
                id: product.id,
                slug: product.slug,
                title: product.title,
                brand: product.brand,
                price: String(preco),
                tryonImageUrl: product.tryonImageUrl,
                lensWidthMm: product.lensWidthMm,
                bridgeMm: product.bridgeMm,
                templeMm: product.templeMm,
                frameShape: product.frameShape,
                mainImage: produtoResumo.mainImage,
              },
              ...relacionados
                .filter(r => r.tryonImageUrl)
                .map(r => ({
                  id: r.id,
                  slug: r.slug,
                  title: r.title,
                  brand: r.brand,
                  price: r.price,
                  tryonImageUrl: r.tryonImageUrl!,
                  lensWidthMm: r.lensWidthMm,
                  bridgeMm: r.bridgeMm,
                  templeMm: r.templeMm,
                  frameShape: r.frameShape,
                  mainImage: r.mainImage,
                })),
            ]}
          />
        </Suspense>
      )}
      <FluxoGrau aberto={grauAberto} onFechar={() => setGrauAberto(false)} produto={produtoResumo} />
      <ReservaDialog
        aberto={reservaAberta}
        onFechar={() => setReservaAberta(false)}
        produto={produtoResumo}
        unidadesDisponiveis={unidadesComSaldo.map(u => u.slug)}
      />
    </div>
  );
}
