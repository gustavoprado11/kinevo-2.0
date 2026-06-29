-- ============================================================================
-- 221_per_subaccount_webhook_token.sql
-- ============================================================================
-- Fase 2 (defense-in-depth) do hardening do webhook Asaas: token POR SUBCONTA.
--
-- Hoje todas as subcontas usam o MESMO ASAAS_WEBHOOK_TOKEN global (recuperável
-- por um treinador em modo linked → forja). A Fase 1 já fechou a forja de
-- PAYMENT_RECEIVED via re-fetch autoritativo; a Fase 2 dá ESCOPO DE TENANT a
-- TODOS os tipos de evento (overdue/refunded/transfer/account), que hoje não
-- têm escopo nenhum.
--
-- Cada subconta passa a ter um authToken aleatório próprio; guardamos só o
-- HASH (sha256) aqui — NUNCA o token cru. O handler resolve o token recebido →
-- exatamente um trainer_id e escopa o evento.
--
-- Nullable + dual-accept: subcontas ainda não rotacionadas seguem aceitas pelo
-- token GLOBAL legado até a rotação (sem downtime). O global é aposentado quando
-- toda subconta aprovada tiver webhook_token_hash não-nulo.
-- ============================================================================

ALTER TABLE public.trainer_payment_accounts
    ADD COLUMN IF NOT EXISTS webhook_token_hash text;

-- Resolução token→trainer tem que ser 1:1 → unique parcial (só não-nulo).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tpa_webhook_token_hash
    ON public.trainer_payment_accounts (webhook_token_hash)
    WHERE webhook_token_hash IS NOT NULL;
