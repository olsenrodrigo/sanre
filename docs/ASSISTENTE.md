# Assistente Sanrê no site — contrato com o agente

O site tem uma caixa de conversa ("Fale com a Sanrê") que fala com o **mesmo agente de IA que
atende no WhatsApp** — agente que será construído na plataforma da Sintetiza. Este documento é o
contrato entre o site e esse agente: o que o site manda, o que ele aceita de volta, como assina,
o que faz quando o agente falha e como a conversa passa para o WhatsApp sem a cliente repetir tudo.

```
navegador (widget)                    servidor do site                         agente (Sintetiza)
 ─────────────────                    ────────────────                         ──────────────────
 POST /api/assistente/mensagens ──►   valida (zod), rate limit
                                      ├─ ASSISTENTE_URL definido? ── POST assinado (HMAC) ──►  responde
                                      │                             ◄── { respostas, transbordo? }
                                      │   ok e no contrato → modo "agente"
                                      └─ sem agente / falha / fora do contrato → modo "roteiro"
 ◄── { modo, respostas[], transbordo? }
 "Continuar no WhatsApp" ─────────────────────────────────────────────────►  wa.me com "[site:1a2b3c4d]"
```

Código: `server/assistente/**` (API, adaptador, roteiro) e `client/src/components/assistente/**`
(widget). Tipos do contrato e o formato da mensagem do WhatsApp ficam num módulo puro usado pelos
dois lados: `client/src/components/assistente/protocolo.ts`.

---

## 1. Configuração

| Variável | Padrão | O que faz |
|---|---|---|
| `ASSISTENTE_URL` | — | URL do agente (POST). Sem ela, o site responde só pelo roteiro. |
| `ASSISTENTE_TOKEN` | — | Segredo do HMAC. **Obrigatório com a URL**: sem token o site não encaminha (loga um aviso e fica no roteiro). |
| `ASSISTENTE_TIMEOUT_MS` | `20000` | Tempo máximo esperando o agente (aceita 500 a 120000). |
| `ASSISTENTE_ATIVO` | ligado | `0`/`false` esconde o widget e desliga a rota (503). |
| `ASSISTENTE_LIMITE_IP` | `20` | Mensagens por minuto por IP. |
| `ASSISTENTE_LIMITE_SESSAO` | `10` | Mensagens por minuto por sessão. |
| `PUBLIC_URL` | Host da requisição | Domínio usado no link do produto dentro da mensagem do WhatsApp. |

`ASSISTENTE_URL` deve ser `https` em produção. As variáveis são lidas no boot (reinicie o PM2 ao trocar).

---

## 2. API pública do site (navegador → site)

### `GET /api/assistente/config`

```json
{ "ativo": true, "modo": "roteiro", "whatsapp": "5516991951430" }
```

`modo` é `"agente"` quando URL e token estão configurados.

### `POST /api/assistente/mensagens`

Entrada (validada com zod — `server/assistente/contrato.ts`):

```jsonc
{
  "sessaoId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", // UUID v4 gerado no navegador (localStorage)
  "texto": "Tem esse com lente polarizada?",           // 1 a 800 caracteres
  "contexto": {                                       // opcional
    "pagina": "/loja/produto/ray-ban-aviator-classic-rb3025", // só caminho, sem query string
    "produto": {                                      // só na página do produto
      "slug": "ray-ban-aviator-classic-rb3025",
      "titulo": "Ray-Ban Aviator Classic RB3025",
      "marca": "Ray-Ban",
      "preco": "899.00",                              // informativo — ver "Preço" abaixo
      "imagem": "/uploads/produtos/rb3025.webp"
    },
    "unidade": "ribeirao-preto"                       // "cravinhos" | "ribeirao-preto"
  }
}
```

Saída (a mesma forma para roteiro e agente):

```jsonc
{
  "modo": "agente",            // "agente" | "roteiro" — quem respondeu de fato
  "respostas": [               // 1 a 12 blocos, exibidos em ordem
    { "tipo": "texto", "texto": "Encontrei estes modelos…" },
    { "tipo": "produtos", "itens": [
      { "slug": "ray-ban-aviator-classic-rb3025", "titulo": "Ray-Ban Aviator Classic RB3025",
        "marca": "Ray-Ban", "preco": 899, "imagem": "/uploads/produtos/rb3025.webp" }
    ]},
    { "tipo": "acoes", "acoes": [
      { "rotulo": "Ver na vitrine", "href": "/loja?marca=Ray-Ban&formato=aviador" },
      { "rotulo": "Formas de pagamento", "enviar": "Quais as formas de pagamento?" }
    ]}
  ],
  "transbordo": {              // opcional: mostra o botão "Continuar no WhatsApp"
    "whatsappUrl": "https://wa.me/5516991951430?text=…",
    "motivo": "cliente_pediu"
  }
}
```

