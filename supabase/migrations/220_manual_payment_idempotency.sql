-- ============================================================================
-- 220_manual_payment_idempotency.sql
-- ============================================================================
-- Idempotência de pagamentos manuais (markAsPaidCore / mark_payment_as_paid).
--
-- markAsPaidCore inseria a transação com stripe_payment_id = `manual_<uuid
-- aleatório>` e, no recorrente, avançava current_period_end — A CADA chamada.
-- Duas chamadas (retry do assistente, duplo-clique) gravavam a receita DUAS
-- vezes E adiantavam o período DUAS vezes.
--
-- Fix (app, commit junto): a chave vira DETERMINÍSTICA, capturada ANTES do
-- avanço — recorrente: `manual_<contract>_<period_end>`; avulso:
-- `manual_<contract>_oneoff`. O app faz INSERT-FIRST e só avança o período se o
-- insert ganhou. Este índice é o BACKSTOP DE CORRIDA: garante que só UMA chamada
-- grava a transação daquela chave (a 2ª pega 23505 → no-op idempotente, sem
-- avançar o período).
--
-- Escopo: índice ÚNICO PARCIAL só sobre as chaves manuais (left(...) = 'manual_').
-- NÃO impõe unicidade no caminho Stripe (stripe_payment_id de cobranças reais
-- fica de fora). `left(text, int)` é IMMUTABLE → válido em predicado de índice.
-- Seguro de aplicar: hoje há 0 transações manuais e 0 duplicatas em
-- stripe_payment_id (verificado em prod).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_tx_manual_key
    ON public.financial_transactions (stripe_payment_id)
    WHERE left(stripe_payment_id, 7) = 'manual_';
