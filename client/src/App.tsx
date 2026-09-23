import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect, useRef, lazy, Suspense } from "react";
import CookieConsent from "@/components/CookieConsent";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import StorePage, { secao } from "@/pages/store/StorePage";
import { MarcasPage, MarcaPage } from "@/pages/conteudo/MarcasPages";
import { UnidadesPage, UnidadePage } from "@/pages/conteudo/UnidadesPages";
import { GuiasPage, GuiaPage } from "@/pages/conteudo/GuiasPages";
import FormatoRostoPage from "@/pages/conteudo/FormatoRostoPage";
import TamanhoOculosPage from "@/pages/conteudo/TamanhoOculosPage";
import ProductDetailPage from "@/pages/store/ProductDetailPage";
const CartPage = lazy(() => import("@/pages/store/CartPage"));
const CheckoutPage = lazy(() => import("@/pages/store/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("@/pages/store/OrderConfirmationPage"));
const AdminLoginPage = lazy(() => import("@/pages/admin/LoginPage"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/Products"));
const AdminProductForm = lazy(() => import("@/pages/admin/ProductForm"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/OrderDetail"));
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"));
const AdminImport = lazy(() => import("@/pages/admin/Import"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminCoupons = lazy(() => import("@/pages/admin/Coupons"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/Subscriptions"));
const AdminAbandonedCarts = lazy(() => import("@/pages/admin/AbandonedCarts"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminBundles = lazy(() => import("@/pages/admin/Bundles"));
const AdminCategories = lazy(() => import("@/pages/admin/Categories"));
const AdminFeaturedProducts = lazy(() => import("@/pages/admin/FeaturedProducts"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminReports = lazy(() => import("@/pages/admin/Reports"));
const AdminChangePassword = lazy(() => import("@/pages/admin/ChangePasswordPage"));
import SobrePage from "@/pages/institucional/SobrePage";
import ContatoPage from "@/pages/institucional/ContatoPage";
const TrocasPage = lazy(() => import("@/pages/institucional/TrocasPage"));
const PrivacidadePage = lazy(() => import("@/pages/institucional/PrivacidadePage"));
const ProvadorPage = lazy(() => import("@/pages/ProvadorPage"));
const LentesDeGrauPage = lazy(() => import("@/pages/LentesDeGrauPage"));
const EmpresasPage = lazy(() => import("@/pages/EmpresasPage"));
const AdminLeads = lazy(() => import("@/pages/admin/Leads"));
import AssistenteWidget from "@/components/assistente/AssistenteWidget";
import { CartProvider } from "@/context/CartContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";

/**
 * Toda página nova abre no topo.
 *
 * O wouter troca a rota sem mexer no scroll, então quem clicava numa peça lá
 * embaixo da home caía no meio da página do produto — no "Complete o look",
 * não na peça. O reset é só para navegação nova: no voltar/avançar o
 * navegador devolve a posição anterior e a cliente cai de novo onde parou
 * na vitrine.
 */
function RolarParaOTopo() {
  const [location] = useLocation();
  const voltando = useRef(false);

  useEffect(() => {
    const marcar = () => {
      voltando.current = true;
    };
    window.addEventListener("popstate", marcar);
    return () => window.removeEventListener("popstate", marcar);
  }, []);

  useEffect(() => {
    if (voltando.current) {
      voltando.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

const LojaPage = () => <StorePage />;
const SecaoSol = secao("oculos-de-sol");
const SecaoGrau = secao("oculos-de-grau");
const SecaoInfantil = secao("infantil");
const SecaoEpi = secao("epi");

function Router() {
  return (
    <Switch>
      {/* Site */}
      <Route path="/" component={Home} />

      {/* Loja */}
      <Route path="/loja" component={LojaPage} />
      <Route path="/oculos-de-sol" component={SecaoSol} />
      <Route path="/oculos-de-grau" component={SecaoGrau} />
      <Route path="/infantil" component={SecaoInfantil} />
      <Route path="/epi" component={SecaoEpi} />
      <Route path="/marcas" component={MarcasPage} />
      <Route path="/marcas/:slug" component={MarcaPage} />
      <Route path="/loja/produto/:slug" component={ProductDetailPage} />
      <Route path="/loja/carrinho" component={CartPage} />
      <Route path="/loja/checkout" component={CheckoutPage} />
      <Route path="/loja/pedido/:orderNumber" component={OrderConfirmationPage} />

      {/* Institucional */}
      <Route path="/sobre" component={SobrePage} />
      <Route path="/contato" component={ContatoPage} />
      <Route path="/trocas-e-devolucoes" component={TrocasPage} />
      <Route path="/privacidade" component={PrivacidadePage} />
      <Route path="/tamanho-do-oculos" component={TamanhoOculosPage} />
      <Route path="/guia-de-medidas">{() => <Redirect to="/tamanho-do-oculos" />}</Route>
      <Route path="/unidades" component={UnidadesPage} />
      <Route path="/unidades/:slug" component={UnidadePage} />
      <Route path="/guia" component={GuiasPage} />
      <Route path="/guia/:slug" component={GuiaPage} />
      <Route path="/formato-do-rosto" component={FormatoRostoPage} />

      {/* Diferenciais Sanrê */}
      <Route path="/provador" component={ProvadorPage} />
      <Route path="/lentes-de-grau" component={LentesDeGrauPage} />
      <Route path="/empresas" component={EmpresasPage} />

      {/* Admin */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/trocar-senha" component={AdminChangePassword} />
      <Route path="/admin" component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/produtos" component={() => <AdminLayout><AdminProducts /></AdminLayout>} />
      <Route path="/admin/produtos/novo" component={() => <AdminLayout><AdminProductForm /></AdminLayout>} />
      <Route path="/admin/produtos/:id" component={() => <AdminLayout><AdminProductForm /></AdminLayout>} />
      <Route path="/admin/pedidos" component={() => <AdminLayout><AdminOrders /></AdminLayout>} />
      <Route path="/admin/pedidos/:id" component={() => <AdminLayout><AdminOrderDetail /></AdminLayout>} />
      <Route path="/admin/clientes" component={() => <AdminLayout><AdminCustomers /></AdminLayout>} />
      <Route path="/admin/importar" component={() => <AdminLayout><AdminImport /></AdminLayout>} />
      <Route path="/admin/cupons" component={() => <AdminLayout><AdminCoupons /></AdminLayout>} />
      <Route path="/admin/assinaturas" component={() => <AdminLayout><AdminSubscriptions /></AdminLayout>} />
      <Route path="/admin/carrinhos" component={() => <AdminLayout><AdminAbandonedCarts /></AdminLayout>} />
      <Route path="/admin/avaliacoes" component={() => <AdminLayout><AdminReviews /></AdminLayout>} />
      <Route path="/admin/kits" component={() => <AdminLayout><AdminBundles /></AdminLayout>} />
      <Route path="/admin/categorias" component={() => <AdminLayout><AdminCategories /></AdminLayout>} />
      <Route path="/admin/destaques" component={() => <AdminLayout><AdminFeaturedProducts /></AdminLayout>} />
      <Route path="/admin/configuracoes" component={() => <AdminLayout><AdminSettings /></AdminLayout>} />
      <Route path="/admin/usuarios" component={() => <AdminLayout><AdminUsers /></AdminLayout>} />
      <Route path="/admin/relatorios" component={() => <AdminLayout><AdminReports /></AdminLayout>} />
      <Route path="/admin/leads" component={() => <AdminLayout><AdminLeads /></AdminLayout>} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Link com cupom: ?cupom=XYZ (ou ?coupon=) em qualquer rota → guarda pra aplicar
  // no checkout e limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("cupom") ?? params.get("coupon");
    if (code) {
      try {
        localStorage.setItem("wl_coupon", code.toUpperCase());
      } catch {
        /* ignore */
      }
      params.delete("cupom");
      params.delete("coupon");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  useEffect(() => {
    fetch("/api/store/settings")
      .then(r => r.json())
      .then((s: any) => {
        if (s.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = s.faviconUrl;
        }
        // O <title> do index.html já traz marca + posicionamento (SEO);
        // só assume o nome do banco se a página não tiver título próprio.
        if (s.storeName && !document.title) {
          document.title = s.storeName;
        }
      })
      .catch(() => {});
  }, []);

  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminAuthProvider>
          <CartProvider>
            <RolarParaOTopo />
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Router />
            </Suspense>
            <Toaster />
            {!isAdmin && <CookieConsent />}
            {!isAdmin && <AssistenteWidget />}
          </CartProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
