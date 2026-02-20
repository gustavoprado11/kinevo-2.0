-- ============================================================================
-- Kinevo — 028 Add Stripe to Students
-- ============================================================================
-- Adiciona campos para integração com o Stripe na tabela students
-- ============================================================================

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
