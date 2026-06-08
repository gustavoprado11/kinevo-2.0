-- ============================================================================
-- Migration 178: Parcelamento (installments) via Asaas
-- ============================================================================
-- Liga o suporte a pagamento parcelado no cartão de crédito via Asaas Payment
-- Link (chargeType=INSTALLMENT). Duas colunas aditivas:
--
--   trainer_plans.max_installment_count  → config no plano: nº máximo de
--       parcelas que o treinador permite (1 = sem parcelamento; >1 = até N).
--
--   student_contracts.installment_count  → nº de parcelas oferecido na
--       cobrança daquele contrato (display + relatório). NULL/1 = à vista.
--
-- Não cria novo valor de enum billing_type: parcelado reusa 'asaas_auto',
-- cujo gate de acesso já é "ativo até cancelar" — comportamento desejado
-- (acesso liberado na 1ª parcela e mantido). A distinção visual "Parcelado"
-- vem de installment_count > 1.
--
-- Mudança aditiva e backward-compat.
-- ============================================================================

ALTER TABLE public.trainer_plans
ADD COLUMN IF NOT EXISTS max_installment_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.student_contracts
ADD COLUMN IF NOT EXISTS installment_count INTEGER;

COMMENT ON COLUMN public.trainer_plans.max_installment_count IS
'Nº máximo de parcelas permitido neste plano no cartão de crédito (1 = sem parcelamento). Usado pra pré-preencher o modo Parcelado da cobrança Asaas.';

COMMENT ON COLUMN public.student_contracts.installment_count IS
'Nº de parcelas oferecido na cobrança parcelada (Asaas INSTALLMENT). NULL ou 1 = à vista.';