Erros:

| Status | Corpo | Quando |
|---|---|---|
| 400 | `{ erro: "entrada_invalida", mensagem, campos: ["texto"] }` | Fora do esquema. Só o caminho dos campos volta, nunca o valor. |
| 429 | `{ erro: "limite", mensagem, tentarEmSegundos, whatsappUrl }` + `Retry-After` | Passou de 20/min por IP ou 10/min por sessão. Mensagem recusada não conta. |
| 503 | `{ erro: "desativado" }` | `ASSISTENTE_ATIVO=0`. |
| 500 | `{ erro: "interno", mensagem }` | A resposta montada saiu do contrato (bug do roteiro). |

---

## 3. Contrato com o agente externo (site → agente)

### 3.1 Requisição

```
POST {ASSISTENTE_URL}
Content-Type: application/json; charset=utf-8
Accept: application/json
User-Agent: SanreSite-Assistente/1.0
X-Sanre-Assinatura: sha256=<hex>
```

```json
{
  "canal": "site",
  "sessaoId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "texto": "Tem esse com lente polarizada?",
  "contexto": {
    "pagina": "/loja/produto/ray-ban-aviator-classic-rb3025",
    "produto": { "slug": "ray-ban-aviator-classic-rb3025", "titulo": "Ray-Ban Aviator Classic RB3025",
                 "marca": "Ray-Ban", "preco": "899.00", "imagem": "/uploads/produtos/rb3025.webp" },
    "unidade": "ribeirao-preto"
  },
  "enviadoEm": "2026-09-22T21:14:03.120Z"
}
```

- `contexto` sempre vem (no mínimo `{}`); campos já validados pelo site.
- **Uma mensagem = uma chamada.** O site não guarda a conversa no servidor nem manda histórico:
  o agente mantém o próprio histórico por `sessaoId`. Mensagens respondidas pelo roteiro (agente
  fora do ar, disjuntor aberto, dado sensível) **não chegam** ao agente.
- O site não repete a chamada. Se a cliente tocar "Tentar de novo", chega uma chamada nova com o
  mesmo texto — trate duplicata próxima como normal.

### 3.2 Assinatura

`X-Sanre-Assinatura` = `sha256=` + HMAC-SHA256 (hex minúsculo) **dos bytes exatos do corpo**, com
`ASSISTENTE_TOKEN` como chave. O agente deve:

1. calcular o HMAC sobre o corpo cru, **antes** de fazer parse do JSON;
2. comparar em tempo constante;
3. recusar `enviadoEm` com mais de 5 minutos de diferença (reenvio de requisição capturada);
4. responder 401 se a assinatura não bater (o site cai no roteiro e loga `status_http 401`).

Node:

```js
import { createHmac, timingSafeEqual } from "node:crypto";
function assinaturaValida(corpoCru, header, token) {
  const esperado = "sha256=" + createHmac("sha256", token).update(corpoCru).digest("hex");
  const a = Buffer.from(String(header ?? "")), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Python:

```python
import hmac, hashlib
def assinatura_valida(corpo_cru: bytes, header: str, token: str) -> bool:
    esperado = "sha256=" + hmac.new(token.encode(), corpo_cru, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, header or "")
```

### 3.3 Resposta do agente

HTTP 200, JSON, **até 256 KB**, dentro de `ASSISTENTE_TIMEOUT_MS`:

```jsonc
{
  "respostas": [ /* 1 a 12 blocos — mesmo formato da seção 2 */ ],
  "transbordo": { "whatsappUrl": "https://wa.me/5516991951430?text=…", "motivo": "orcamento_grau" }
}
```

Regras que o site confere (resposta fora delas é descartada inteira e o roteiro responde):

| Bloco | Regra |
|---|---|
| `texto` | 1 a 4000 caracteres. Texto puro (sem HTML/Markdown); `\n` vira quebra de linha. |
| `produtos` | 1 a 8 itens (o widget mostra 4). `slug` `[a-z0-9-]`; `preco` número em reais (ou string `"899.00"`) ou `null`; `imagem` caminho do site, `https:` ou `data:image/…`, ou `null`. |
| `acoes` | 1 a 6 por bloco. `rotulo` até 60 caracteres. **Exatamente um** de `href` ou `enviar`. `href` é caminho do site (`/lentes-de-grau`) ou URL `https:` — `javascript:`, `data:`, `http:` e `//host` são recusados. `enviar` (até 800) é mandado como se a cliente tivesse digitado. |
| `transbordo` | `whatsappUrl` começando com `https://wa.me/` ou `https://api.whatsapp.com/`; `motivo` até 120 caracteres (código curto). |
| `modo` | Ignorado — resposta aceita do agente sempre sai como `"agente"`. |

