import { useState, useEffect, type FormEvent } from "react";
import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { abrirAssistente } from "@/components/assistente/contexto";
import { aplicarSeo } from "@/lib/seo";
import { EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_LABEL, whatsappCom } from "@/lib/marca";
import { UNIDADES } from "@shared/unidades";

type Status = "idle" | "sending" | "success" | "error";

export default function ContatoPage() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    aplicarSeo({
      titulo: "Contato",
      descricao: `WhatsApp ${WHATSAPP_LABEL}, e-mail ${EMAIL} e as lojas de Cravinhos e Ribeirão Preto.`,
      caminho: "/contato",
    });
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
    };
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Falha no envio");
      formElement.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const campo = "mt-2 min-h-12 w-full border border-sr-line bg-white px-4 py-3 text-sr-ink";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bleed pb-24 pt-12 md:pt-16">
        <p className="eyebrow">Fale com a gente</p>
        <h1 className="display-lg mt-4 traco">Contato</h1>

        <div className="mt-12 grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <a href={whatsappCom("Olá! Vim pelo site da Sanrê e queria atendimento.")} target="_blank" rel="noopener noreferrer" className="btn-whats">
                WhatsApp {WHATSAPP_LABEL}
              </a>
              <button onClick={() => abrirAssistente()} className="btn-line">Conversar aqui no site</button>
            </div>
            <dl className="mt-10 border-t border-sr-line">
              <div className="border-b border-sr-line py-4">
                <dt className="nav-label">E-mail</dt>
                <dd className="mt-1"><a href={`mailto:${EMAIL}`} className="break-all underline underline-offset-4">{EMAIL}</a></dd>
              </div>
              <div className="border-b border-sr-line py-4">
                <dt className="nav-label">Instagram</dt>
                <dd className="mt-1"><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{INSTAGRAM_HANDLE}</a></dd>
              </div>
              {UNIDADES.map(u => (
                <div key={u.slug} className="border-b border-sr-line py-4">
                  <dt className="nav-label">Loja {u.cidade}</dt>
                  <dd className="mt-1 text-sr-ink-soft">
                    {u.logradouro}{u.complemento ? ` — ${u.complemento}` : ""}, {u.bairro}, {u.cidade}/{u.uf} ·{" "}
                    <Link href={`/unidades/${u.slug}`} className="underline underline-offset-4">ver a loja</Link>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <section className="campos-retos border border-sr-line bg-white p-6 md:p-10" aria-labelledby="mensagem-titulo">
            <h2 id="mensagem-titulo" className="display-md">Envie uma mensagem</h2>
            <p className="mt-3 text-[0.92rem] text-sr-ink-soft">Para orçamento de lentes, use a página <Link href="/lentes-de-grau" className="underline underline-offset-4">Lentes de grau</Link> — lá dá para anexar a receita com segurança.</p>
            <form onSubmit={enviar} className="mt-7 space-y-5">
              <div><label htmlFor="contact-name" className="text-[0.92rem] font-medium">Nome</label><input id="contact-name" name="name" required autoComplete="name" className={campo} /></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="contact-phone" className="text-[0.92rem] font-medium">WhatsApp</label><input id="contact-phone" name="phone" required type="tel" autoComplete="tel" className={campo} /></div>
                <div><label htmlFor="contact-email" className="text-[0.92rem] font-medium">E-mail</label><input id="contact-email" name="email" required type="email" autoComplete="email" className={campo} /></div>
              </div>
              <div><label htmlFor="contact-message" className="text-[0.92rem] font-medium">Como podemos ajudar?</label><textarea id="contact-message" name="message" required rows={5} className={campo} /></div>
              <p className="text-[0.82rem] text-sr-ink-soft">Usamos seus dados só para responder a esta mensagem. Veja a <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
              <button type="submit" disabled={status === "sending"} className="btn-ink">
                {status === "sending" ? "Enviando…" : "Enviar mensagem"}
              </button>
              <p aria-live="polite" className={`min-h-6 ${status === "error" ? "text-sr-alert" : "text-sr-ok"}`}>
                {status === "success" && "Mensagem enviada. A equipe responde em horário comercial."}
                {status === "error" && "Não foi possível enviar agora. Tente de novo ou chame no WhatsApp."}
              </p>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
