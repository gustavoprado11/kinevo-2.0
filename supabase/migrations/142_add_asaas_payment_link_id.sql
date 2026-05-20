-- ============================================================================
-- Migration 142: Asaas paymentLink id em student_contracts
-- ============================================================================
-- Adiciona referência ao paymentLink da Asaas no contrato, pra o webhook
-- conseguir achar o contrato quando o aluno paga via link self-service.
-- Já aplicada em produção via Supabase MCP — este arquivo só alinha o repo.
-- ============================================================================

ALTER TABLE public.student_contracts
ADD COLUMN IF NOT EXISTS asaas_payment_link_id text;

CREATE INDEX IF NOT EXISTS student_contracts_asaas_payment_link_id_idx
ON public.student_contracts (asaas_payment_link_id)
WHERE asaas_payment_link_id IS NOT NULL;

COMMENT ON COLUMN public.student_contracts.asaas_payment_link_id IS
'Asaas paymentLink id (ex: pll_abc). Usado pelo webhook pra achar o contrato quando o aluno pagar via link self-service.';
