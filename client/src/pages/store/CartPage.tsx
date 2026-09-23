import { Link, useLocation } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Lock } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { precoBR, FRETE_GRATIS_ACIMA } from "@/lib/marca";

export default function CartPage() {
  const { cart, updateItem, clearCart, total, itemCount } = useCart();
  const [, navigate] = useLocation();

  const faltaParaFreteGratis = FRETE_GRATIS_ACIMA - total;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-sr py-24 text-center">
          <ShoppingBag size={56} className="mx-auto text-sr-nude-300" aria-hidden />
          <h1 className="display-lg mt-6">Sua sacola está vazia</h1>
          <p className="mt-3 font-sans text-sr-ink-soft">
            Escolha seus óculos e volte aqui para finalizar.
          </p>
          <Link href="/loja" className="btn-ink mt-8 no-underline">
            Ver a coleção
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container-sr py-10 md:py-14">
        <Link
          href="/loja"
          className="inline-flex items-center gap-2 font-sans text-[0.95rem] text-sr-ink-soft no-underline hover:text-sr-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Continuar comprando
        </Link>

        <h1 className="display-lg mt-4">
          Sua sacola
          <span className="ml-3 font-sans text-lg font-medium text-sr-ink-soft">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <ul className="space-y-4">
            {cart.items.map(item => (
              <li key={item.id} className="flex gap-4  bg-card p-4 shadow-[0_1px_2px_rgb(52_55_46/0.05)]">
                <Link
                  href={`/loja/produto/${item.productSlug}`}
                  className="aspect-fashion w-24 shrink-0 overflow-hidden  bg-sr-nude-50"
                >
                  {item.mainImage && (
                    <img
                      src={item.mainImage}
                      alt={item.productTitle}
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/loja/produto/${item.productSlug}`}
                    className="font-sans font-medium text-sr-ink no-underline hover:underline"
                  >
                    {item.productTitle}
                  </Link>
                  {item.variantTitle && (
                    <p className="mt-0.5 font-sans text-[0.9rem] text-sr-ink-soft">{item.variantTitle}</p>
                  )}
                  <p className="mt-1 font-sans text-[0.95rem] text-sr-ink-soft">
                    {precoBR(item.unitPrice)} cada
                  </p>
                  <p className="mt-1 font-sans text-base font-semibold text-sr-ink sm:hidden">
                    {precoBR(Number(item.unitPrice) * item.quantity)}
                  </p>

                  <div className="mt-auto flex items-center gap-3 pt-3">
                    <div className="flex items-center border border-sr-nude-200">
                      <button
                        onClick={() => updateItem(item.id, item.quantity - 1)}
                        className="flex h-11 w-11 items-center justify-center  text-sr-ink hover:bg-sr-nude-50"
                        aria-label={`Diminuir quantidade de ${item.productTitle}`}
                      >
                        <Minus size={14} aria-hidden />
                      </button>
                      <span className="w-8 text-center font-sans font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateItem(item.id, item.quantity + 1)}
                        className="flex h-11 w-11 items-center justify-center  text-sr-ink hover:bg-sr-nude-50"
                        aria-label={`Aumentar quantidade de ${item.productTitle}`}
                      >
                        <Plus size={14} aria-hidden />
                      </button>
                    </div>
                    <button
                      onClick={() => updateItem(item.id, 0)}
                      className="flex h-11 w-11 items-center justify-center text-sr-ink-soft hover:bg-sr-nude-50 hover:text-sr-alert"
                      aria-label={`Remover ${item.productTitle} da sacola`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>

                {/* No mobile o preço vai para baixo do nome: mantê-lo na mesma
                    linha do stepper somava ~422px de largura mínima e a página
                    passava a rolar lateralmente a 375px. */}
                <p className="hidden shrink-0 font-sans text-lg font-semibold text-sr-ink sm:block">
                  {precoBR(Number(item.unitPrice) * item.quantity)}
                </p>
              </li>
            ))}

            <li>
              <button
                onClick={() => clearCart()}
                className="inline-flex items-center gap-2 font-sans text-[0.95rem] text-sr-ink-soft hover:text-sr-alert"
              >
                <Trash2 size={15} aria-hidden />
                Esvaziar sacola
              </button>
            </li>
          </ul>

          <aside className="h-fit  bg-alt p-6 lg:sticky lg:top-[calc(var(--sr-header)+1.5rem)]">
            <h2 className="eyebrow">Resumo</h2>

            <dl className="mt-5 space-y-2.5 font-sans text-[0.95rem]">
              <div className="flex justify-between text-sr-ink-soft">
                <dt>
                  Subtotal ({itemCount} {itemCount === 1 ? "item" : "itens"})
                </dt>
                <dd className="text-sr-ink">{precoBR(total)}</dd>
              </div>
              <div className="flex justify-between text-sr-ink-soft">
                <dt>Frete</dt>
                <dd>{total >= FRETE_GRATIS_ACIMA ? "Grátis" : "Calculado no checkout"}</dd>
              </div>
            </dl>

            {faltaParaFreteGratis > 0 && (
              <p className="mt-4  bg-white px-4 py-3 font-sans text-[0.9rem] text-sr-nude-700">
                Faltam <strong>{precoBR(faltaParaFreteGratis)}</strong> para o frete sair de graça.
              </p>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-sr-nude-200 pt-5">
              <span className="font-sans font-semibold text-sr-ink">Total</span>
              <span className="font-sans text-2xl font-semibold text-sr-ink">{precoBR(total)}</span>
            </div>

            <Button onClick={() => navigate("/loja/checkout")} className="btn-ink mt-6 h-12 w-full text-base">
              Finalizar compra
            </Button>

            <p className="mt-4 flex items-center justify-center gap-1.5 font-sans text-sm text-sr-ink-soft">
              <Lock size={14} aria-hidden />
              Pagamento seguro
            </p>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
