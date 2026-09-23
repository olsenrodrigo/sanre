/**
 * "Comprar com lentes de grau" — pedido de orçamento com receita.
 *
 * Decreto 24.492/1934, art. 13: o site NÃO indica lente. A cliente conta como
 * vai usar e quais tratamentos gostaria de ver no orçamento; quem confere a
 * receita e define a solução técnica é a consultora. Nada é cobrado antes.
 *
 * Receita é dado de saúde (LGPD art. 11): o envio exige consentimento próprio,
 * que nunca vem marcado, e o arquivo vai direto para área restrita do servidor.
 *
 * Abre na página do produto (com a armação) ou em /lentes-de-grau (sem armação).
 */
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { FileText, Paperclip, X } from "lucide-react";
import { UNIDADES, type UnidadeSlug } from "@shared/unidades";
import { enviarLead, ErroLead, type RespostaLead } from "./api";
import { CONSENTIMENTO_CONTATO, CONSENTIMENTO_RECEITA } from "./consentimentos";
import {
  ACCEPT_RECEITA,
  MAX_BYTES_RECEITA,
  SLUGS_UNIDADE,
  TRATAMENTOS,
  USOS,
  emailValido,
  extensaoReceitaAceita,
  mascararTelefone,
  tamanhoLegivel,
  telefoneValido,
  type Tratamento,
  type Uso,
} from "./regras";
import {
  Armadilha,
  CampoArea,
  CampoTexto,
  Chip,
  Confirmacao,
  Consentimento,
  Erro,
  ErroEnvio,
  Etapas,
  EtiquetaProduto,
  Grupo,
  Opcao,
  Painel,
  rolarParaPrimeiroErro,
} from "./ui";

export interface ProdutoGrau {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  price: string;
  mainImage?: string | null;
}
export interface FluxoGrauProps {
  aberto: boolean;
  onFechar: () => void;
  produto?: ProdutoGrau | null;
}

interface ValoresGrau {
  usoPrincipal: Uso | null;
  jaUsaMultifocal: "sim" | "nao" | null;
  tratamentos: Tratamento[];
  receitaModo: "agora" | "depois" | null;
  receita: File | null;
  consentimentoReceita: boolean;
  unidade: UnidadeSlug | null;
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
  consentimentoContato: boolean;
  website: string;
}

const VAZIO: ValoresGrau = {
  usoPrincipal: null,
  jaUsaMultifocal: null,
  tratamentos: [],
  receitaModo: null,
  receita: null,
  consentimentoReceita: false,
  unidade: null,
  nome: "",
  telefone: "",
  email: "",
  observacoes: "",
  consentimentoContato: false,
  website: "",
};

const ETAPAS = ["Como vai usar", "Tratamentos", "Receita", "Seus dados"];

// Um esquema por etapa: o zod não roda refinamento de objeto com campo
// inválido, então um esquema único esconderia o erro da receita até a última
// etapa. Toda escolha obrigatória tem mensagem própria — sem ela, o rádio vazio
// (null) viraria "Expected ..., received null" na tela.
const escolha = (message: string) => ({ errorMap: () => ({ message }) });
const ESQUEMAS: z.ZodTypeAny[] = [
  z.object({
    usoPrincipal: z.enum(USOS.map(u => u.valor) as [Uso, ...Uso[]], escolha("Escolha como você vai usar os óculos.")),
  }),
  z.object({ tratamentos: z.array(z.string()) }),
  z
    .object({
      receitaModo: z.enum(["agora", "depois"], escolha("Escolha se vai enviar a receita agora ou depois.")),
      receita: z.any(),
      consentimentoReceita: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.receitaModo !== "agora") return;
      const f = v.receita as File | null;
      if (!f) ctx.addIssue({ code: "custom", path: ["receita"], message: "Anexe a foto ou o PDF da receita." });
      else if (!extensaoReceitaAceita(f.name)) ctx.addIssue({ code: "custom", path: ["receita"], message: "Formato não aceito. Use JPG, PNG, WEBP, HEIC ou PDF." });
      else if (f.size > MAX_BYTES_RECEITA) ctx.addIssue({ code: "custom", path: ["receita"], message: "A receita pode ter até 8 MB. Tire outra foto ou envie pelo WhatsApp." });
      if (!v.consentimentoReceita) {
        ctx.addIssue({ code: "custom", path: ["consentimentoReceita"], message: "Para enviar a receita, marque a autorização de uso." });
      }
    }),
  z.object({
    unidade: z.enum(SLUGS_UNIDADE, escolha("Escolha a loja que vai te atender.")),
    nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome: até 120 caracteres."),
    telefone: z.string().refine(telefoneValido, "Informe o WhatsApp com DDD, ex.: (16) 99195-1430."),
    email: z.string().trim().max(160, "E-mail: até 160 caracteres.").refine(v => v === "" || emailValido(v), "E-mail inválido."),
    observacoes: z.string().max(1000, "Até 1000 caracteres."),
    consentimentoContato: z.literal(true, escolha("Marque a autorização para a loja te responder.")),
  }),
];

