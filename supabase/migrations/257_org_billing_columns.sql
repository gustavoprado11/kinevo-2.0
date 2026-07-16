-- ============================================================================
-- 257: Estúdios — colunas de billing na organização
-- ============================================================================
-- O billing por org (checkout/webhook Stripe) precisa exibir a próxima cobrança
-- e o cancelamento agendado, que a tabela organizations ainda não tinha (o solo
-- guarda em subscriptions.current_period_end / cancel_at_period_end). O tier já
-- vive em organizations.plan_tier; a janela de graça em grace_until.
--
-- Backward-compat: nullable / default — orgs existentes (provisionadas manuais)
-- ficam com current_period_end NULL e cancel_at_period_end false.
-- ============================================================================

alter table public.organizations
    add column if not exists current_period_end timestamptz,
    add column if not exists cancel_at_period_end boolean not null default false;