Links internos úteis: `/loja?tipo=&marca=&formato=&publico=&lente=&min=&max=&busca=`,
`/loja/produto/<slug>`, `/oculos-de-sol`, `/oculos-de-grau`, `/infantil`, `/epi`, `/marcas`,
`/marcas/<slug>`, `/unidades/<slug>`, `/lentes-de-grau`, `/provador`, `/empresas`,
`/trocas-e-devolucoes`, `/loja/carrinho`.

### 3.4 Falhas e disjuntor

| Tipo (log) | Quando |
|---|---|
| `timeout` | Passou de `ASSISTENTE_TIMEOUT_MS` (conexão ou leitura). |
| `rede` | DNS, conexão recusada, TLS, redirecionamento (o site não segue redirect). |
| `status_http <n>` | Resposta não-2xx (401 de assinatura inclusive). |
| `resposta_grande` | Corpo acima de 256 KB. |
| `json_invalido` | Corpo não é JSON. |
| `contrato_invalido` | JSON fora das regras da 3.3. |
| `disjuntor_aberto` | 3 falhas seguidas abrem o disjuntor: por 60 s o site nem chama o agente. |

Em todos os casos a cliente recebe a resposta do roteiro, sem mensagem de erro. O log registra
**só** o tipo e a latência — nunca o texto (`[assistente] agente falhou (timeout) em 20003ms`).

### 3.5 O que o agente precisa respeitar (mesmas regras do roteiro)

- **Decreto 24.492/1934, art. 13**: não indicar tipo de lente nem grau. A consultora monta o
  orçamento seguindo a receita do oftalmologista.
- **Receita é dado de saúde**: não pedir para colar receita no chat do site. Envio seguro é o fluxo
  `/lentes-de-grau` ou o WhatsApp (onde o agente lê a foto com conferência humana). O site já
  bloqueia no navegador — e não encaminha ao agente — mensagens que parecem receita (OD/OE com
  grau, esférico, cilíndrico, eixo, DNP, adição), CPF ou número de cartão.
- **Horário**: só informar se `horarioConfirmado` for true em `shared/unidades.ts`. Hoje nenhum é.
- **Preço com fonte**: o `preco` do `contexto` vem do navegador e é só informativo; o preço dito à
  cliente vem do catálogo (SS Ótica / banco). Não prometer estoque nem prazo sem dado.
- Tom: português do Brasil, cordial, curto, sem emoji, sem exagero ("Equipe Sanrê").

---

## 4. Passagem para o WhatsApp

Todo link de WhatsApp gerado pelo site (botão do cabeçalho, chips "Falar com a consultora",
bloco "Continuar no WhatsApp", avisos) abre `wa.me/5516991951430` com uma mensagem pronta, numa
linha só:

```
Olá! Vim pelo site da Sanrê. [site:<8 hex>] Estou vendo o <título> (<host>/loja/produto/<slug>). <resumo> Prefiro a loja de <cidade>.
```

| Parte | Sempre? | Conteúdo |
|---|---|---|
| `Olá! Vim pelo site da Sanrê.` | sim | Abertura fixa. |
| `[site:1a2b3c4d]` | sim | 8 primeiros hex do `sessaoId` (minúsculos). |
| `Estou vendo o … (…).` | se houver produto | Título e link do produto aberto quando a conversa passou. |
| resumo | quase sempre | `Minha dúvida: <última pergunta>.` (até 160 caracteres, sem quebra; sequências de 6+ dígitos viram `[número]` e e-mails viram `[e-mail]`) **ou** frase pronta: `Quero falar com uma consultora.`, `Quero um orçamento de lentes de grau.`, `Quero confirmar o horário da loja de Ribeirão Preto.`, `Sou de uma empresa e quero uma proposta de óculos de segurança (EPI).`, `Procuro um modelo que não encontrei no site.`, `Quero falar sobre troca, devolução ou garantia.` Sem produto e sem dúvida: `Quero tirar uma dúvida.` |
| `Prefiro a loja de <cidade>.` | se a cliente escolheu unidade | `Cravinhos` ou `Ribeirão Preto`. |

