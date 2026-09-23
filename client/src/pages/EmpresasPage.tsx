/**
 * /empresas — óculos de proteção e EPI com lente de grau para empresas.
 *
 * Texto-base do site atual da loja: "fornecimento de óculos de proteção e EPIs
 * com lentes de grau, seguindo as normas, atendimento personalizado, entrega
 * ágil e condições especiais para contratos corporativos". Nada de cliente,
 * número ou certificação que a loja não tenha informado.
 */
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { UNIDADES, type UnidadeSlug } from "@shared/unidades";
import { enviarLead, ErroLead, type RespostaLead } from "@/components/grau/api";
import { CONSENTIMENTO_CONTATO } from "@/components/grau/consentimentos";
import {
  SEGMENTOS,
  SLUGS_UNIDADE,
  cnpjValido,
  emailValido,
  mascararCnpj,
  mascararTelefone,
  telefoneValido,
  type Segmento,
} from "@/components/grau/regras";
import {
  Armadilha,
  CampoArea,
  CampoTexto,
  Chip,
  Confirmacao,
  Consentimento,
  ErroEnvio,
  Grupo,
  rolarParaPrimeiroErro,
} from "@/components/grau/ui";
import { aplicarSeo } from "@/lib/seo";

const FORNECEMOS = [
  {
    titulo: "Óculos de segurança com CA",
    texto: "Modelos de proteção com Certificado de Aprovação, escolhidos conforme a função e o ambiente de cada setor.",
  },
  {
    titulo: "EPI com lente de grau",
    texto: "Quem usa óculos de grau trabalha protegido e enxergando bem, sem sobrepor um óculos ao outro.",
  },
  {
    titulo: "Atendimento corporativo",
    texto: "Atendimento personalizado, entrega ágil e condições especiais para contratos com empresas.",
  },
];

const PARA_QUEM = [
  { titulo: "Indústria", texto: "Linhas de produção, manutenção e oficinas." },
  { titulo: "Usinas e agronegócio", texto: "Usinas, campo e operação de máquinas da região." },
  { titulo: "Construção", texto: "Obra, canteiro e equipes de campo." },
  { titulo: "Laboratórios", texto: "Bancada, análise e manuseio de produtos." },
];

const COMO_FUNCIONA = [
  {
    titulo: "Levantamento",
    texto: "Você conta quantos colaboradores, em que função e em que ambiente trabalham. A partir disso a loja monta a proposta.",
  },
  {
    titulo: "Visita e medição",
    texto: "Quando precisa, a equipe vai até a empresa para apresentar os modelos, tirar medidas e conferir o encaixe.",
  },
  {
    titulo: "Receitas dos colaboradores",
    texto: "Quem precisa de grau entrega a própria receita à equipe da Sanrê, que confere uma a uma antes de fazer as lentes.",
  },
  {
    titulo: "Entrega",
    texto: "A entrega é combinada com a empresa. Reposição e colaboradores novos seguem o mesmo caminho.",
  },
];

const escolha = (message: string) => ({ errorMap: () => ({ message }) });

const esquema = z.object({
  empresa: z.string().trim().min(2, "Informe o nome da empresa.").max(160, "Até 160 caracteres."),
  cnpj: z.string().refine(v => v.replace(/\D/g, "") === "" || cnpjValido(v), "CNPJ inválido — confira os números."),
  segmento: z.string(),
  quantidade: z
    .string()
    .trim()
    .min(1, "Informe quantas unidades, mesmo que aproximado.")
    .refine(v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000, "Informe um número entre 1 e 100.000."),
  precisaGrau: z.enum(["sim", "nao"], escolha("Diga se alguém precisa de lente de grau.")),
  unidade: z.string(),
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Até 120 caracteres."),
  telefone: z.string().refine(telefoneValido, "Informe o WhatsApp com DDD, ex.: (16) 99195-1430."),
  email: z.string().trim().max(160, "Até 160 caracteres.").refine(v => v === "" || emailValido(v), "E-mail inválido."),
  observacoes: z.string().max(1000, "Até 1000 caracteres."),
  consentimentoContato: z.literal(true, escolha("Marque a autorização para a loja te responder.")),
  website: z.string(),
});

