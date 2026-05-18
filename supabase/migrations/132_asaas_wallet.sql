-- ============================================================================
-- Kinevo — 132 Asaas Wallet
-- ============================================================================
-- Adds the Asaas marketplace integration *alongside* the existing Stripe
-- Connect setup (migration 025). Nothing in the Stripe path is changed; this
-- migration only adds new tables/columns guarded by IF NOT EXISTS so it can
-- be applied safely on existing data.
--
-- Tables introduced:
--   * trainer_payment_accounts   — one Asaas subaccount per trainer
--   * pix_keys                   — saved PIX keys for payouts
--   * payouts                    — payout requests (PIX out)
--
-- Existing tables extended:
--   * financial_transactions     — gains `provider` + `asaas_payment_id`;
--                                  `stripe_payment_id` becomes nullable
--   * student_contracts          — gains `provider`, `asaas_payment_id`,
--                                  `asaas_subscription_id`
--   * webhook_events             — already has UNIQUE(event_id); reused for
--                                  Asaas idempotency (no schema change)
--
-- Pattern: re-uses current_trainer_id() helper for RLS, mirrors migration 025.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE wallet_status AS ENUM (
        'not_started',  -- treinador ainda não iniciou ativação
        'pending',      -- dados Kinevo OK, criando no Asaas
        'awaiting',     -- Asaas em análise (KYC)
        'approved',     -- pronto pra receber e sacar
        'rejected',     -- negado (mostrar rejection_reason)
        'blocked'       -- suspenso por compliance
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE pix_key_type AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM (
        'requested',     -- enviado pra Asaas
        'processing',    -- BANK_PROCESSING / PENDING
        'completed',     -- DONE
        'failed',        -- FAILED
        'cancelled'      -- CANCELLED
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_provider AS ENUM ('stripe', 'asaas');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. trainer_payment_accounts (Asaas subconta por treinador)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL UNIQUE,
    -- Asaas identifiers
    asaas_account_id TEXT,                       -- ex.: "acc_000000123"
    asaas_wallet_id TEXT,                        -- usado em split
    -- API key da subconta, criptografada via pgcrypto (pgsodium em prod).
    -- Guardamos como bytea para não expor o ciphertext em logs por engano.
    asaas_api_key_encrypted BYTEA,
    -- Status local (espelha o status remoto do Asaas)
    status wallet_status NOT NULL DEFAULT 'not_started',
    rejection_reason TEXT,
    -- Snapshot dos dados enviados (auditoria + reenvio em caso de reject)
    legal_name TEXT,
    cpf_cnpj TEXT,
    company_type TEXT,                           -- MEI | LIMITED | INDIVIDUAL | ASSOCIATION
    email TEXT,
    mobile_phone TEXT,
    -- Endereço (necessário pro Asaas)
    address TEXT,
    address_number TEXT,
    province TEXT,
    postal_code TEXT,
    income_value NUMERIC,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ                     -- quando virou 'approved'
);

CREATE INDEX IF NOT EXISTS idx_tpa_trainer ON trainer_payment_accounts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_tpa_asaas_account ON trainer_payment_accounts(asaas_account_id);
CREATE INDEX IF NOT EXISTS idx_tpa_status ON trainer_payment_accounts(status);

CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON trainer_payment_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. pix_keys (chaves cadastradas pro treinador sacar)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pix_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL,
    alias TEXT NOT NULL,                         -- "Nubank", "Itaú PJ", etc
    pix_key TEXT NOT NULL,                       -- valor da chave
    key_type pix_key_type NOT NULL,
    -- Dados confirmados via Asaas /pix/addressKeys/validate antes de salvar
    owner_name TEXT,                             -- nome do dono confirmado
    bank_name TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pix_keys_trainer ON pix_keys(trainer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pix_keys_default_per_trainer
    ON pix_keys(trainer_id) WHERE is_default = true;

-- ============================================================================
-- 4. payouts (saques solicitados pelo treinador)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL,
    pix_key_id UUID REFERENCES pix_keys(id) ON DELETE SET NULL,
    -- snapshot da chave pro caso do pix_key ser deletado depois
    pix_key_snapshot TEXT NOT NULL,
    pix_key_type_snapshot pix_key_type NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    asaas_transfer_id TEXT,
    status payout_status NOT NULL DEFAULT 'requested',
    failure_reason TEXT,
    end_to_end_id TEXT,                          -- EndToEndId do PIX (recibo)
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_trainer ON payouts(trainer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_asaas_transfer ON payouts(asaas_transfer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- ============================================================================
-- 5. EXTEND existing financial tables to support Asaas
-- ============================================================================
-- We do this only with ADD COLUMN IF NOT EXISTS so it's reversible safely.

-- 5.1 financial_transactions: add provider + asaas_payment_id, relax stripe_payment_id
ALTER TABLE financial_transactions
    ADD COLUMN IF NOT EXISTS provider payment_provider NOT NULL DEFAULT 'stripe';

ALTER TABLE financial_transactions
    ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

-- stripe_payment_id was NOT NULL in migration 025. Now relax it so Asaas rows
-- can exist without a stripe reference. Existing rows are unaffected (their
-- value is already set).
ALTER TABLE financial_transactions
    ALTER COLUMN stripe_payment_id DROP NOT NULL;

-- Enforce: at least one of stripe_payment_id / asaas_payment_id must be set.
DO $$ BEGIN
    ALTER TABLE financial_transactions
        ADD CONSTRAINT financial_transactions_provider_id_check
        CHECK (
            (provider = 'stripe' AND stripe_payment_id IS NOT NULL)
            OR (provider = 'asaas' AND asaas_payment_id IS NOT NULL)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_asaas ON financial_transactions(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON financial_transactions(provider, coach_id);

-- 5.2 student_contracts: add provider + asaas refs
ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS provider payment_provider NOT NULL DEFAULT 'stripe';

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;            -- para one-off

CREATE INDEX IF NOT EXISTS idx_contracts_asaas_sub ON student_contracts(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_contracts_provider ON student_contracts(provider);

-- 5.3 trainer_plans: add Asaas billing toggles + reference to Asaas product
ALTER TABLE trainer_plans
    ADD COLUMN IF NOT EXISTS allow_pix BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE trainer_plans
    ADD COLUMN IF NOT EXISTS allow_credit_card BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE trainer_plans
    ADD COLUMN IF NOT EXISTS allow_boleto BOOLEAN NOT NULL DEFAULT false;

-- 5.4 billing_type enum: add 'asaas_auto'
DO $$ BEGIN
    ALTER TYPE billing_type ADD VALUE IF NOT EXISTS 'asaas_auto';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- 6.1 trainer_payment_accounts: trainer reads/writes only their own row
ALTER TABLE trainer_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpa_trainer_select ON trainer_payment_accounts;
CREATE POLICY tpa_trainer_select ON trainer_payment_accounts
    FOR SELECT USING (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS tpa_trainer_insert ON trainer_payment_accounts;
CREATE POLICY tpa_trainer_insert ON trainer_payment_accounts
    FOR INSERT WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS tpa_trainer_update ON trainer_payment_accounts;
CREATE POLICY tpa_trainer_update ON trainer_payment_accounts
    FOR UPDATE USING (trainer_id = current_trainer_id());

-- service_role bypasses RLS (used by webhook handler)

-- 6.2 pix_keys
ALTER TABLE pix_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pix_keys_trainer_all ON pix_keys;
CREATE POLICY pix_keys_trainer_all ON pix_keys
    FOR ALL USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

-- 6.3 payouts: trainer reads, service_role writes (saque é sempre via API)
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payouts_trainer_select ON payouts;
CREATE POLICY payouts_trainer_select ON payouts
    FOR SELECT USING (trainer_id = current_trainer_id());

-- No INSERT/UPDATE for authenticated. Service role (server actions / webhook)
-- handles writes via supabaseAdmin.

-- ============================================================================
-- 7. COMMENTS (autodocumentação no banco)
-- ============================================================================

COMMENT ON TABLE trainer_payment_accounts IS
    'Asaas subaccount linked to each trainer. One row per trainer. API key is encrypted.';

COMMENT ON COLUMN trainer_payment_accounts.asaas_api_key_encrypted IS
    'API key of the subaccount, encrypted with pgsodium/pgcrypto. NEVER select unmasked.';

COMMENT ON TABLE pix_keys IS
    'PIX keys the trainer uses to receive payouts. Validated via Asaas before insert.';

COMMENT ON TABLE payouts IS
    'Payout requests (PIX out from subaccount to trainer''s external account).';

COMMENT ON COLUMN financial_transactions.provider IS
    'Payment provider: stripe (Stripe Connect) or asaas (Brazilian marketplace).';