/** Campo do servidor → campo do formulário e etapa onde ele mora. */
const CAMPO_DO_SERVIDOR: Record<string, [FieldPath<ValoresGrau>, number]> = {
  "detalhes.usoPrincipal": ["usoPrincipal", 0],
  "detalhes.tratamentosDesejados": ["tratamentos", 1],
  receita: ["receita", 2],
  consentimentoReceita: ["consentimentoReceita", 2],
  "consentimentoReceita.aceito": ["consentimentoReceita", 2],
  unidade: ["unidade", 3],
  nome: ["nome", 3],
  telefone: ["telefone", 3],
  email: ["email", 3],
  "detalhes.observacoes": ["observacoes", 3],
  consentimento: ["consentimentoContato", 3],
  "consentimento.aceito": ["consentimentoContato", 3],
};

export default function FluxoGrau({ aberto, onFechar, produto }: FluxoGrauProps) {
  const [etapa, setEtapa] = useState(0);
  const etapaRef = useRef(0);
  etapaRef.current = etapa;
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<(RespostaLead & { receitaDepois: boolean }) | null>(null);
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const entradaArquivo = useRef<HTMLInputElement>(null);

  const resolver: Resolver<ValoresGrau> = (valores, ctx, opcoes) =>
    (zodResolver(ESQUEMAS[etapaRef.current], undefined, { raw: true }) as unknown as Resolver<ValoresGrau>)(valores, ctx, opcoes);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<ValoresGrau>({ resolver, defaultValues: VAZIO, shouldFocusError: true });

  const valores = watch();

  // Depois do pedido concluído, fechar zera o fluxo; fechar no meio guarda o que já foi preenchido.
  useEffect(() => {
    if (aberto || !resultado) return;
    const t = setTimeout(() => {
      reset(VAZIO);
      setResultado(null);
      setEtapa(0);
      setErroEnvio(null);
    }, 250);
    return () => clearTimeout(t);
  }, [aberto, resultado, reset]);

  // A cada etapa (não na abertura, que o Painel cuida), o foco vai para o título da etapa e o corpo volta ao topo.
  const primeiraEtapa = useRef(true);
  useEffect(() => {
    if (!aberto) {
      primeiraEtapa.current = true;
      return;
    }
    if (primeiraEtapa.current) {
      primeiraEtapa.current = false;
      return;
    }
    const corpo = tituloEtapa.current?.closest("[data-painel-corpo]");
    corpo?.scrollTo({ top: 0 });
    tituloEtapa.current?.focus({ preventScroll: true });
  }, [etapa, aberto, resultado]);

  const corpoDoPainel = () => tituloEtapa.current?.closest("[data-painel-corpo]");

  const avancar = async () => {
    setErroEnvio(null);
    if (await trigger()) setEtapa(e => Math.min(e + 1, ETAPAS.length - 1));
    else rolarParaPrimeiroErro(corpoDoPainel());
  };
  const voltar = () => {
    clearErrors();
    setErroEnvio(null);
    setEtapa(e => Math.max(0, e - 1));
  };

  const alternarTratamento = (t: Tratamento) => {
    const atual = valores.tratamentos;
    let proximo: Tratamento[];
    if (t === "nenhum") proximo = atual.includes("nenhum") ? [] : ["nenhum"];
    else proximo = atual.includes(t) ? atual.filter(x => x !== t) : [...atual.filter(x => x !== "nenhum"), t];
    setValue("tratamentos", proximo);
  };

  const escolherArquivo = (f: File | null) => {
    setValue("receita", f, { shouldValidate: Boolean(errors.receita) || Boolean(f) });
    if (!f && entradaArquivo.current) entradaArquivo.current.value = "";
  };

  const enviar = async (v: ValoresGrau) => {
    setEnviando(true);
    setErroEnvio(null);
    const comReceita = v.receitaModo === "agora" && v.receita;
    const dados = {
      tipo: "orcamento_grau",
      nome: v.nome.trim(),
      telefone: v.telefone,
      email: v.email.trim() || undefined,
      unidade: v.unidade,
      produtoSlug: produto?.slug,
      detalhes: {
        usoPrincipal: v.usoPrincipal,
        tratamentosDesejados: v.tratamentos,
        jaUsaMultifocal: v.jaUsaMultifocal ? v.jaUsaMultifocal === "sim" : undefined,
        receitaDepois: v.receitaModo === "depois",
        observacoes: v.observacoes.trim() || undefined,
      },
      consentimento: { aceito: true, versao: CONSENTIMENTO_CONTATO.versao },
      consentimentoReceita: comReceita ? { aceito: true, versao: CONSENTIMENTO_RECEITA.versao } : undefined,
      website: v.website,
    };
    try {
      const r = await enviarLead(dados, comReceita ? v.receita : null);
      setResultado({ ...r, receitaDepois: !comReceita });
    } catch (e) {
      const erro = e instanceof ErroLead ? e : new ErroLead("Não foi possível enviar agora.");
      let etapaDoErro: number | null = null;
      for (const [campo, mensagem] of Object.entries(erro.campos)) {
        const alvo = CAMPO_DO_SERVIDOR[campo];
        if (!alvo) continue;
        setError(alvo[0], { type: "server", message: mensagem });
        etapaDoErro = etapaDoErro === null ? alvo[1] : Math.min(etapaDoErro, alvo[1]);
      }
      if (etapaDoErro !== null && etapaDoErro !== etapaRef.current) setEtapa(etapaDoErro);
      setErroEnvio(erro.message);
      rolarParaPrimeiroErro(corpoDoPainel());
    } finally {
      setEnviando(false);
    }
  };

  const unidadeEscolhida = UNIDADES.find(u => u.slug === valores.unidade);

  const rodape = resultado ? (
    <div className="flex justify-end">
      <button type="button" onClick={onFechar} className="btn-line w-full sm:w-auto">
        Fechar
      </button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {etapa > 0 ? (
        <button type="button" onClick={voltar} className="btn-line">
          Voltar
        </button>
      ) : (
        <p className="text-[0.9rem] text-sr-ink-soft">Nada é cobrado antes da conferência da receita.</p>
      )}
      {etapa < ETAPAS.length - 1 ? (
        <button type="button" onClick={avancar} className="btn-ink">
          Continuar
        </button>
      ) : (
        <button type="submit" form="fluxo-grau" disabled={enviando} className="btn-ink">
          {enviando ? "Enviando…" : "Pedir orçamento"}
        </button>
      )}
    </div>
  );

  return (
    <Painel
      aberto={aberto}
      onFechar={onFechar}
      chapeu={produto ? "Comprar com lentes de grau" : "Lentes de grau"}
      titulo="Orçamento de lentes"
      descricao="Conte como vai usar os óculos, envie a receita e receba o orçamento conferido pela consultora no WhatsApp."
      rodape={rodape}
    >
      {resultado ? (
        <>
          <h3 ref={tituloEtapa} tabIndex={-1} className="sr-only">
            Pedido recebido
          </h3>
          <Confirmacao
            protocolo={resultado.protocolo}
            whatsappUrl={resultado.whatsappUrl}
            passos={[
              "A consultora confere a receita e te manda o orçamento pelo WhatsApp. Nada é cobrado antes.",
              resultado.receitaDepois
                ? "Quando tiver a receita em mãos, mande a foto no WhatsApp junto com o protocolo."
                : "Se precisar de alguma medida a mais, a consultora pede por lá mesmo.",
              "Você aprova o orçamento e combina a retirada ou a entrega. O prazo do laboratório vem no orçamento.",
            ]}
          />
        </>
      ) : (
        <form id="fluxo-grau" onSubmit={handleSubmit(enviar, () => rolarParaPrimeiroErro(corpoDoPainel()))} noValidate className="relative">
          <Etapas nomes={ETAPAS} atual={etapa} />
          {produto ? (
            <EtiquetaProduto produto={produto} nota="lentes no orçamento" />
          ) : null}
          <Armadilha {...register("website")} />

          {etapa === 0 && (
            <section aria-labelledby="grau-titulo-0" className="space-y-7">
              <div>
                <h3 id="grau-titulo-0" ref={tituloEtapa} tabIndex={-1} className="font-display text-xl font-light outline-none">
                  Como você vai usar estes óculos?
                </h3>
                <p className="mt-2 text-[0.95rem] text-sr-ink-soft">
                  É uma preferência sua, não uma escolha de lente. Quem define a lente é a consultora, com a sua receita em mãos.
                </p>
              </div>
              <Grupo legenda="Uso principal" id="grau-uso" erro={errors.usoPrincipal?.message}>
                <div className="grid gap-2">
                  {USOS.map(u => (
                    <Opcao key={u.valor} tipo="radio" value={u.valor} titulo={u.titulo} nota={u.nota} {...register("usoPrincipal")} />
                  ))}
                </div>
              </Grupo>
              <Grupo legenda="Você já usa óculos multifocal?" ajuda="Opcional — ajuda a consultora a conversar com você." id="grau-multifocal">
                <div className="flex flex-wrap gap-2">
                  <Chip titulo="Sim" value="sim" {...register("jaUsaMultifocal")} />
                  <Chip titulo="Não" value="nao" {...register("jaUsaMultifocal")} />
                </div>
              </Grupo>
            </section>
          )}

          {etapa === 1 && (
            <section aria-labelledby="grau-titulo-1" className="space-y-7">
              <div>
                <h3 id="grau-titulo-1" ref={tituloEtapa} tabIndex={-1} className="font-display text-xl font-light outline-none">
                  Algum tratamento que você gostaria de ver no orçamento?
                </h3>
                <p className="mt-2 text-[0.95rem] text-sr-ink-soft">
                  Marque quantos quiser, ou nenhum. A consultora confere com a receita o que faz sentido para você e mostra as opções.
                </p>
              </div>
              <Grupo legenda="Tratamentos" id="grau-tratamentos" erro={errors.tratamentos?.message}>
                <div className="grid gap-2">
                  {TRATAMENTOS.map(t => (
                    <Opcao
                      key={t.valor}
                      tipo="checkbox"
                      name="tratamentos"
                      value={t.valor}
                      titulo={t.titulo}
                      nota={t.nota}
                      checked={valores.tratamentos.includes(t.valor)}
                      onChange={() => alternarTratamento(t.valor)}
                    />
                  ))}
                  <Opcao
                    tipo="checkbox"
                    name="tratamentos"
                    value="nenhum"
                    titulo="Nenhum por enquanto"
                    nota="Prefiro ver as opções junto com o orçamento."
                    checked={valores.tratamentos.includes("nenhum")}
                    onChange={() => alternarTratamento("nenhum")}
                  />
                </div>
              </Grupo>
            </section>
          )}

          {etapa === 2 && (
            <section aria-labelledby="grau-titulo-2" className="space-y-7">
              <div>
                <h3 id="grau-titulo-2" ref={tituloEtapa} tabIndex={-1} className="font-display text-xl font-light outline-none">
                  E a receita?
                </h3>
                <p className="mt-2 text-[0.95rem] text-sr-ink-soft">
                  Com a receita, a consultora confere as medidas e fecha o orçamento. Se ainda vai ao oftalmologista, pode mandar depois.
                </p>
              </div>
              <Grupo legenda="Envio da receita" id="grau-receita-modo" erro={errors.receitaModo?.message}>
                <div className="grid gap-2">
                  <Opcao tipo="radio" value="agora" titulo="Enviar agora" nota="Foto ou PDF, até 8 MB." {...register("receitaModo")} />
                  <Opcao
                    tipo="radio"
                    value="depois"
                    titulo="Envio depois"
                    nota="Ainda vou ao oftalmologista, ou mando a receita pelo WhatsApp."
                    {...register("receitaModo")}
                  />
                </div>
              </Grupo>

              {valores.receitaModo === "agora" && (
                <div className="space-y-6 border-l border-sr-nude-300 pl-4 md:pl-5">
                  <div>
                    <p className="font-medium text-sr-ink">Arquivo da receita</p>
                    <p className="text-[0.9rem] text-sr-ink-soft">JPG, PNG, WEBP, HEIC (foto do iPhone) ou PDF. Receita inteira, legível, com a data.</p>
                    <input
                      ref={entradaArquivo}
                      id="grau-receita"
                      type="file"
                      accept={ACCEPT_RECEITA}
                      className="sr-only"
                      aria-invalid={errors.receita ? true : undefined}
                      aria-describedby={errors.receita ? "grau-receita-erro" : undefined}
                      onChange={e => escolherArquivo(e.target.files?.[0] ?? null)}
                    />
                    {valores.receita ? (
                      <div className="mt-3 flex items-center gap-3 border border-sr-ink bg-white px-4 py-3">
                        <FileText size={20} className="shrink-0 text-sr-nude-600" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.95rem] text-sr-ink">{valores.receita.name}</p>
                          <p className="dado text-sm text-sr-ink-soft">{tamanhoLegivel(valores.receita.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => escolherArquivo(null)}
                          className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-sr-ink-soft hover:text-sr-ink"
                        >
                          <X size={16} aria-hidden /> Trocar
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="grau-receita"
                        className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-sr-nude-500 bg-white px-4 py-5 text-center transition-colors hover:border-sr-ink"
                      >
                        <Paperclip size={20} className="text-sr-nude-600" aria-hidden />
                        <span className="nav-label text-sr-ink">Escolher foto ou PDF</span>
                        <span className="text-[0.85rem] text-sr-ink-soft">No celular, dá para tirar a foto na hora.</span>
                      </label>
                    )}
                    <Erro id="grau-receita-erro" mensagem={errors.receita?.message as string | undefined} />
                  </div>

                  <Consentimento
                    id="grau-consent-receita"
                    texto={CONSENTIMENTO_RECEITA.texto}
                    erro={errors.consentimentoReceita?.message}
                    {...register("consentimentoReceita")}
                  />
                </div>
              )}
            </section>
          )}

          {etapa === 3 && (
            <section aria-labelledby="grau-titulo-3" className="space-y-7">
              <div>
                <h3 id="grau-titulo-3" ref={tituloEtapa} tabIndex={-1} className="font-display text-xl font-light outline-none">
                  Para onde mandamos o orçamento?
                </h3>
                <p className="mt-2 text-[0.95rem] text-sr-ink-soft">A consultora responde pelo WhatsApp.</p>
              </div>

              <Grupo legenda="Loja que vai te atender" id="grau-unidade" erro={errors.unidade?.message}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {UNIDADES.map(u => (
                    <Opcao
                      key={u.slug}
                      tipo="radio"
                      value={u.slug}
                      titulo={u.rotulo}
                      nota={u.complemento ? `${u.logradouro} · ${u.complemento}` : u.logradouro}
                      {...register("unidade")}
                    />
                  ))}
                </div>
              </Grupo>

              <div className="grid gap-5">
                <CampoTexto id="grau-nome" rotulo="Nome" autoComplete="name" erro={errors.nome?.message} {...register("nome")} />
                <CampoTexto
                  id="grau-telefone"
                  rotulo="WhatsApp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(16) 99999-9999"
                  erro={errors.telefone?.message}
                  {...register("telefone", { onChange: e => setValue("telefone", mascararTelefone(e.target.value)) })}
                />
                <CampoTexto
                  id="grau-email"
                  rotulo="E-mail"
                  opcional
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  erro={errors.email?.message}
                  {...register("email")}
                />
                <CampoArea
                  id="grau-obs"
                  rotulo="Quer contar mais alguma coisa?"
                  opcional
                  placeholder="Ex.: uso óculos há anos, trabalho muitas horas no computador…"
                  erro={errors.observacoes?.message}
                  {...register("observacoes")}
                />
              </div>

              <Consentimento
                id="grau-consent-contato"
                texto={CONSENTIMENTO_CONTATO.texto}
                complemento={
                  <Link href="/privacidade" className="text-sr-ink underline underline-offset-2">
                    Política de privacidade
                  </Link>
                }
                erro={errors.consentimentoContato?.message}
                {...register("consentimentoContato")}
              />

              <div className="bg-sr-sand px-4 py-4 text-[0.95rem] leading-relaxed text-sr-ink">
                {unidadeEscolhida ? `A consultora de ${unidadeEscolhida.rotulo}` : "A consultora"} confere a receita e define a lente
                adequada. Você recebe o orçamento pelo WhatsApp e só paga se aprovar.
              </div>

              <ErroEnvio mensagem={erroEnvio} />
            </section>
          )}
          {etapa < 3 && <ErroEnvio mensagem={erroEnvio} />}
        </form>
      )}
    </Painel>
  );
}
