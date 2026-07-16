-- ============================================================================
-- 258: Estúdios — permitir subscription_status 'incomplete' na organização
-- ============================================================================
-- A criação self-serve (createOrganization) grava 'incomplete' — a org nasce
-- SEM acesso e só vira 'active' quando o checkout Stripe completa (webhook). O
-- CHECK original (157) não incluía 'incomplete', então o insert falhava. Os
-- demais status do Stripe são normalizados no app (org-billing-sync).
-- ============================================================================

alter table public.organizations
    drop constraint if exists organizations_subscription_status_check;

alter table public.organizations
    add constraint organizations_subscription_status_check
    check (subscription_status in ('trialing', 'active', 'past_due', 'blocked', 'canceled', 'incomplete'));