interface ValoresEmpresa {
  empresa: string;
  cnpj: string;
  segmento: Segmento | "";
  quantidade: string;
  precisaGrau: "sim" | "nao" | null;
  unidade: UnidadeSlug | "";
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
  consentimentoContato: boolean;
  website: string;
}

const VAZIO: ValoresEmpresa = {
  empresa: "",
  cnpj: "",
  segmento: "",
  quantidade: "",
  precisaGrau: null,
  unidade: "",
  nome: "",
  telefone: "",
  email: "",
  observacoes: "",
  consentimentoContato: false,
  website: "",
};

const CAMPO_DO_SERVIDOR: Record<string, keyof ValoresEmpresa> = {
  empresa: "empresa",
  "detalhes.cnpj": "cnpj",
  "detalhes.segmento": "segmento",
  "detalhes.quantidade": "quantidade",
  "detalhes.precisaGrau": "precisaGrau",
  unidade: "unidade",
  nome: "nome",
  telefone: "telefone",
  email: "email",
  "detalhes.observacoes": "observacoes",
  consentimento: "consentimentoContato",
  "consentimento.aceito": "consentimentoContato",
};

const classeSelect =
  "mt-2 block min-h-12 w-full border border-sr-line bg-white px-4 py-3 text-sr-ink focus:border-sr-ink focus:outline-none";

