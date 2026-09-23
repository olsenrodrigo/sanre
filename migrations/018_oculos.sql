-- 018 — Catálogo de óculos (Óticas Sanrê)
--
-- A base veio de uma loja de roupa: tamanho e cor em variante, composição e
-- medidas por tamanho. Óculos se escolhe por outras coisas — formato, material,
-- lente, medida da armação, se aceita grau — e é por elas que a vitrine filtra.
-- Por isso viram COLUNAS (filtráveis e indexáveis), não JSON solto.
--
-- Convenção de variantes mantida: option1 = Tamanho (calibre□ponte, ex. "58□14"),
-- option2 = Cor.
--
-- Estoque por unidade: a Sanrê tem duas lojas e o cliente escolhe onde retirar.
-- O saldo por unidade virá do SS Ótica (API Consultiva, somente leitura); até
-- lá é mantido pelo painel/seed. `products.stock_quantity` continua sendo o
-- saldo total vendável no e-commerce.
--
-- Idempotente (INV-E).

ALTER TABLE products ADD COLUMN IF NOT EXISTS model_code        TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS frame_shape       TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS frame_material    TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS audience          TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS frame_color       TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS frame_color_hex   TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_color        TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_polarized    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_mirrored     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_gradient     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_photochromic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS uv_protection     TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS accepts_rx        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_width_mm     INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bridge_mm         INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS temple_mm         INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lens_height_mm    INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ca_number         TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS safety_norms      TEXT;
-- Vista frontal com fundo transparente: é o que o provador em realidade
-- aumentada desenha sobre o rosto. Sem ela o produto não entra no provador.
ALTER TABLE products ADD COLUMN IF NOT EXISTS tryon_image_url   TEXT;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_audience_check
    CHECK (audience IS NULL OR audience IN ('feminino','masculino','unissex','infantil'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_products_brand       ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_frame_shape ON products (frame_shape);
CREATE INDEX IF NOT EXISTS idx_products_audience    ON products (audience);

-- ─── Estoque por unidade ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_unit_stock (
  product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_slug  TEXT        NOT NULL,
  quantity   INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, unit_slug)
);

DO $$ BEGIN
  ALTER TABLE product_unit_stock ADD CONSTRAINT product_unit_stock_unit_check
    CHECK (unit_slug IN ('cravinhos','ribeirao-preto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE product_unit_stock ADD CONSTRAINT product_unit_stock_qty_check CHECK (quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE product_unit_stock ADD CONSTRAINT product_unit_stock_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
