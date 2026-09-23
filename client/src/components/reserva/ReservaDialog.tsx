/**
 * Reservar a armação para experimentar numa das lojas.
 *
 * Não é compra nem cobrança: vira um lead com protocolo, a loja separa a peça e
 * confirma pelo WhatsApp. A reserva vale 48 horas.
 */
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { UNIDADES, type UnidadeSlug } from "@shared/unidades";
import type { ProdutoGrau } from "@/components/grau/FluxoGrau";
import { enviarLead, ErroLead, type RespostaLead } from "@/components/grau/api";
import { CONSENTIMENTO_CONTATO } from "@/components/grau/consentimentos";
import { PERIODOS, QUANDO, SLUGS_UNIDADE, mascararTelefone, telefoneValido } from "@/components/grau/regras";
import {
  Armadilha,
  CampoArea,
  CampoTexto,
  Chip,
  Confirmacao,
  Consentimento,
  ErroEnvio,
  EtiquetaProduto,
  Grupo,
  Opcao,
  Painel,
  rolarParaPrimeiroErro,
} from "@/components/grau/ui";

export interface ReservaDialogProps {
  aberto: boolean;
  onFechar: () => void;
  produto: ProdutoGrau;
  /** Unidades com saldo, para pré-selecionar. */
  unidadesDisponiveis?: string[];
}

const escolha = (message: string) => ({ errorMap: () => ({ message }) });

const esquema = z.object({
  unidade: z.enum(SLUGS_UNIDADE, escolha("Escolha a loja onde quer experimentar.")),
  quando: z.enum(QUANDO.map(q => q.valor) as ["hoje", "amanha", "esta_semana", "combinar"], escolha("Escolha quando quer ir à loja.")),
  periodo: z.string(),
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome: até 120 caracteres."),
  telefone: z.string().refine(telefoneValido, "Informe o WhatsApp com DDD, ex.: (16) 99195-1430."),
  observacoes: z.string().max(1000, "Até 1000 caracteres."),
  consentimentoContato: z.literal(true, escolha("Marque a autorização para a loja te responder.")),
  website: z.string(),
});

interface ValoresReserva {
  unidade: UnidadeSlug | null;
  quando: string | null;
  periodo: string;
  nome: string;
  telefone: string;
  observacoes: string;
  consentimentoContato: boolean;
  website: string;
}

function valoresIniciais(disponiveis?: string[]): ValoresReserva {
  const comSaldo = disponiveis?.find((s): s is UnidadeSlug => (SLUGS_UNIDADE as string[]).includes(s));
  return {
    unidade: comSaldo ?? null,
    quando: null,
    periodo: "",
    nome: "",
    telefone: "",
    observacoes: "",
    consentimentoContato: false,
    website: "",
  };
}

const CAMPO_DO_SERVIDOR: Record<string, keyof ValoresReserva> = {
  unidade: "unidade",
  "detalhes.quando": "quando",
  "detalhes.periodo": "periodo",
  nome: "nome",
  telefone: "telefone",
  "detalhes.observacoes": "observacoes",
  consentimento: "consentimentoContato",
  "consentimento.aceito": "consentimentoContato",
};

