-- 019 — Leads do site (orçamento de grau, reserva para experimentar, empresas/EPI)
--
-- O site não fecha venda de grau: "comprar com lentes de grau" abre um
-- orçamento que a consultora confere com a receita (Decreto 24.492/1934, art. 13:
-- a indicação técnica da lente não sai de um robô nem de um formulário). O que
-- sai daqui é um LEAD com protocolo, que segue para a consultora e para o CRM.
--
-- Receita é dado de saúde (LGPD art. 11). Por isso:
--   1. o arquivo fica em tabela própria, com prazo de expurgo obrigatório;
--   2. nunca é servido por rota pública — só pelo painel, autenticado;
--   3. o consentimento guarda a VERSÃO do texto aceito.
--
-- Protocolo curto e não sequencial (ex.: SR-7K2Q9M): vai na mensagem do
-- WhatsApp para a assistente reconhecer o pedido, e não pode ser enumerável.
--
-- Idempotente (INV-E).

CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  protocol        TEXT        NOT NULL UNIQUE,
  kind            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'novo',
  unit_slug       TEXT,
  product_id      INTEGER     REFERENCES products(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  email           TEXT,
  company         TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  source          TEXT        NOT NULL DEFAULT 'site',
  consent_version TEXT,
  consented_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_kind_check
    CHECK (kind IN ('orcamento_grau','reserva','empresa','contato'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('novo','em_atendimento','orcamento_enviado','convertido','descartado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_leads_kind_status ON leads (kind, status);
CREATE INDEX IF NOT EXISTS idx_leads_created     ON leads (created_at);

-- ─── Receitas anexadas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_files (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER     NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  size_bytes INTEGER     NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  purged_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE prescription_files ADD CONSTRAINT prescription_files_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_prescription_files_expires ON prescription_files (expires_at);
