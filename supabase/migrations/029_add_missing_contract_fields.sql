-- ============================================================================
-- Kinevo — 029 Add Missing Contract Fields
-- ============================================================================
-- Adiciona os campos faltantes na tabela `student_contracts` que
-- foram referenciados no TypeScript mas nunca criados no banco de dados.
-- ============================================================================

-- 1. Criação do Type Enum `billing_type`
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_type') THEN
        CREATE TYPE billing_type AS ENUM ('stripe_auto', 'manual_recurring', 'manual_one_off', 'courtesy');
    END IF;
END $$;

-- 2. Adição dos campos na tabela `student_contracts`
ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS billing_type billing_type NOT NULL DEFAULT 'manual_recurring',
    ADD COLUMN IF NOT EXISTS block_on_fail BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
