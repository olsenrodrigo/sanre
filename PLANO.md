# Portal Óticas Sanrê — plano de implementação

Loja virtual + portal da **Óticas Sanrê** (Cravinhos desde 2004; Ribeirão Preto desde
23/07/2026, anexo à PB Arts Gallery). Fork do whitelabel de loja (base: Vivi Nosralla
`b1e50a4`). Requisitos: `../insumos/2026-09-14_PreProjeto_Proposta_OticasSanre_EquipeTecnica.html`.
Marca: `../insumos/Apresentação da marca - final.pdf` + `../insumos/PHOTO-2026-07-27-21-33-07.jpg`.

## Dados reais (não inventar outros)
- Razão social Optica Sanre Ltda · CNPJ 07.151.777/0001-04 (ativa, desde 17/12/2004)
- WhatsApp (16) 99195-1430 → `5516991951430` · e-mail atendimento@oticasanre.com.br · Instagram @oticasanre
- Cravinhos: Rua XV de Novembro, 662A — Centro, 14140-000
- Ribeirão Preto: Rua Altino Arantes, 811 — Jardim Sumaré, 14020-200 (anexo à PB Arts Gallery)
- **Horários não confirmados** → não publicar (ver `shared/unidades.ts`, `horarioConfirmado`)
- Marcas que a loja trabalha (site/Instagram): Ray-Ban, Oakley, Prada, Gucci, Valentino, Tom Ford,
  Carrera, Michael Kors, Ferragamo, Lacoste, Calvin Klein, Guess, Ana Hickmann, HB, Just Cavalli,
  Speedo, Nanovista; lentes Varilux, Zeiss. Atende empresas com EPI e EPI com grau.

## Design system (client/src/index.css)
Conceito "a galeria": papel off-white, preto de galeria, fios finos, produto num pedestal névoa
(como o cubo de acrílico da loja), ficha do produto como etiqueta de museu.
- Tokens: `sr-ink` #141414 · `sr-ink-soft` · `sr-chumbo` #434343 · `sr-paper` #f6f4f0 ·
  `sr-sand` · `sr-mist` (pedestal) · `sr-line` (fio) · `sr-nude-50…900` (500 = #998f7c oficial;
  texto usa `sr-nude-600`+) · `sr-gold` #b8975a (só detalhe) · `sr-gold-700` (texto) · `sr-alert` · `sr-ok`.
- Fontes: Montserrat (títulos leves 300, rótulos caixa-alta com tracking) + DM Sans (corpo).
- Classes: `eyebrow`, `eyebrow-light`, `nav-label`, `label-marca`, `display-hero|lg|md|caps`,
  `btn-ink|line|gold|light|light-line|whats`, `link-rule`, `pedestal` (+ `img.produto`),
  `aspect-vitrine` (5:4), `aspect-retrato` (4:5), `grid-vitrine`, `traco`, `container-sr`, `bleed`.
- Sem cantos arredondados na vitrine, sem sombra, sem emoji, sem "Descubra/Transforme/Eleve".
- Logo: `@/components/brand/Logo` (SVG inline, `currentColor`), variantes `lockup` | `palavra`.
- Layout: toda página pública usa `@/components/layout/Navbar` + `@/components/layout/Footer`.

## Modelo de dados (migrations 018/019, `shared/schema.ts`)
`products` ganhou: modelCode, frameShape (aviador|redondo|quadrado|retangular|gatinho|hexagonal|
oval|mascara|esportivo|browline|geometrico), frameMaterial, audience (feminino|masculino|unissex|
infantil), frameColor, frameColorHex, lensColor, lensPolarized, lensMirrored, lensGradient,
lensPhotochromic, uvProtection, acceptsRx, lensWidthMm, bridgeMm, templeMm, lensHeightMm,
caNumber, safetyNorms, **tryonImageUrl** (vista frontal PNG transparente).
Categorias (slug): `oculos-de-sol`, `oculos-de-grau`, `infantil`, `epi`.
`product_unit_stock (product_id, unit_slug, quantity)` — saldo por loja.
`leads` (kind orcamento_grau|reserva|empresa|contato, protocol, status, unit_slug, product_id,
name, phone, email, company, payload jsonb, consent_version, consented_at) e
`prescription_files` (receita — dado de saúde, expurgo obrigatório, nunca servida por static).
Variantes: option1 = Tamanho ("58□14"), option2 = Cor.

## Divisão do trabalho (ownership por arquivo — não editar arquivo de outro dono)

### Orquestrador (sessão principal)
Design system, Logo, Navbar/Footer, Home, vitrine com filtros (`/loja`, `/oculos-de-sol`,
`/oculos-de-grau`, `/infantil`, `/epi`), página de produto, marcas (`/marcas`, `/marcas/:slug`),
unidades (`/unidades/:slug`), guias (`/guia/:slug`), formato do rosto, institucionais, seed do
catálogo, SEO/GEO renderizado no servidor, `App.tsx`, `server/routes.ts`, `server/storage.ts`,
`shared/*`, migrations, deploy.

### Provador em realidade aumentada — `client/src/components/provador/**`, `client/src/pages/ProvadorPage.tsx`
- MediaPipe FaceLandmarker **no navegador**: modelo `/provador/face_landmarker.task`,
  wasm `/provador/wasm` (servido do node_modules por `server/index.ts`). Nada sai do aparelho.
- Contrato: `ProvadorAR` com props `ProvadorARProps` (arquivo stub já define os tipos).
- Página `/provador` lista `GET /api/store/products?tryon=1&limit=100` (campos camelCase do schema +
  `mainImage`), filtros rápidos por tipo/marca, carrossel de armações, "ver produto", "adicionar à
  sacola" (`useCart().addToCart(productId, variantId|null, 1)`).

### Assistente Sanrê — `server/assistente/**`, `client/src/components/assistente/**`, `docs/ASSISTENTE.md`
- Ponte já definida em `client/src/components/assistente/contexto.ts`
  (`definirContextoAssistente`, `abrirAssistente`) — não mudar a assinatura.
- `POST /api/assistente/mensagens` → encaminha ao agente externo (`ASSISTENTE_URL`,
  assinatura HMAC com `ASSISTENTE_TOKEN`); sem agente ou com falha, responde em modo roteiro.
- Widget flutuante único (chat + atalho para WhatsApp) montado em `App.tsx`.

### Leads, grau, reserva e empresas — `server/leads/**`, `client/src/components/grau/**`,
`client/src/components/reserva/**`, `client/src/pages/LentesDeGrauPage.tsx`,
`client/src/pages/EmpresasPage.tsx`, `client/src/pages/admin/Leads.tsx`
- `POST /api/leads` (multipart; receita opcional) → `{ protocolo, whatsappUrl }`.
- Receita em `privado/receitas/` (gitignored), expurgo em 90 dias, download só no admin.
- Decreto 24.492/1934 art. 13: o site não indica lente; a consultora define com a receita.

## Regras de texto
Português do Brasil, frases diretas. Nada de "Descubra", "Transforme", "Eleve", "experiência única",
emoji, exclamação em excesso. Preço só com fonte. Não publicar horário não confirmado.

## Verificação
`npm run check` limpo e `npm run build` gerando `dist/index.cjs`; cada tela aberta no navegador
(desktop 1440 e celular 390) sem overflow horizontal e sem erro no console.
