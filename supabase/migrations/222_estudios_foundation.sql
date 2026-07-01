-- ============================================================================
-- Migration 222: fundação Estúdios P1.0 (aditivo, backward-compat)
--
-- 1. Baseline de students.organization_id (DRIFT: existe em prod, sem migration
--    local — um db reset geraria schema incompleto e quebraria a 223 que
--    referencia s.organization_id). Mesma classe da 157.
-- 2. Colunas de billing por seat em organizations (novas — usadas só na P1.5).
-- 3. Helper trainer_org_id() (novo) — org do treinador logado, ou null (solo).
--
-- Idempotente: em produção é efetivamente no-op (if not exists / create or replace).
-- ============================================================================

-- 1. Baseline reset-safe de students.organization_id -------------------------
alter table public.students
    add column if not exists organization_id uuid references public.organizations(id);

create index if not exists idx_students_organization_id
    on public.students (organization_id);

-- 2. Billing por seat na org (usado na P1.5) ---------------------------------
alter table public.organizations
    add column if not exists stripe_customer_id text,
    add column if not exists stripe_subscription_id text,
    add column if not exists plan_tier text;

-- 3. Helper: org ativa do treinador logado (uma org por treinador na v1) ------
create or replace function public.trainer_org_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
    select om.organization_id
    from organization_members om
    where om.trainer_id = public.current_trainer_id()
      and om.status = 'active'
    order by om.joined_at nulls last
    limit 1
$$;

revoke execute on function public.trainer_org_id() from anon, public;
grant execute on function public.trainer_org_id() to authenticated, service_role;
