/**
 * /provador — o provador virtual como página.
 *
 * Lista as armações com vista frontal (`GET /api/store/products?tryon=1`),
 * filtra por tipo (Sol / Grau / Infantil) e marca, e entrega a lista ao
 * ProvadorAR. `?oculos=<slug>` abre com aquele óculos já selecionado, e a URL
 * acompanha a troca — dá para mandar o link de um modelo pelo WhatsApp.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProvadorAR, { type OculosProvador } from "@/components/provador/ProvadorAR";
import { useCart } from "@/context/CartContext";
import { TIPOS, type ProdutoVitrine } from "@/lib/oculos";
import { aplicarSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

interface Categoria {
  id: number;
  name: string;
  slug: string;
}

interface RespostaProdutos {
  products: ProdutoVitrine[];
  total: number;
}

/** Tipos com filtro rápido no provador (EPI não tem prova de rosto). */
const TIPOS_PROVADOR = TIPOS.filter((t) => ["oculos-de-sol", "oculos-de-grau", "infantil"].includes(t.slug));

function lerParametro(nome: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(nome) ?? undefined;
}

function paraProvador(p: ProdutoVitrine): OculosProvador | null {
  if (!p.tryonImageUrl) return null;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    price: p.price,
    tryonImageUrl: p.tryonImageUrl,
    lensWidthMm: p.lensWidthMm ?? null,
    bridgeMm: p.bridgeMm ?? null,
    templeMm: p.templeMm ?? null,
    frameShape: p.frameShape ?? null,
    mainImage: p.mainImage ?? null,
  };
}

async function buscarJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ─── Ações do óculos atual ───────────────────────────────────────────────────

async function quantidadeNaSacola(sessionId: string, productId: number): Promise<number> {
  try {
    const r = await fetch(`/api/cart/${sessionId}`);
    if (!r.ok) return 0;
    const cart = (await r.json()) as { items?: { productId: number; quantity: number }[] };
    return (cart.items ?? []).filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0);
  } catch {
    return 0;
  }
}

