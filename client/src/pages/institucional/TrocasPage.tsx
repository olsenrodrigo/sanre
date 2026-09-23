import { useEffect } from "react";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { aplicarSeo } from "@/lib/seo";
import { WHATSAPP_LABEL, EMAIL } from "@/lib/marca";

/**
 * Trocas, devoluções e garantia. O texto fica no que a lei garante (CDC) e no
 * que a loja já pratica; condições comerciais além disso dependem de
 * confirmação da Sanrê — TODO(loja): revisar antes do go-live.
 */
export default function TrocasPage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Trocas, devoluções e garantia",
      descricao: "Direito de arrependimento em 7 dias para compras pelo site, garantia legal e do fabricante, e como funciona a troca de óculos com lentes de grau.",
      caminho: "/trocas-e-devolucoes",
    });
  }, []);
  const Bloco = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <section className="border-t border-sr-line py-8">
      <h2 className="display-md">{t}</h2>
      <div className="mt-4 space-y-3 leading-relaxed text-sr-ink">{children}</div>
    </section>
  );
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-sr pb-24 pt-12 md:pt-16">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow">Ajuda</p>
          <h1 className="display-lg mt-4 mb-10">Trocas, devoluções e garantia</h1>
          <Bloco t="Compras pelo site: 7 dias para desistir">
            <p>Pelo Código de Defesa do Consumidor (art. 49), você pode desistir de uma compra feita pelo site em até 7 dias corridos a partir do recebimento ou da retirada, sem precisar explicar o motivo. O óculos deve voltar sem sinais de uso, com embalagem, estojo e etiquetas.</p>
            <p>Fale com a gente pelo WhatsApp {WHATSAPP_LABEL} ou por {EMAIL}: combinamos a devolução numa das lojas ou pelo correio e o valor é estornado pela mesma forma de pagamento.</p>
          </Bloco>
          <Bloco t="Óculos com lentes de grau">
            <p>As lentes de grau são feitas sob medida para a sua receita. Por isso, depois da sua aprovação do orçamento, elas não entram no direito de arrependimento — o que não impede de resolvermos qualquer problema: se houver defeito de fabricação, erro de montagem ou dificuldade de adaptação, a consultora revisa as medidas e o ajuste com você.</p>
          </Bloco>
          <Bloco t="Garantia">
            <p>Todo produto tem a garantia legal de 90 dias para defeitos (CDC, art. 26) e a garantia do fabricante, que varia por marca e vem informada na nota fiscal ou no certificado do produto. A garantia não cobre desgaste natural, riscos e quebras por queda ou mau uso.</p>
          </Bloco>
          <Bloco t="Ajuste de armação">
            <p>Ajuste de hastes e plaquetas é feito nas lojas de Cravinhos e Ribeirão Preto. <Link href="/unidades" className="underline underline-offset-4">Ver endereços</Link>.</p>
          </Bloco>
        </article>
      </main>
      <Footer />
    </div>
  );
}
