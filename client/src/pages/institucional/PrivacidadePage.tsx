import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { aplicarSeo } from "@/lib/seo";
import { EMAIL, RAZAO_SOCIAL, CNPJ } from "@/lib/marca";

/**
 * Política de privacidade (LGPD). Cobre os tratamentos que o site realmente
 * faz: compra, contato, orçamento com receita (dado de saúde, art. 11),
 * provador (processado no aparelho), assistente e cookies.
 * TODO(loja): revisar com o jurídico da Sanrê antes do go-live.
 */
export default function PrivacidadePage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Política de privacidade",
      descricao: "Como a Óticas Sanrê trata seus dados: compras, contato, receitas enviadas para orçamento, provador virtual, assistente e cookies.",
      caminho: "/privacidade",
    });
  }, []);
  const Bloco = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <section className="border-t border-sr-line py-7">
      <h2 className="font-display text-[1.35rem] font-light">{t}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-sr-ink">{children}</div>
    </section>
  );
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-sr pb-24 pt-12 md:pt-16">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow">LGPD</p>
          <h1 className="display-lg mt-4 mb-6">Política de privacidade</h1>
          <p className="mb-8 text-sr-ink-soft">Controladora: {RAZAO_SOCIAL}, CNPJ {CNPJ}. Contato do encarregado: {EMAIL}.</p>
          <Bloco t="Compras e entregas">
            <p>Nome, CPF, contato e endereço são usados para emitir nota fiscal, processar o pagamento (pelos gateways Mercado Pago ou Asaas) e entregar ou separar o pedido para retirada. Guardamos pelo prazo exigido pela legislação fiscal.</p>
          </Bloco>
          <Bloco t="Receitas enviadas para orçamento">
            <p>A receita de óculos é dado pessoal sensível (saúde). Só a recebemos com o seu consentimento específico, usamos apenas para montar o orçamento das lentes e ela fica acessível somente à equipe da loja. O arquivo é apagado automaticamente em até 90 dias, ou antes, se você pedir.</p>
          </Bloco>
          <Bloco t="Provador virtual">
            <p>A imagem da câmera ou a foto que você escolhe é processada no seu próprio aparelho, pelo navegador. Ela não é enviada nem gravada pela Sanrê. As fotos que você tirar no provador ficam só no seu aparelho.</p>
          </Bloco>
          <Bloco t="Assistente e WhatsApp">
            <p>As mensagens trocadas com a Assistente Sanrê são usadas para responder você e, quando necessário, passar o atendimento a uma consultora. Não envie receita, CPF ou dados de cartão pelo chat do site. Ao continuar pelo WhatsApp, a conversa segue também as regras do WhatsApp.</p>
          </Bloco>
          <Bloco t="Contato, reservas e empresas">
            <p>Nome, telefone e e-mail informados em formulários de contato, reserva de armação ou atendimento a empresas são usados para responder o seu pedido.</p>
          </Bloco>
          <Bloco t="Cookies">
            <p>Usamos cookies necessários para o carrinho funcionar. Cookies de medição e de anúncios só são ativados com a sua autorização, no aviso de cookies.</p>
          </Bloco>
          <Bloco t="Seus direitos">
            <p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados e revogar consentimentos a qualquer momento pelo e-mail {EMAIL}.</p>
          </Bloco>
        </article>
      </main>
      <Footer />
    </div>
  );
}
