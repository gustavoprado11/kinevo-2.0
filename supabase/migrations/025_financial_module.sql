-- ============================================================================
-- Kinevo — 025 Financial Module (Stripe Connect Marketplace)
-- ============================================================================
-- Formalizes existing financial tables (created via Supabase Dashboard)
-- with RLS policies, indexes, triggers, and new columns.
-- Uses IF NOT EXISTS / IF NOT EXISTS guards for idempotency.
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE billing_type AS ENUM (
        'stripe_auto',
        'manual_recurring',
        'manual_one_off',
        'courtesy'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 1.5 COLUMN RENAME (students.trainer_id → coach_id)
-- ============================================================================
-- The students table was created with `trainer_id` in migration 001, but was
-- renamed to `coach_id` directly in the Supabase Dashboard. This formalizes
-- the rename so migrations are consistent.

DO $$ BEGIN
    ALTER TABLE students RENAME COLUMN trainer_id TO coach_id;
EXCEPTION
    WHEN undefined_column THEN NULL; -- already renamed
END $$;

-- ============================================================================
-- 2. TABLE GUARDS (CREATE IF NOT EXISTS)
-- ============================================================================

-- 2.1 payment_settings
CREATE TABLE IF NOT EXISTS payment_settings (
    user_id TEXT PRIMARY KEY,
    stripe_connect_id TEXT,
    stripe_status TEXT,
    charges_enabled BOOLEAN DEFAULT false,
    details_submitted BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 trainer_plans
CREATE TABLE IF NOT EXISTS trainer_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    interval TEXT DEFAULT 'month',
    interval_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    visibility TEXT DEFAULT 'public',
    payment_method TEXT,
    stripe_product_id TEXT,
    stripe_price_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 student_contracts
CREATE TABLE IF NOT EXISTS student_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    trainer_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL,
    student_id UUID,
    amount_gross NUMERIC NOT NULL,
    amount_net NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'brl',
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    stripe_payment_id TEXT NOT NULL,
    stripe_invoice_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 2.5 webhook_events (idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB
);

-- ============================================================================
-- 3. NEW COLUMNS (ALTER TABLE — student_contracts)
-- ============================================================================

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS billing_type billing_type NOT NULL DEFAULT 'stripe_auto';

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS block_on_fail BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE student_contracts
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- payment_settings
CREATE INDEX IF NOT EXISTS idx_payment_settings_user ON payment_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_settings_connect ON payment_settings(stripe_connect_id);

-- trainer_plans
CREATE INDEX IF NOT EXISTS idx_plans_trainer ON trainer_plans(trainer_id, is_active);

-- student_contracts
CREATE INDEX IF NOT EXISTS idx_contracts_trainer ON student_contracts(trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_student ON student_contracts(student_id);
CREATE INDEX IF NOT EXISTS idx_contracts_stripe_sub ON student_contracts(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_contracts_billing ON student_contracts(billing_type);

-- financial_transactions
CREATE INDEX IF NOT EXISTS idx_transactions_coach ON financial_transactions(coach_id);
CREATE INDEX IF NOT EXISTS idx_transactions_student ON financial_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe ON financial_transactions(stripe_payment_id);

-- webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- ============================================================================
-- 5. TRIGGERS (updated_at)
-- ============================================================================

-- Reuses update_updated_at() function from migration 001

CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON payment_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON trainer_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON student_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- 6.1 payment_settings
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_settings_trainer_select ON payment_settings
    FOR SELECT USING (user_id = current_trainer_id()::text);

-- No INSERT/UPDATE/DELETE for authenticated — only service_role

-- 6.2 trainer_plans
ALTER TABLE trainer_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY trainer_plans_trainer_all ON trainer_plans
    FOR ALL USING (trainer_id = current_trainer_id());

CREATE POLICY trainer_plans_student_select ON trainer_plans
    FOR SELECT USING (
        visibility = 'public'
        AND trainer_id IN (
            SELECT coach_id FROM students WHERE auth_user_id = auth.uid()
        )
    );

-- 6.3 student_contracts
ALTER TABLE student_contracts ENABLE ROW LEVEL SECURITY;

-- Trainer can read contracts for their students
CREATE POLICY student_contracts_trainer_select ON student_contracts
    FOR SELECT USING (trainer_id = current_trainer_id());

-- Trainer can create contracts (manual/cortesia)
CREATE POLICY student_contracts_trainer_insert ON student_contracts
    FOR INSERT WITH CHECK (trainer_id = current_trainer_id());

-- Trainer can update contracts (mark as paid, toggle block_on_fail)
CREATE POLICY student_contracts_trainer_update ON student_contracts
    FOR UPDATE USING (trainer_id = current_trainer_id());

-- Student can read their own contracts
CREATE POLICY student_contracts_student_select ON student_contracts
    FOR SELECT USING (student_id = current_student_id());

-- 6.4 financial_transactions
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Trainer can read their transactions
CREATE POLICY financial_transactions_trainer_select ON financial_transactions
    FOR SELECT USING (coach_id = current_trainer_id());

-- Student can read their transactions
CREATE POLICY financial_transactions_student_select ON financial_transactions
    FOR SELECT USING (student_id = current_student_id());

-- No INSERT/UPDATE/DELETE for authenticated — only service_role

-- 6.5 webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated — only service_role accesses this table

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON payment_settings TO authenticated;
GRANT ALL ON payment_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON trainer_plans TO authenticated;
GRANT ALL ON trainer_plans TO service_role;

GRANT SELECT, INSERT, UPDATE ON student_contracts TO authenticated;
GRANT ALL ON student_contracts TO service_role;

GRANT SELECT ON financial_transactions TO authenticated;
GRANT ALL ON financial_transactions TO service_role;

GRANT ALL ON webhook_events TO service_role;

-- ============================================================================
-- 8. RPC: check_student_access
-- ============================================================================
-- Called by mobile app to determine if a student can access the platform.
-- Returns { allowed: boolean, reason: string }

CREATE OR REPLACE FUNCTION check_student_access(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contract RECORD;
    v_student_status TEXT;
BEGIN
    -- 1. Get student status
    SELECT status::text INTO v_student_status
    FROM students WHERE id = p_student_id;

    -- Student not found
    IF v_student_status IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'student_not_found');
    END IF;

    -- 2. If student is blocked/archived/inactive by trainer, deny
    IF v_student_status IN ('blocked', 'archived', 'inactive') THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'student_inactive');
    END IF;

    -- 3. Get most recent contract (active or past_due)
    SELECT * INTO v_contract
    FROM student_contracts
    WHERE student_id = p_student_id
      AND status IN ('active', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1;

    -- 4. No contract = legacy student, allow access (backward compatible)
    IF v_contract IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'no_contract');
    END IF;

    -- 5. Courtesy = always allow
    IF v_contract.billing_type = 'courtesy' THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'courtesy');
    END IF;

    -- 6. Active contract = allow
    IF v_contract.status = 'active' THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'active');
    END IF;

    -- 7. Past due: check block_on_fail
    IF v_contract.status = 'past_due' THEN
        IF v_contract.block_on_fail THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
        ELSE
            RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
        END IF;
    END IF;

    -- 8. Default: allow (safety net)
    RETURN jsonb_build_object('allowed', true, 'reason', 'default');
END;
$$;

-- Grant execute to authenticated (students call this)
GRANT EXECUTE ON FUNCTION check_student_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_student_access(UUID) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
