-- ============================================================================
-- Migration 183: índice único de financial_transactions.asaas_payment_id
-- deixa de ser parcial — o upsert do webhook nunca funcionou
--
-- Problema (10/06/2026): o handler do webhook Asaas grava a transação com
-- upsert ON CONFLICT (asaas_payment_id), mas o índice único existente é
-- PARCIAL (WHERE asaas_payment_id IS NOT NULL). O Postgres não infere índice
-- parcial sem o predicado na cláusula ON CONFLICT — e o PostgREST não envia
-- predicado. Resultado: erro 42P10 em TODO pagamento, engolido pelo
-- console.error do handler → push de "pagamento recebido" dispara, mas a
-- transação nunca aparece no Financeiro.
--
-- Fix: índice único TOTAL. Em Postgres, NULLs são distintos por default
-- (NULLS DISTINCT), então linhas sem asaas_payment_id (ex.: Stripe legado)
-- continuam ilimitadas — o WHERE do índice antigo era redundante.
-- ============================================================================

drop index if exists financial_transactions_asaas_payment_id_unique_idx;

create unique index if not exists financial_transactions_asaas_payment_id_key
    on financial_transactions (asaas_payment_id);

-- O índice de busca simples idx_transactions_asaas fica redundante com o
-- único acima (mesma coluna, mesmo btree) — remove pra não pagar write duplo.
drop index if exists idx_transactions_asaas;
