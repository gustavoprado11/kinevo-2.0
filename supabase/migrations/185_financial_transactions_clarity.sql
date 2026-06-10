-- ============================================================================
-- Migration 185: clareza de pagamentos no Financeiro
--
-- Contexto (10/06/2026): o treinador via "2 pagamentos de R$ 5" sem saber
-- que era um plano de R$ 10 em 2x, nem quando o dinheiro libera pra saque.
-- O webhook do Asaas recebe tudo isso (billingType, installmentNumber,
-- netValue, creditDate/estimatedCreditDate) e descartava.
--
-- Novas colunas em financial_transactions:
--   payment_method         PIX | CREDIT_CARD | BOLETO (billingType do Asaas)
--   installment_number     nº desta parcela (null = à vista)
--   installment_total      total de parcelas do contrato
--   estimated_credit_date  previsão de liberação pra saque (Asaas)
--   credit_date            liberação confirmada (Asaas)
--   contract_id            FK pro contrato → plano → título na UI
-- ============================================================================

alter table financial_transactions
    add column if not exists payment_method text,
    add column if not exists installment_number integer,
    add column if not exists installment_total integer,
    add column if not exists estimated_credit_date date,
    add column if not exists credit_date date,
    add column if not exists contract_id uuid references student_contracts(id) on delete set null;

-- FK nova já nasce indexada (regra da casa pós-auditoria de índices)
create index if not exists idx_financial_transactions_contract
    on financial_transactions (contract_id);

-- Consulta "a liberar" do hero: coach + data de liberação futura
create index if not exists idx_financial_transactions_credit_date
    on financial_transactions (coach_id, credit_date)
    where credit_date is not null;
