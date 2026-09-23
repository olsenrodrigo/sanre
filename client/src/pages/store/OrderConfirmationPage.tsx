import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { CheckCircle, Package, Clock, Copy, ExternalLink, MessageCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trackPurchase, useAnalyticsReady } from "@/lib/analytics";
import { precoBR, whatsappCom, WHATSAPP_LABEL } from "@/lib/marca";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Aguardando pagamento", className: "text-sr-alert" },
  confirmed: { label: "Confirmado", className: "text-sr-nude-700" },
  processing: { label: "Em preparo", className: "text-sr-nude-700" },
  shipped: { label: "Enviado", className: "text-sr-nude-700" },
  delivered: { label: "Entregue", className: "text-sr-nude-700" },
  cancelled: { label: "Cancelado", className: "text-sr-alert" },
};

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setStoreInfo] = useState<any>({});
  const { toast } = useToast();
  const analyticsOn = useAnalyticsReady();

  useEffect(() => {
    fetch("/api/store/settings").then(r => r.json()).then(setStoreInfo).catch(() => {});
    // Checa r.ok: o JSON de erro {message} virava "order" e a tela quebrava em
    // branco ao ler order.customerName de um pedido inexistente.
    fetch(`/api/orders/${orderNumber}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  // Analytics: purchase ao chegar na confirmação (pedido colocado). Dedup interno
  // por orderNumber garante 1x mesmo com reload/reemissão após consentimento.
  useEffect(() => {
    if (order && order.orderNumber && analyticsOn) {
      trackPurchase({
        orderNumber: order.orderNumber,
        value: Number(order.total),
        coupon: order.couponCode || undefined,
        items: (order.items || []).map((i: any) => ({
          slug: String(i.productId ?? i.id),
          name: i.productTitle,
          price: Number(i.unitPrice ?? (Number(i.totalPrice) / (i.quantity || 1))),
          quantity: i.quantity,
        })),
      });
    }
  }, [order, analyticsOn]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sr-nude-600 border-t-transparent" aria-label="Carregando pedido" /></div>;
  if (!order) return <div className="flex min-h-screen items-center justify-center bg-background text-sr-ink-soft">Pedido não encontrado</div>;

  const statusInfo = STATUS_LABELS[order.status] || { label: order.status, className: "text-sr-ink-soft" };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-sr max-w-3xl py-10 md:py-14">
        {/* Header */}
        <div className="text-center mb-8">
          <CheckCircle size={56} className="mx-auto mb-4 text-sr-nude-600" aria-hidden />
          <h1 className="display-lg">Pedido realizado!</h1>
          <p className="mt-2 text-sr-ink-soft">Obrigado, {order.customerName.split(" ")[0]}!</p>
          <div className="mt-4 inline-flex items-center gap-2 border border-sr-nude-200 bg-card px-4 py-2">
            <Package size={16} className="text-sr-nude-600" aria-hidden />
            <span className="font-mono font-semibold text-sr-ink">#{orderNumber}</span>
            <button onClick={() => copyToClipboard(orderNumber, "Número do pedido")} className="flex h-11 w-11 items-center justify-center text-sr-ink-soft hover:bg-sr-nude-50 hover:text-sr-ink" aria-label="Copiar número do pedido">
              <Copy size={14} aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className=" border border-sr-nude-100 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-sr-ink-soft">Status do pedido</p>
                <p className={`text-lg font-semibold ${statusInfo.className}`}>{statusInfo.label}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sr-nude-50">
                <div className={`h-3 w-3 rounded-full bg-current ${statusInfo.className}`} />
              </div>
            </div>
          </div>

          {/* PIX */}
          {order.payment?.pixQrCode && (
            <div className=" bg-alt p-5 text-center">
              <h3 className="mb-1 font-sans font-semibold text-sr-ink">Pague com PIX</h3>
              <p className="mb-3 text-sm text-sr-ink-soft">Escaneie o QR code ou copie o código PIX</p>
              {order.payment.pixQrCodeBase64 && (
                <img src={`data:image/png;base64,${order.payment.pixQrCodeBase64}`} alt="QR Code PIX"
                  className="mx-auto w-44 h-44 mb-3" />
              )}
              <div className="mb-3 break-all  bg-card p-3 font-mono text-xs text-sr-ink-soft">
                {order.payment.pixQrCode}
              </div>
              <Button variant="outline" onClick={() => copyToClipboard(order.payment.pixQrCode, "Código PIX")} className="btn-line">
                <Copy size={14} /> Copiar código PIX
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1 text-sm text-sr-alert">
                <Clock size={12} /> PIX expira em 30 minutos
              </p>
            </div>
          )}

          {/* Boleto */}
          {order.payment?.boletoUrl && (
            <div className=" bg-alt p-5 text-center">
              <h3 className="mb-2 font-sans font-semibold text-sr-ink">Boleto Bancário</h3>
              {order.payment.boletoBarcode && (
                <div className="mb-3 break-all rounded bg-card p-2 font-mono text-xs text-sr-ink-soft">{order.payment.boletoBarcode}</div>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => copyToClipboard(order.payment.boletoBarcode, "Código de barras")} className="btn-line">
                  <Copy size={14} /> Copiar código
                </Button>
                <Button asChild className="btn-ink"><a href={order.payment.boletoUrl} target="_blank" rel="noopener" className="flex items-center gap-2">
                  <ExternalLink size={14} /> Visualizar boleto
                </a></Button>
              </div>
              <p className="mt-2 text-sm text-sr-ink-soft">Vencimento: 3 dias úteis</p>
            </div>
          )}

          {/* Items */}
          <div className=" border border-sr-nude-100 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-sans font-semibold text-sr-ink">Itens do pedido</h3>
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.productTitle} className="aspect-fashion w-12  bg-sr-nude-50 object-cover" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-sr-ink">{item.productTitle}</p>
                    {item.variantTitle && <p className="text-sm text-sr-ink-soft">{item.variantTitle}</p>}
                    <p className="text-sm text-sr-ink-soft">× {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-sr-ink">{precoBR(Number(item.totalPrice))}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-sr-nude-200 pt-3 text-sm">
              <div className="flex justify-between text-sr-ink-soft"><span>Subtotal</span><span>{precoBR(Number(order.subtotal))}</span></div>
              {Number(order.discountAmount) > 0 && <div className="flex justify-between text-sr-nude-700"><span>Desconto</span><span>- {precoBR(Number(order.discountAmount))}</span></div>}
              <div className="flex justify-between text-sr-ink-soft"><span>Frete</span><span>{Number(order.shippingAmount) > 0 ? precoBR(Number(order.shippingAmount)) : "Grátis"}</span></div>
              <div className="flex justify-between border-t border-sr-nude-200 pt-2 text-base font-bold text-sr-ink">
                <span>Total</span><span>{precoBR(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {/* Entrega — a consulta pública não devolve o endereço completo (LGPD, INV-B) */}
          {order.shippingCidade && (
            <div className=" border border-sr-nude-100 bg-card p-5 shadow-sm">
              <h3 className="mb-2 font-sans font-semibold text-sr-ink">Entrega</h3>
              <p className="text-sm text-sr-ink-soft">
                {order.shippingCidade}/{order.shippingEstado}
                {order.shippingService && ` — ${order.shippingService}`}<br />
                O endereço completo de entrega está no e-mail de confirmação.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/loja" className="btn-ink flex-1 no-underline">Voltar à loja</Link>
            <a
              href={whatsappCom(`Oi! Gostaria de falar sobre o pedido ${orderNumber}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-line flex-1 no-underline"
            >
              <MessageCircle size={18} aria-hidden />
              WhatsApp {WHATSAPP_LABEL}
            </a>
          </div>

          <p className="text-center text-sm text-sr-ink-soft">
            Uma confirmação foi enviada para <b>{order.customerEmail}</b>
          </p>
        </div>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
