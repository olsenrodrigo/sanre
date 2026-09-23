# ÓTICAS SANRÊ — Portal e loja virtual

Regras deste repositório para agentes (Claude Code e Codex). `AGENTS.md` é symlink deste arquivo.
Plano de implementação e contratos entre módulos: `PLANO.md`.

## Contexto

Ótica com duas lojas: **Cravinhos** (desde 17/12/2004, Rua XV de Novembro, 662A) e **Ribeirão
Preto** (desde 23/07/2026, Rua Altino Arantes, 811, anexo à PB Arts Gallery). Optica Sanre Ltda,
CNPJ 07.151.777/0001-04. Fork do whitelabel de loja da Sintetiza (base: loja Vivi Nosralla).
E-commerce real: erro de preço, estoque ou pagamento tem consequência financeira direta.

Single-tenant. O equivalente ao isolamento multi-tenant aqui é **ownership de carrinho, pedido e
lead** — e, desde a 019, **receita** (dado de saúde, LGPD art. 11).

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 · Vite 7 · TypeScript · Tailwind CSS v4 · wouter · TanStack Query |
| Back-end | Express 5 · Drizzle ORM · PostgreSQL · ES Modules |
| Pagamento | MercadoPago / Asaas atrás de gateway próprio (mock local) |
| Frete | SmartEnvios (mock local) + retirada nas duas lojas |
| Provador | MediaPipe FaceLandmarker no navegador (nada sai do aparelho) |

## Comandos

```bash
npm run dev      # API + front — PORT do .env
npm run check    # tsc — precisa passar limpo
npm run build    # tsx script/build.ts → dist/index.cjs
npm run seed     # recria o catálogo de óculos a partir de script/catalogo.ts
npm run db:push  # drizzle-kit push (no deploy roda ANTES das migrations/*.sql)
```

## Convenções

1. **Variantes: `option1` = Tamanho (calibre□ponte, ex. "58□14"), `option2` = Cor.**
2. **Ficha de óculos em colunas** (`frame_shape`, `frame_material`, `audience`, `lens_*`,
   `accepts_rx`, medidas, `ca_number`, `tryon_image_url`) — vocabulário em `client/src/lib/oculos.ts`.
3. **Preço e desconto** vêm de `shared/pagamento.ts` nos dois lados. Nunca recalcule no componente.
4. **Estoque por unidade** em `product_unit_stock`; `products.stock_quantity` é o saldo do e-commerce.
5. **Migrations nunca são editadas depois de aplicadas**; schema.ts e migrations terminam iguais.
6. **Toda query passa por `server/storage.ts`** (exceção documentada: `server/leads/`).
7. **Validação com zod na borda.**
8. **Marca**: SVG gerado por `script/marca/gerar_logo.py` (contornos da Montserrat medidos na arte
   da loja). Nunca recompor a logomarca com webfont. Nude oficial `#998f7c` reprova AA como texto —
   texto usa `sr-nude-600`+.
9. **Unidades e horários** vêm de `shared/unidades.ts`. Horário não confirmado não é publicado.
10. **Decreto 24.492/1934, art. 13**: site e assistente não indicam lente de grau.

## Verificação

Sem suíte de testes automatizados. Antes de dizer "pronto": `npm run check` limpo, `npm run build`
gerando `dist/index.cjs`, `curl` nas rotas tocadas e a tela aberta no navegador (1440 e 390 px, sem
overflow horizontal, sem erro no console).

## Pendências de go-live

- [ ] Horários das duas lojas (confirmar e ligar `horarioConfirmado`)
- [ ] Catálogo real e fotos de estúdio (o catálogo-semente usa imagens de fabricante e do Instagram)
- [ ] Estoque por unidade vindo do SS Ótica (API Consultiva — somente leitura)
- [ ] Credenciais de pagamento/frete de produção, SMTP, domínio
- [ ] Endpoint do agente de IA (`ASSISTENTE_URL`/`ASSISTENTE_TOKEN`) e do CRM (`CRM_WEBHOOK_URL`)
