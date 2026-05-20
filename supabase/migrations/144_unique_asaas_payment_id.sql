-- Sprint 2Q: garantir idempotência do upsert no webhook + sync
-- Sem UNIQUE constraint, .upsert({ onConflict: 'asaas_payment_id' }) falha
-- silencioso e a linha não é inserida. Resultado: contrato vira active mas
-- financial_transactions fica vazio (não aparece em Atividade recente).
--
-- Constraint é parcial (WHERE NOT NULL) pra não quebrar linhas Stripe legadas
-- que têm asaas_payment_id=null.

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_asaas_payment_id_unique_idx
ON public.financial_transactions (asaas_payment_id)
WHERE asaas_payment_id IS NOT NULL;

-- Note: o índice antigo idx_transactions_asaas continua existindo (lookup
-- não-único), mas o Postgres ON CONFLICT prefere índice UNIQUE quando há.