Exemplo real (modo roteiro):

```
Olá! Vim pelo site da Sanrê. [site:22222222] Estou vendo o Ray-Ban Aviator Classic RB3025 (oticasanre.com.br/loja/produto/ray-ban-aviator-classic-rb3025). Minha dúvida: esse é polarizado? Prefiro a loja de Ribeirão Preto.
```

Como o agente reconhece e usa:

```js
const etiqueta = /\[site:([0-9a-f]{8})\]/;            // sessão do site
const produto  = /\/loja\/produto\/([a-z0-9-]+)\)/;   // slug do produto
const duvida   = /Minha dúvida: (.+?)(?: Prefiro a loja de |$)/;
const unidade  = /Prefiro a loja de (Cravinhos|Ribeirão Preto)\./;
```

1. Achou `[site:xxxxxxxx]`: procure, entre as sessões `canal: "site"` dos últimos 7 dias, a que
   tem `sessaoId` começando por esses 8 hex (sem hífen). Achou → continue a conversa com aquele
   histórico e ligue o contato do WhatsApp à sessão. Não achou (a conversa foi toda no modo
   roteiro, então o agente nunca a recebeu) → use só o que está na mensagem: produto pelo slug,
   dúvida, unidade.
2. A mensagem é editável pela cliente antes de enviar: trate tudo como pista, não como prova de
   identidade. Não recite de volta o conteúdo da conversa do site; continue a partir dele.
3. `motivo` do transbordo (quando veio do site): `cliente_pediu` (pediu uma pessoa) e
   `nao_entendeu` (o roteiro não entendeu duas vezes seguidas). O agente pode usar os próprios.

`linkWhatsapp` (em `shared/unidades.ts`) e `montarMensagemWhatsapp` (em `protocolo.ts`) são as
únicas fontes desse formato — site e servidor usam as mesmas funções.

---

## 5. Modo roteiro (sem agente ou com falha)

Determinístico, em `server/assistente/roteiro.ts`: intenção por palavra-chave sobre o texto sem
acento e minúsculo (`intencoes.ts`), com pontuação por padrão e desempate por prioridade. Toda
resposta termina com ações (chips).

| Intenção | Exemplos | Resposta |
|---|---|---|
| `sensivel` | "OD -1,75 OE -2,00", CPF, cartão | Não processa; orienta envio seguro (`/lentes-de-grau`, WhatsApp). |
| `pessoa` | "quero falar com uma atendente", "whatsapp" | **Transbordo** (`cliente_pediu`) levando a última dúvida útil. |
| `exame` | "fazem exame de vista?" | A loja não faz exame; procurar oftalmologista. Sem inventar parceria. |
| `ficha` (com produto aberto) | "é polarizado?", "medidas?", "aceita grau?", "tem estoque?", "tenho uma dúvida" | Dado da ficha do banco (lente, UV, medidas, material, `accepts_rx`). Estoque: nunca promete. |
| `grau` | "tenho receita", "qual lente?", "multifocal", "Varilux" | Consultora monta o orçamento com a receita; não indica lente; link `/lentes-de-grau` + WhatsApp. |
| `empresas` | "empresa", "EPI com grau", "CNPJ" | Atendimento a empresas, `/empresas`, `/epi` e até 2 EPIs. |
| `trocas` | "trocar", "defeito", "garantia" | Arrependimento em 7 dias (CDC art. 49), garantia legal, `/trocas-e-devolucoes`. |
| `entrega` | "frete", "retirar na loja" | Retirada grátis nas duas lojas; frete e prazo no checkout pelo CEP; frete grátis acima de `FREE_SHIPPING_ABOVE`. |
| `pagamento` | "pix", "parcela", "boleto" | PIX 5% (`shared/pagamento.ts`), 10x sem juros, boleto; com produto aberto, os valores dele. |
| `provador` | "provador", "experimentar" | `/provador`; imagem processada no aparelho. |
| `unidades` | "onde fica", "horário", "Ribeirão" | Endereço de `shared/unidades.ts`, "Como chegar"; horário só se confirmado — senão, confirmar pelo WhatsApp. |
| `marcas` | "quais marcas" | Lista do PLANO.md + Varilux e Zeiss; `/marcas`. |
| `preco` | "quanto custa?" | Com produto: preço **lido do banco na hora** (o do contexto é ignorado), PIX e parcela. Sem produto: pede o modelo. |
| `busca` | "ray-ban aviador", "oakley polarizado", "óculos de grau feminino até 500" | Até 4 cards (ativos e publicados); afrouxa filtros se não houver exato e diz isso; "Ver todos" com os filtros na URL da vitrine. |
| `saudacao` / `agradecimento` | "oi", "obrigada" | Apresentação e chips. |
| `nao_entendeu` | — | Opções; na **2ª seguida**, transbordo (`nao_entendeu`). |