export default function ReservaDialog({ aberto, onFechar, produto, unidadesDisponiveis }: ReservaDialogProps) {
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespostaLead | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ValoresReserva>({
    resolver: zodResolver(esquema, undefined, { raw: true }) as any,
    defaultValues: valoresIniciais(unidadesDisponiveis),
  });

  const unidade = watch("unidade");
  // A página costuma passar um array novo a cada render: os efeitos dependem do conteúdo, não da referência.
  const chaveDisponiveis = (unidadesDisponiveis ?? []).join(",");

  // Saldo chegou depois de abrir (consulta assíncrona na página do produto): pré-seleciona se ainda vazio.
  useEffect(() => {
    if (!getValues("unidade")) {
      const inicial = valoresIniciais(chaveDisponiveis.split(",")).unidade;
      if (inicial) setValue("unidade", inicial);
    }
  }, [chaveDisponiveis, getValues, setValue]);

  // Fechar depois de concluir zera o formulário para a próxima reserva.
  useEffect(() => {
    if (aberto || !resultado) return;
    const t = setTimeout(() => {
      reset(valoresIniciais(chaveDisponiveis.split(",")));
      setResultado(null);
      setErroEnvio(null);
    }, 250);
    return () => clearTimeout(t);
  }, [aberto, resultado, reset, chaveDisponiveis]);

  useEffect(() => {
    if (resultado) titulo.current?.focus({ preventScroll: true });
  }, [resultado]);

  const unidadeEscolhida = UNIDADES.find(u => u.slug === unidade);

  const enviar = async (v: ValoresReserva) => {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarLead({
        tipo: "reserva",
        nome: v.nome.trim(),
        telefone: v.telefone,
        unidade: v.unidade,
        produtoSlug: produto.slug,
        detalhes: {
          quando: v.quando,
          periodo: v.periodo || undefined,
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

  const disponiveis = unidadesDisponiveis ?? null;

  return (
    <Painel
      aberto={aberto}
      onFechar={onFechar}
      chapeu="Reservar para experimentar"
      titulo="Experimente na loja"
      descricao="Reserve esta armação para experimentar numa das lojas Sanrê. A loja confirma pelo WhatsApp."
      rodape={
        resultado ? (
          <div className="flex justify-end">
            <button type="button" onClick={onFechar} className="btn-line w-full sm:w-auto">
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.9rem] text-sr-ink-soft">Reservar não tem custo.</p>
            <button type="submit" form="form-reserva" disabled={enviando} className="btn-ink">
              {enviando ? "Enviando…" : "Reservar"}
            </button>
          </div>
        )
      }
    >
      {resultado ? (
        <>
          <h3 ref={titulo} tabIndex={-1} className="sr-only">
            Reserva pedida
          </h3>
          <Confirmacao
            titulo="Reserva recebida"
            protocolo={resultado.protocolo}
            whatsappUrl={resultado.whatsappUrl}
            passos={[
              `A loja${unidadeEscolhida ? ` de ${unidadeEscolhida.rotulo}` : ""} separa a armação e confirma a reserva pelo WhatsApp.`,
              "A reserva vale 48 horas a partir da confirmação.",
              "Na loja, é só dizer o protocolo. Se quiser lente de grau, leve a receita.",
            ]}
          />
        </>
      ) : (
        <form id="form-reserva" ref={formulario} onSubmit={handleSubmit(enviar, () => rolarParaPrimeiroErro(formulario.current))} noValidate className="relative space-y-7">
          <EtiquetaProduto produto={produto} />
          <Armadilha {...register("website")} />

          <p className="text-[0.95rem] text-sr-ink-soft">
            A loja separa a armação para você experimentar. A reserva vale 48 horas e a confirmação chega pelo WhatsApp.
          </p>

          <Grupo legenda="Em qual loja?" id="reserva-unidade" erro={errors.unidade?.message}>
            <div className="grid gap-2 sm:grid-cols-2">
              {UNIDADES.map(u => {
                const temSaldo = disponiveis?.includes(u.slug);
                return (
                  <Opcao
                    key={u.slug}
                    tipo="radio"
                    value={u.slug}
                    titulo={u.rotulo}
                    nota={u.complemento ? `${u.logradouro} · ${u.complemento}` : u.logradouro}
                    extra={
                      disponiveis ? (
                        <span className={`mt-1.5 block font-display text-[0.6875rem] font-medium uppercase tracking-[0.2em] ${temSaldo ? "text-sr-ok" : "text-sr-nude-600"}`}>
                          {temSaldo ? "Disponível nesta loja" : "Sob consulta"}
                        </span>
                      ) : null
                    }
                    {...register("unidade")}
                  />
                );
              })}
            </div>
          </Grupo>

          <Grupo legenda="Quando você quer ir?" id="reserva-quando" erro={errors.quando?.message}>
            <div className="flex flex-wrap gap-2">
              {QUANDO.map(q => (
                <Chip key={q.valor} titulo={q.titulo} value={q.valor} {...register("quando")} />
              ))}
            </div>
          </Grupo>

          <Grupo legenda="Período" id="reserva-periodo" ajuda="A loja confirma o horário com você.">
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map(p => (
                <Chip key={p.valor || "qualquer"} titulo={p.titulo} value={p.valor} {...register("periodo")} />
              ))}
            </div>
          </Grupo>

          <div className="grid gap-5">
            <CampoTexto id="reserva-nome" rotulo="Nome" autoComplete="name" erro={errors.nome?.message} {...register("nome")} />
            <CampoTexto
              id="reserva-telefone"
              rotulo="WhatsApp"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(16) 99999-9999"
              erro={errors.telefone?.message}
              {...register("telefone", { onChange: e => setValue("telefone", mascararTelefone(e.target.value)) })}
            />
            <CampoArea
              id="reserva-obs"
              rotulo="Observações"
              opcional
              placeholder="Ex.: quero comparar com outra cor do mesmo modelo."
              erro={errors.observacoes?.message}
              {...register("observacoes")}
            />
          </div>

          <Consentimento
            id="reserva-consent"
            texto={CONSENTIMENTO_CONTATO.texto}
            complemento={
              <Link href="/privacidade" className="text-sr-ink underline underline-offset-2">
                Política de privacidade
              </Link>
            }
            erro={errors.consentimentoContato?.message}
            {...register("consentimentoContato")}
          />

          <ErroEnvio mensagem={erroEnvio} />
        </form>
      )}
    </Painel>
  );
}