function FormularioEmpresa() {
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespostaLead | null>(null);
  const confirmacao = useRef<HTMLDivElement>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ValoresEmpresa>({
    resolver: zodResolver(esquema, undefined, { raw: true }) as any,
    defaultValues: VAZIO,
  });

  useEffect(() => {
    if (resultado) confirmacao.current?.focus();
  }, [resultado]);

  const enviar = async (v: ValoresEmpresa) => {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarLead({
        tipo: "empresa",
        empresa: v.empresa.trim(),
        nome: v.nome.trim(),
        telefone: v.telefone,
        email: v.email.trim() || undefined,
        unidade: v.unidade || undefined,
        detalhes: {
          cnpj: v.cnpj.replace(/\D/g, "") || undefined,
          quantidade: Number(v.quantidade),
          precisaGrau: v.precisaGrau === "sim",
          segmento: v.segmento || undefined,
          observacoes: v.observacoes.trim() || undefined,
        },
        consentimento: { aceito: true, versao: CONSENTIMENTO_CONTATO.versao },
        website: v.website,
      });
      setResultado(r);
    } catch (e) {
      const erro = e instanceof ErroLead ? e : new ErroLead("Não foi possível enviar agora.");
      for (const [campo, mensagem] of Object.entries(erro.campos)) {
        const alvo = CAMPO_DO_SERVIDOR[campo];
        if (alvo) setError(alvo, { type: "server", message: mensagem });
      }
      setErroEnvio(erro.message);
      rolarParaPrimeiroErro(formulario.current);
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div ref={confirmacao} tabIndex={-1} className="outline-none">
        <Confirmacao
          titulo="Pedido de proposta recebido"
          protocolo={resultado.protocolo}
          whatsappUrl={resultado.whatsappUrl}
          passos={[
            "A equipe da Sanrê entra em contato pelo WhatsApp para entender a necessidade da empresa.",
            "Se fizer sentido, combinamos a visita para apresentar os modelos e tirar medidas.",
            "Você recebe a proposta com modelos, valores e prazo de entrega.",
          ]}
        />
      </div>
    );
  }

  return (
    <form ref={formulario} onSubmit={handleSubmit(enviar, () => rolarParaPrimeiroErro(formulario.current))} noValidate className="relative space-y-7">
      <Armadilha {...register("website")} />

      <div className="grid gap-5 md:grid-cols-2">
        <CampoTexto id="emp-empresa" rotulo="Empresa" autoComplete="organization" erro={errors.empresa?.message} {...register("empresa")} />
        <CampoTexto
          id="emp-cnpj"
          rotulo="CNPJ"
          opcional
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          erro={errors.cnpj?.message}
          {...register("cnpj", { onChange: e => setValue("cnpj", mascararCnpj(e.target.value)) })}
        />
        <div className="campos-retos">
          <label htmlFor="emp-segmento" className="font-medium text-sr-ink">
            Segmento
            <span className="ml-1.5 font-normal text-sr-ink-soft">(opcional)</span>
          </label>
          <select id="emp-segmento" className={classeSelect} {...register("segmento")}>
            <option value="">Escolha</option>
            {SEGMENTOS.map(s => (
              <option key={s.valor} value={s.valor}>
                {s.titulo}
              </option>
            ))}
          </select>
        </div>
        <CampoTexto
          id="emp-quantidade"
          rotulo="Quantas unidades, aproximadamente?"
          inputMode="numeric"
          placeholder="Ex.: 40"
          erro={errors.quantidade?.message}
          {...register("quantidade", { onChange: e => setValue("quantidade", e.target.value.replace(/\D/g, "").slice(0, 6)) })}
        />
      </div>

      <Grupo legenda="Algum colaborador precisa de lente de grau?" id="emp-grau" erro={errors.precisaGrau?.message}>
        <div className="flex flex-wrap gap-2">
          <Chip titulo="Sim" value="sim" {...register("precisaGrau")} />
          <Chip titulo="Não" value="nao" {...register("precisaGrau")} />
        </div>
      </Grupo>

      <div className="rule pt-7">
        <p className="eyebrow">Quem fala pela empresa</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <CampoTexto id="emp-nome" rotulo="Seu nome" autoComplete="name" erro={errors.nome?.message} {...register("nome")} />
          <CampoTexto
            id="emp-telefone"
            rotulo="WhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(16) 99999-9999"
            erro={errors.telefone?.message}
            {...register("telefone", { onChange: e => setValue("telefone", mascararTelefone(e.target.value)) })}
          />
          <CampoTexto
            id="emp-email"
            rotulo="E-mail"
            opcional
            type="email"
            inputMode="email"
            autoComplete="email"
            erro={errors.email?.message}
            {...register("email")}
          />
          <div className="campos-retos">
            <label htmlFor="emp-unidade" className="font-medium text-sr-ink">
              Loja mais próxima
            <span className="ml-1.5 font-normal text-sr-ink-soft">(opcional)</span>
            </label>
            <select id="emp-unidade" className={classeSelect} {...register("unidade")}>
              <option value="">Tanto faz</option>
              {UNIDADES.filter(u => (SLUGS_UNIDADE as string[]).includes(u.slug)).map(u => (
                <option key={u.slug} value={u.slug}>
                  {u.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <CampoArea
        id="emp-obs"
        rotulo="Conte um pouco da necessidade"
        opcional
        placeholder="Ex.: setor de manutenção, uso de lixadeira; 6 pessoas usam óculos de grau."
        erro={errors.observacoes?.message}
        {...register("observacoes")}
      />

      <Consentimento
        id="emp-consent"
        texto={CONSENTIMENTO_CONTATO.texto}
        complemento={
          <Link href="/privacidade" className="text-sr-ink underline underline-offset-2">
            Política de privacidade
          </Link>
        }
        erro={errors.consentimentoContato?.message}
        {...register("consentimentoContato")}
      />

      <p className="text-[0.95rem] text-sr-ink-soft">
        Não envie receitas de colaboradores por aqui: cada pessoa entrega a sua direto à equipe da Sanrê, no atendimento.
      </p>

      <ErroEnvio mensagem={erroEnvio} />

      <button type="submit" disabled={enviando} className="btn-ink w-full sm:w-auto">
        {enviando ? "Enviando…" : "Pedir proposta"}
      </button>
    </form>
  );
}

export default function EmpresasPage() {
  useEffect(() => {
    aplicarSeo({
      titulo: "Empresas e EPI com lente de grau",
      descricao:
        "Óculos de proteção e EPI com lente de grau para empresas de Cravinhos, Ribeirão Preto e região. Atendimento corporativo da Óticas Sanrê.",
      caminho: "/empresas",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* ── Abertura ── */}
        <section className="bg-ink text-sr-paper">
          <div className="bleed grid gap-10 py-16 md:grid-cols-12 md:items-end md:py-24">
            <div className="md:col-span-8">
              <p className="eyebrow-light">Empresas · EPI</p>
              <h1 className="display-hero mt-5 max-w-4xl text-balance text-sr-paper">
                Óculos de proteção para a sua equipe, com ou sem grau
              </h1>
              <p className="mt-7 max-w-2xl text-[1.125rem] text-sr-paper/80">
                Fornecemos óculos de proteção e EPI com lentes de grau, seguindo as normas, com atendimento personalizado,
                entrega ágil e condições especiais para contratos corporativos.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-4">
              <a href="#proposta" className="btn-light no-underline">
                Pedir proposta
              </a>
              <Link href="/epi" className="btn-light-line no-underline">
                Ver óculos de segurança <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* ── O que fornecemos ── */}
        <section className="bleed section-padding" aria-labelledby="fornecemos">
          <p className="eyebrow">O que fornecemos</p>
          <h2 id="fornecemos" className="display-lg traco mt-4 max-w-2xl text-balance">
            Proteção para cada função
          </h2>
          <ul className="mt-12 grid gap-px bg-sr-line md:grid-cols-3">
            {FORNECEMOS.map((f, i) => (
              <li key={f.titulo} className="bg-sr-paper pb-8 pt-6 md:pr-10 md:pt-8 md:[&:not(:first-child)]:pl-10">
                <span className="dado font-display text-sm text-sr-nude-600">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 font-display text-xl font-normal">{f.titulo}</h3>
                <p className="mt-3 max-w-sm text-sr-ink-soft">{f.texto}</p>
              </li>
            ))}
          </ul>
          <Link href="/epi" className="link-rule mt-10">
            Ver a vitrine de EPI
          </Link>
        </section>

        {/* ── Para quem ── */}
        <section className="bg-sand" aria-labelledby="para-quem">
          <div className="bleed section-padding grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Para quem</p>
              <h2 id="para-quem" className="display-lg traco mt-4 text-balance">
                Quem atendemos
              </h2>
              <p className="mt-8 max-w-sm text-sr-ink-soft">Empresas de Cravinhos, Ribeirão Preto e região.</p>
            </div>
            <dl className="grid gap-px bg-sr-nude-300 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
              {PARA_QUEM.map(p => (
                <div key={p.titulo} className="bg-sr-sand py-7 sm:pr-8 sm:[&:nth-child(even)]:pl-8">
                  <dt className="font-display text-xl font-normal">{p.titulo}</dt>
                  <dd className="mt-2 text-sr-ink-soft">{p.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section className="bleed section-padding" aria-labelledby="atendimento">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Atendimento corporativo</p>
              <h2 id="atendimento" className="display-lg traco mt-4 text-balance">
                Como funciona
              </h2>
            </div>
            <ol className="lg:col-span-7 lg:col-start-6">
              {COMO_FUNCIONA.map((c, i) => (
                <li key={c.titulo} className="grid gap-2 border-t border-sr-line py-7 md:grid-cols-[4rem_1fr] md:gap-6">
                  <span className="dado font-display text-3xl font-light text-sr-nude-600">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-xl font-normal">{c.titulo}</h3>
                    <p className="mt-2 max-w-xl text-sr-ink-soft">{c.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Proposta ── */}
        <section id="proposta" className="scroll-mt-24 border-t border-sr-line bg-white" aria-labelledby="proposta-titulo">
          <div className="bleed section-padding grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Pedido de proposta</p>
              <h2 id="proposta-titulo" className="display-lg traco mt-4 text-balance">
                Conte o que a sua equipe precisa
              </h2>
              <p className="mt-8 max-w-sm text-sr-ink-soft">
                Você recebe um protocolo na hora e segue a conversa pelo WhatsApp com a equipe da loja.
              </p>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <FormularioEmpresa />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