function AcoesOculos({ oculos }: { oculos: OculosProvador }) {
  const { addToCart, sessionId } = useCart();
  const [estado, setEstado] = useState<"livre" | "enviando" | "ok" | "erro">("livre");

  useEffect(() => setEstado("livre"), [oculos.slug]);

  const adicionar = async () => {
    setEstado("enviando");
    try {
      const antes = await quantidadeNaSacola(sessionId, oculos.id);
      await addToCart(oculos.id, (oculos as { variantId?: number | null }).variantId ?? null, 1);
      // addToCart não devolve erro: a confirmação é o item aparecer na sacola.
      const depois = await quantidadeNaSacola(sessionId, oculos.id);
      setEstado(depois > antes ? "ok" : "erro");
    } catch {
      setEstado("erro");
    }
  };

  const detalhes = `/loja/produto/${oculos.slug}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <button type="button" className="btn-ink w-full" onClick={adicionar} disabled={estado === "enviando"}>
          {estado === "enviando" ? "Adicionando" : "Adicionar à sacola"}
        </button>
        <Link href={detalhes} className="btn-line w-full no-underline">
          Ver detalhes
        </Link>
      </div>
      <p className="min-h-[1.5rem] text-sm text-sr-ink-soft" aria-live="polite">
        {estado === "ok" && (
          <>
            Adicionado à sacola.{" "}
            <Link href="/loja/carrinho" className="text-sr-ink underline underline-offset-4">
              Ver sacola
            </Link>
          </>
        )}
        {estado === "erro" && (
          <>
            Não foi possível adicionar por aqui.{" "}
            <Link href={detalhes} className="text-sr-ink underline underline-offset-4">
              Escolha cor e tamanho na página do produto
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ProvadorPage() {
  const [inicial] = useState(() => lerParametro("oculos"));
  const [tipo, setTipo] = useState<string>("");
  const [marca, setMarca] = useState<string>("");

  useEffect(() => {
    aplicarSeo({
      titulo: "Provador virtual de óculos",
      descricao:
        "Prove as armações da Óticas Sanrê pela câmera do celular ou do computador. A imagem é processada só no seu aparelho — nada é enviado nem gravado.",
      caminho: "/provador",
    });
  }, []);

  const produtos = useQuery<RespostaProdutos>({
    queryKey: ["/api/store/products", "provador"],
    queryFn: () => buscarJson<RespostaProdutos>("/api/store/products?tryon=1&limit=100&sort=destaque"),
    staleTime: 5 * 60_000,
  });

  // Mesma chave da Navbar: a lista de categorias vem do cache.
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/store/categories"],
    queryFn: () => buscarJson<Categoria[]>("/api/store/categories"),
    staleTime: 5 * 60_000,
  });

  // Enquanto a API não filtra por `tryon`, o filtro também roda aqui.
  const todos = useMemo(() => {
    const lista = (produtos.data?.products ?? []).filter((p) => !!p.tryonImageUrl);
    return lista.map((p) => ({ produto: p, oculos: paraProvador(p)! }));
  }, [produtos.data]);

  const slugPorCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.slug])), [categorias]);

  const tiposDisponiveis = useMemo(
    () => TIPOS_PROVADOR.filter((t) => todos.some((x) => slugPorCategoria.get(x.produto.categoryId ?? -1) === t.slug)),
    [todos, slugPorCategoria],
  );

  const marcas = useMemo(
    () =>
      Array.from(new Set(todos.map((x) => x.produto.brand).filter((b): b is string => !!b))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [todos],
  );

  const filtrados = useMemo(
    () =>
      todos
        .filter((x) => !tipo || slugPorCategoria.get(x.produto.categoryId ?? -1) === tipo)
        .filter((x) => !marca || x.produto.brand === marca)
        .map((x) => x.oculos),
    [todos, tipo, marca, slugPorCategoria],
  );

  const aoTrocar = (o: OculosProvador) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("oculos") === o.slug) return;
    url.searchParams.set("oculos", o.slug);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  const chip = (ativo: boolean) =>
    cn(
      "inline-flex min-h-10 items-center border px-3.5 font-label text-[0.66rem] font-medium uppercase tracking-[0.16em] transition-colors",
      ativo ? "border-sr-ink bg-sr-ink text-sr-paper" : "border-sr-line text-sr-ink hover:border-sr-ink",
    );

  const filtros =
    todos.length > 1 && (tiposDisponiveis.length > 1 || marcas.length > 1) ? (
      <div className="flex flex-col gap-3">
        {tiposDisponiveis.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de óculos">
            <button type="button" className={chip(!tipo)} aria-pressed={!tipo} onClick={() => setTipo("")}>
              Todos
            </button>
            {tiposDisponiveis.map((t) => (
              <button
                key={t.slug}
                type="button"
                className={chip(tipo === t.slug)}
                aria-pressed={tipo === t.slug}
                onClick={() => setTipo(t.slug)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        )}
        {marcas.length > 1 && (
          <label className="campos-retos flex flex-col gap-1.5">
            <span className="eyebrow">Marca</span>
            <select
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="h-11 w-full border border-sr-line bg-white px-3 text-sr-ink"
            >
              <option value="">Todas as marcas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        {!filtrados.length && (
          <p className="text-sm text-sr-ink-soft">
            Nenhuma armação com esses filtros.{" "}
            <button
              type="button"
              className="text-sr-ink underline underline-offset-4"
              onClick={() => {
                setTipo("");
                setMarca("");
              }}
            >
              Limpar filtros
            </button>
          </p>
        )}
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-sr-paper">
      <Navbar />
      <main>
        <section className="bleed pb-10 pt-10 md:pb-14 md:pt-14">
          <div className="max-w-3xl">
            <p className="eyebrow">Provador virtual</p>
            <h1 className="display-lg mt-4 text-balance">Veja a armação no seu rosto</h1>
            <p className="measure mt-5 text-sr-ink-soft">
              Escolha um modelo e abra a câmera: a armação acompanha o seu rosto em tempo real. Sem câmera, use uma
              foto de frente. A imagem é processada só no seu aparelho — nada é enviado nem gravado.
            </p>
          </div>

          <div className="mt-10">
            {produtos.isLoading ? (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]" aria-busy="true">
                <div className="aspect-[3/4] w-full animate-pulse bg-sr-sand motion-reduce:animate-none sm:aspect-[4/3]" />
                <div className="flex flex-col gap-4">
                  <div className="h-24 animate-pulse bg-sr-sand motion-reduce:animate-none" />
                  <div className="h-12 animate-pulse bg-sr-sand motion-reduce:animate-none" />
                </div>
                <p className="sr-only" role="status">
                  Carregando as armações do provador
                </p>
              </div>
            ) : produtos.isError ? (
              <div className="border-t border-sr-line pt-8">
                <p className="text-sr-ink">Não foi possível carregar as armações agora.</p>
                <button type="button" className="btn-line mt-5" onClick={() => produtos.refetch()}>
                  Tentar de novo
                </button>
              </div>
            ) : !todos.length ? (
              <div className="border-t border-sr-line pt-8">
                <p className="max-w-xl text-sr-ink">
                  As armações do provador estão sendo fotografadas de frente. Enquanto isso, veja a vitrine ou fale
                  com a gente.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/loja" className="btn-ink no-underline">
                    Ver a vitrine
                  </Link>
                  <Link href="/contato" className="btn-line no-underline">
                    Contato
                  </Link>
                </div>
              </div>
            ) : (
              <ProvadorAR
                oculos={filtrados}
                inicial={inicial}
                modo="pagina"
                onTrocar={aoTrocar}
                acoes={(o) => <AcoesOculos oculos={o} />}
                filtros={filtros}
              />
            )}
          </div>
        </section>

        <section className="bleed border-t border-sr-line py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-3 md:gap-12">
            <div>
              <p className="eyebrow">Privacidade</p>
              <p className="mt-3 font-display text-xl font-light text-sr-ink">Só no seu aparelho</p>
              <p className="mt-3 text-sr-ink-soft">
                O rosto é reconhecido pelo próprio navegador. A imagem da câmera e a foto que você escolhe não são
                enviadas nem gravadas.
              </p>
            </div>
            <div>
              <p className="eyebrow">Tamanho</p>
              <p className="mt-3 font-display text-xl font-light text-sr-ink">Uma aproximação</p>
              <p className="mt-3 text-sr-ink-soft">
                O tamanho na tela vem das medidas da armação e das proporções do seu rosto. Na loja, a consultora
                confere o ajuste e faz a regulagem.
              </p>
            </div>
            <div>
              <p className="eyebrow">Lentes de grau</p>
              <p className="mt-3 font-display text-xl font-light text-sr-ink">Com a sua receita</p>
              <p className="mt-3 text-sr-ink-soft">
                Gostou de uma armação de grau? Envie a receita e a consultora monta as lentes com você.
              </p>
              <Link href="/lentes-de-grau" className="link-rule mt-5">
                Lentes de grau
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
