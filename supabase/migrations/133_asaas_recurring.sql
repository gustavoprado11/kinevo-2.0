-- ============================================================================
-- Kinevo — 133 Asaas recurring (subscriptions)
-- ============================================================================
-- Adds the `asaas_auto_recurring` value to the billing_type enum so we can
-- distinguish:
--   - asaas_auto         → cobrança avulsa (one-off) via Asaas
--   - asaas_auto_recurring → assinatura recorrente Asaas (mensal/trimestral/anual)
--
-- Also documents the additional student_contracts.status values used in the
-- new Asaas flow: 'pending_payment' (cobrança criada, aguardando aluno pagar)
-- and 'past_due' (renovação falhou). status remains TEXT, no enum change.
-- ============================================================================

DO $$ BEGIN
    ALTER TYPE billing_type ADD VALUE IF NOT EXISTS 'asaas_auto_recurring';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add asaas_auto_recurring: %', SQLERRM;
END $$;

COMMENT ON COLUMN student_contracts.status IS
    'Status values: pending (default antigo), pending_payment (Asaas cobrança ' ||
    'criada, aguardando aluno pagar), active (paga, recebida), past_due ' ||
    '(renovação falhou), canceled, refunded. Mantido como TEXT pra ' ||
    'flexibilidade — não converter pra ENUM até estabilizar.';
