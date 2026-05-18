-- ============================================================================
-- Kinevo — 134 Asaas account_mode
-- ============================================================================
-- Distinguishes two modes of integration with Asaas:
--   * 'subaccount' — Kinevo created the subaccount via API (default; KYC
--                    flows through Kinevo)
--   * 'linked'    — trainer already had an Asaas account and brought their
--                   own API key + Wallet ID to vincular
--
-- Operations (createCharge, createSubscription, createTransfer) work
-- identically — they use whatever apiKey is stored. Only the activation flow
-- differs.
-- ============================================================================

ALTER TABLE trainer_payment_accounts
    ADD COLUMN IF NOT EXISTS account_mode TEXT NOT NULL DEFAULT 'subaccount'
    CHECK (account_mode IN ('subaccount', 'linked'));

COMMENT ON COLUMN trainer_payment_accounts.account_mode IS
    'subaccount = Kinevo criou via API; linked = trainer trouxe API key da própria conta Asaas';

CREATE INDEX IF NOT EXISTS idx_tpa_account_mode ON trainer_payment_accounts(account_mode);
