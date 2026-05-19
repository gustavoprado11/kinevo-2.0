-- ============================================================================
-- Kinevo — 137 trainer_financial_settings
-- ============================================================================
-- Configurações por trainer da aba Financeiro: métodos de pagamento padrão,
-- política de inadimplência, preferências de notificação, toggles avançados.
-- Uma linha por trainer (UNIQUE). Defaults sensatos no DB pra que a tabela
-- sempre responda "o que esse trainer quer" — mesmo antes do primeiro update.
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainer_financial_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Métodos de pagamento padrão (pré-selecionados em novos planos)
    default_allow_pix BOOLEAN NOT NULL DEFAULT true,
    default_allow_credit_card BOOLEAN NOT NULL DEFAULT true,
    default_allow_boleto BOOLEAN NOT NULL DEFAULT false,

    -- Política de inadimplência
    block_on_overdue BOOLEAN NOT NULL DEFAULT true,
    overdue_grace_days INTEGER NOT NULL DEFAULT 3
        CHECK (overdue_grace_days BETWEEN 1 AND 30),

    -- Notificações push (defaults = todas ligadas)
    notify_on_payment_received BOOLEAN NOT NULL DEFAULT true,
    notify_on_subscription_canceled BOOLEAN NOT NULL DEFAULT true,
    notify_on_payout_completed BOOLEAN NOT NULL DEFAULT true,
    notify_on_kyc_alert BOOLEAN NOT NULL DEFAULT true,

    -- Avançado
    show_stripe_legacy BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_tfs_trainer_id ON trainer_financial_settings(trainer_id);

-- Trigger pra manter updated_at consistente
CREATE OR REPLACE FUNCTION trg_trainer_financial_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trainer_financial_settings_updated_at ON trainer_financial_settings;
CREATE TRIGGER trainer_financial_settings_updated_at
    BEFORE UPDATE ON trainer_financial_settings
    FOR EACH ROW
    EXECUTE FUNCTION trg_trainer_financial_settings_updated_at();

-- RLS: trainer só vê/edita as próprias configurações
ALTER TABLE trainer_financial_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tfs_select ON trainer_financial_settings;
CREATE POLICY tfs_select ON trainer_financial_settings
    FOR SELECT
    USING (
        trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS tfs_insert ON trainer_financial_settings;
CREATE POLICY tfs_insert ON trainer_financial_settings
    FOR INSERT
    WITH CHECK (
        trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS tfs_update ON trainer_financial_settings;
CREATE POLICY tfs_update ON trainer_financial_settings
    FOR UPDATE
    USING (
        trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid())
    )
    WITH CHECK (
        trainer_id IN (SELECT id FROM trainers WHERE auth_user_id = auth.uid())
    );

COMMENT ON TABLE trainer_financial_settings IS
    'Configurações Financeiro por trainer — toggles e parâmetros da aba /financial/settings';
COMMENT ON COLUMN trainer_financial_settings.overdue_grace_days IS
    'Dias após vencimento antes de bloquear acesso ao app do aluno (range 1-30, default 3)';
COMMENT ON COLUMN trainer_financial_settings.show_stripe_legacy IS
    'Mostrar contratos Stripe legados na UI — só aparece pra trainers que têm histórico Stripe';
