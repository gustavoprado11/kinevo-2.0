-- ============================================================================
-- Kinevo — 019 Stripe Subscriptions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUBSCRIPTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_subscriptions_trainer ON subscriptions(trainer_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Trigger updated_at (reuses existing function from migration 001)
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 2. RLS POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Trainers can read their own subscription
CREATE POLICY subscriptions_trainer_select ON subscriptions
    FOR SELECT USING (trainer_id = current_trainer_id());

-- No INSERT/UPDATE/DELETE policies for authenticated role = blocked by RLS.
-- service_role bypasses RLS entirely (used by webhook handler via supabaseAdmin).

-- ----------------------------------------------------------------------------
-- 3. GRANTS
-- ----------------------------------------------------------------------------
GRANT SELECT ON subscriptions TO authenticated;
GRANT ALL ON subscriptions TO service_role;