A memória de sessão do roteiro (contador de "não entendi" e a última dúvida já resumida e
mascarada) fica só em memória do processo, por 2 horas.

---

## 6. Widget (front)

- `AssistenteWidget.tsx` — botão "Fale com a Sanrê" (montado em `App.tsx` fora do admin). O painel
  (`PainelAssistente.tsx`) é carregado sob demanda no primeiro clique (pré-carrega no hover/toque).
- **Contexto das páginas** (`contexto.ts`):

  ```ts
  useEffect(() => {
    definirContextoAssistente({ produto: { slug, titulo, marca, preco, imagem } });
    return () => definirContextoAssistente({ produto: null });
  }, [slug]);

  abrirAssistente("Tenho uma dúvida sobre este modelo."); // abre e já envia
  ```

  O produto só vale na rota em que foi definido (se a página esquecer de limpar, a próxima não
  herda). Aberto numa página de produto, o chat começa com "Posso te ajudar com o …?".
- **Rodapé fixo**: marque barras fixas no pé da tela (ex.: "Adicionar à sacola" no celular) com
  `data-assistente-evitar` — o botão sobe acima delas. O aviso de cookies já é reconhecido.
- **Persistência**: `localStorage` `sanre:assistente:sessao` (`sessaoId`, 30 dias sem uso →
  sessão nova) e `sanre:assistente:mensagens` (últimas 30). "Apagar conversa" limpa tudo e troca
  o `sessaoId`. Mensagem com dado sensível não sai do aparelho e é guardada só como marcador.
- Acessibilidade: `role="dialog"` (modal no celular, com foco preso), Esc fecha e devolve o foco ao
  botão, `role="log"` + `aria-live` nas respostas, contador 0/800, `prefers-reduced-motion`.

---

## 7. LGPD

- O servidor não grava conversa. Log: rota, status, latência, intenção, modo e tipo de falha.
  Nunca o texto, nunca o `sessaoId` (os UUIDs do caminho já são mascarados em `server/index.ts`).
- Dado sensível (receita, CPF, cartão) é barrado no navegador; se passar, o servidor responde
  pelo roteiro sem encaminhar ao agente.
- A mensagem do WhatsApp mascara números longos e e-mails da dúvida resumida.

---

## 8. Como testar sem o agente real

Agente falso (Node) que confere a assinatura e responde no contrato:

```js
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
const TOKEN = "segredo-teste";
http.createServer((req, res) => {
  let corpo = ""; req.on("data", c => corpo += c); req.on("end", () => {
    const esperado = "sha256=" + createHmac("sha256", TOKEN).update(corpo).digest("hex");
    const a = Buffer.from(String(req.headers["x-sanre-assinatura"] ?? "")), b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { res.writeHead(401).end(); return; }
    const { texto } = JSON.parse(corpo);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ respostas: [
      { tipo: "texto", texto: `Recebi: ${texto}` },
      { tipo: "acoes", acoes: [{ rotulo: "Lentes de grau", href: "/lentes-de-grau" }] },
    ]}));
  });
}).listen(5497);
```

```bash
ASSISTENTE_URL=http://127.0.0.1:5497/agente ASSISTENTE_TOKEN=segredo-teste npm run dev
curl -s -X POST localhost:$PORT/api/assistente/mensagens -H 'Content-Type: application/json' \
  -d '{"sessaoId":"1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d","texto":"oi"}'
```

Derrube o agente falso, faça-o demorar mais que o timeout ou devolver JSON fora do contrato: a
resposta continua chegando, com `"modo": "roteiro"`.
