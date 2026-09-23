import { Link } from "wouter";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { TIPOS } from "@/lib/oculos";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bleed py-24 text-center md:py-32">
        <p className="eyebrow">Erro 404</p>
        <h1 className="display-lg mt-4">Esta página não está na vitrine</h1>
        <p className="mx-auto mt-5 max-w-md text-sr-ink-soft">
          O endereço pode ter mudado ou o óculos saiu do catálogo. Comece por aqui:
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {TIPOS.map(t => (
            <Link key={t.slug} href={t.rota} className="btn-line">{t.titulo}</Link>
          ))}
        </div>
        <Link href="/" className="link-rule mt-10">Voltar ao início</Link>
      </main>
      <Footer />
    </div>
  );
}
