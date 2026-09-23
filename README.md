# Óticas Sanrê — portal e loja virtual

Loja virtual da **Óticas Sanrê** (Cravinhos desde 2004 · Ribeirão Preto na PB Arts Gallery desde
julho de 2026), sobre o whitelabel de loja da Sintetiza. Regras para agentes em `CLAUDE.md`;
plano e contratos entre módulos em `PLANO.md`.

## Diferenciais

| | O que é | Onde |
|---|---|---|
| Provador virtual | Óculos no rosto pela câmera ou por foto, em tempo real, com MediaPipe no navegador — nada é enviado | `/provador`, botão na página do produto |
| Lentes de grau com receita | Escolhe a armação, envia a receita (dado de saúde, com consentimento e expurgo em 90 dias), a consultora manda o orçamento pelo WhatsApp | `/lentes-de-grau`, "Comprar com lentes de grau" |
| Assistente Sanrê | Chat no site ligado ao mesmo agente do WhatsApp (adaptador `ASSISTENTE_URL`); sem agente, responde em modo roteiro | widget em todas as páginas, `docs/ASSISTENTE.md` |
| Duas lojas | Estoque por loja, filtro "retirar em", retirada grátis no checkout, páginas locais com JSON-LD `Optician` | `/unidades/:slug` |
| Filtros de óculos | Tipo, marca, faixa de preço, formato (com desenho), público, lente, material, cor, loja, aceita grau, provador | `/loja`, `/oculos-de-sol`, `/oculos-de-grau`, `/infantil`, `/epi` |
| Marcas | Página por marca com ficha e vitrine | `/marcas/:slug` |
| Formato do rosto | Guia interativo que filtra a vitrine pelos formatos indicados | `/formato-do-rosto` |
| Empresas e EPI | EPI com CA e EPI com grau, pedido corporativo | `/empresas`, `/epi` |
| SEO e GEO | HTML por rota renderizado no servidor (title, canonical, JSON-LD Product/Optician/FAQ), 404 real, sitemap, robots liberando IAs, `llms.txt`, `/feed/catalogo.json` | `server/seo/` |

## Rodando localmente

```bash
npm install
createdb sanre_dev
cp .env.example .env            # DATABASE_URL, JWT_SECRET, PORT, ADMIN_EMAIL/ADMIN_PASSWORD
npx drizzle-kit push --force
for f in migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
npm run seed                    # catálogo-semente de óculos (script/catalogo-oculos.json)
npm run dev
```

Pagamento (Mercado Pago/Asaas) e frete (SmartEnvios) ficam em **mock** sem credenciais.

## Marca

`script/marca/gerar_logo.py` reconstrói a logomarca SANRÊ — ÓTICAS — em vetor a partir dos
contornos da Montserrat (fonte oficial do manual), posicionados pelas medidas da arte enviada pela
loja. Saída em `client/public/brand/` (SVG preto/branco/nude, PNG, ícone) e no componente
`client/src/components/brand/Logo.tsx` (paths inline com `currentColor`).

Paleta do manual: preto `#000`, chumbo `#434343`, nude `#998f7c`, branco. O dourado `#b8975a`
(acento do protótipo aprovado) só aparece em detalhe. Tipografia: Montserrat + DM Sans.

## Catálogo-semente

`script/catalogo-oculos.json` + `uploads/produtos/oc-*` foram gerados por
`script/marca/preparar_catalogo.py` a partir de uma pesquisa de produtos reais das marcas que a loja
trabalha (fotos de fabricante e do Instagram @oticasanre). **É provisório**: preços de referência de
mercado e estoque por loja demonstrativo, até a integração com o SS Ótica (API Consultiva, somente
leitura). Troca pelo painel (`/admin/produtos`), sem código.

## Deploy (VPS)

`setup/atualizar-sanre.sh` (instalado em `/var/www/atualizar-sanre.sh`): clone/pull da `main`,
`npm install`, build, `drizzle-kit push` → `migrations/*.sql`, seed se a vitrine estiver vazia e
restart no pm2 do `claude-user`.
