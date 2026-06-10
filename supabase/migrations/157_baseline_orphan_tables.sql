-- ============================================================================
-- Migration 157: baseline das tabelas órfãs (drift migrations ↔ produção)
--
-- Contexto (auditoria 09/06/2026, achado crítico #2): 11 tabelas existiam em
-- produção sem CREATE TABLE no repo — criadas por migrations que só existem
-- no histórico do cloud (estúdios_foundation, create_curso_waitlist, etc.).
-- Um `db reset`/ambiente novo gerava schema incompleto e quebrava na 177
-- (que cria policies em appointment_groups sem guard).
--
-- Esta migration adiciona o DDL (extraído da produção real em 10/06/2026)
-- das 6 tabelas VIVAS. É 100% idempotente: em produção é efetivamente no-op
-- (if not exists + drop/create de policies idênticas).
--
--   - organizations / organization_members  → resíduo build-crítico do
--     Estúdios (settings→Equipe usa getOrganizationContext)
--   - appointment_groups                    → referenciada por FK viva de
--     recurring_appointments (agenda)
--   - curso_waitlist                        → landing externa landing-pre-venda
--     insere via anon REST
--   - feedback                              → botão "Feedback e Bugs" do web
--   - android_tester_queue                  → página /android
--
-- As 5 tabelas do programa de embaixadores (mortas) são DROPADAS na
-- migration 185_drop_ambassador_program.sql.
--
-- Numeração 157 de propósito (lacuna livre): precisa ordenar DEPOIS da 106
-- (cria recurring_appointments) e ANTES da 177 (cria policies em
-- appointment_groups). Em produção o histórico usa timestamp da aplicação —
-- o número local só define a ordem num reset.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabelas
-- ----------------------------------------------------------------------------

create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    logo_url text,
    visibility text not null default 'open'
        check (visibility in ('open', 'restricted')),
    seat_limit integer,
    subscription_status text not null default 'trialing'
        check (subscription_status in ('trialing', 'active', 'past_due', 'blocked', 'canceled')),
    grace_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    trainer_id uuid not null references public.trainers(id) on delete cascade,
    role text not null default 'coach'
        check (role in ('owner', 'admin', 'coach')),
    is_coach boolean not null default true,
    status text not null default 'active'
        check (status in ('active', 'invited', 'inactive')),
    invited_email text,
    joined_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, trainer_id)
);

create index if not exists idx_org_members_org
    on public.organization_members (organization_id) where (status = 'active');
create index if not exists idx_org_members_trainer
    on public.organization_members (trainer_id) where (status = 'active');

create table if not exists public.appointment_groups (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    coach_id uuid not null references public.trainers(id),
    title text not null,
    capacity smallint check (capacity > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    day_of_week smallint check (day_of_week >= 0 and day_of_week <= 6),
    start_time time,
    duration_minutes smallint not null default 60 check (duration_minutes > 0),
    frequency text not null default 'weekly'
        check (frequency in ('weekly', 'biweekly', 'monthly')),
    starts_on date,
    ends_on date,
    status text not null default 'active'
        check (status in ('active', 'archived'))
);

create index if not exists idx_appointment_groups_org
    on public.appointment_groups (organization_id);

-- Coluna de drift: existe em prod mas não na 106 (em prod é no-op).
alter table public.recurring_appointments
    add column if not exists appointment_group_id uuid references public.appointment_groups(id);

create table if not exists public.curso_waitlist (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    source text not null default 'crieseuapp',
    created_at timestamptz not null default now()
);

create unique index if not exists curso_waitlist_email_key
    on public.curso_waitlist (lower(email));

create table if not exists public.feedback (
    id uuid primary key default gen_random_uuid(),
    coach_id uuid references auth.users(id),
    type text not null check (type in ('bug', 'suggestion', 'other')),
    description text not null,
    screenshot_url text,
    page_url text,
    status text default 'open'
        check (status in ('open', 'in_progress', 'resolved', 'closed')),
    created_at timestamptz default now()
);

create table if not exists public.android_tester_queue (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    student_name text,
    status text default 'pending'
        check (status in ('pending', 'added', 'rejected')),
    created_at timestamptz default now(),
    added_at timestamptz
);

-- ----------------------------------------------------------------------------
-- 2. Funções de RLS do Estúdios (as policies abaixo dependem delas)
-- ----------------------------------------------------------------------------

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
    select exists (
        select 1 from organization_members om
        where om.organization_id = p_org
          and om.trainer_id = public.current_trainer_id()
          and om.status = 'active'
    )
$$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
    select exists (
        select 1 from organization_members om
        where om.organization_id = p_org
          and om.trainer_id = public.current_trainer_id()
          and om.status = 'active'
          and om.role in ('owner', 'admin')
    )
$$;

revoke execute on function public.is_org_member(uuid) from anon, public;
revoke execute on function public.is_org_manager(uuid) from anon, public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_manager(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Triggers de updated_at (update_updated_at() vem da 001)
-- ----------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.organizations;
create trigger set_updated_at before update on public.organizations
    for each row execute function update_updated_at();

drop trigger if exists set_updated_at on public.organization_members;
create trigger set_updated_at before update on public.organization_members
    for each row execute function update_updated_at();

drop trigger if exists set_updated_at on public.appointment_groups;
create trigger set_updated_at before update on public.appointment_groups
    for each row execute function update_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RLS + policies (definições idênticas às de produção)
--    Nota: as policies trainer_active_gate_* de appointment_groups NÃO são
--    criadas aqui — a 177 cuida delas (roda depois).
-- ----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.appointment_groups enable row level security;
alter table public.curso_waitlist enable row level security;
alter table public.feedback enable row level security;
alter table public.android_tester_queue enable row level security;

drop policy if exists organizations_service_all on public.organizations;
create policy organizations_service_all on public.organizations
    for all using (auth.role() = 'service_role');

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
    for select using (is_org_member(id));

drop policy if exists organizations_manager_update on public.organizations;
create policy organizations_manager_update on public.organizations
    for update using (is_org_manager(id)) with check (is_org_manager(id));

drop policy if exists org_members_service_all on public.organization_members;
create policy org_members_service_all on public.organization_members
    for all using (auth.role() = 'service_role');

drop policy if exists org_members_manager_manage on public.organization_members;
create policy org_members_manager_manage on public.organization_members
    for all using (is_org_manager(organization_id)) with check (is_org_manager(organization_id));

drop policy if exists org_members_member_read on public.organization_members;
create policy org_members_member_read on public.organization_members
    for select using (is_org_member(organization_id));

drop policy if exists appt_groups_service_all on public.appointment_groups;
create policy appt_groups_service_all on public.appointment_groups
    for all using (auth.role() = 'service_role');

drop policy if exists appt_groups_write on public.appointment_groups;
create policy appt_groups_write on public.appointment_groups
    for all using (is_org_manager(organization_id) or coach_id = current_trainer_id())
    with check (is_org_manager(organization_id) or coach_id = current_trainer_id());

drop policy if exists appt_groups_member_read on public.appointment_groups;
create policy appt_groups_member_read on public.appointment_groups
    for select using (is_org_member(organization_id));

drop policy if exists anon_insert_curso_waitlist on public.curso_waitlist;
create policy anon_insert_curso_waitlist on public.curso_waitlist
    for insert to anon, authenticated with check (true);

drop policy if exists "Service role full access" on public.feedback;
create policy "Service role full access" on public.feedback
    for all using (auth.role() = 'service_role');

drop policy if exists "Trainers can insert own feedback" on public.feedback;
create policy "Trainers can insert own feedback" on public.feedback
    for insert with check (auth.uid() = coach_id);

drop policy if exists "Trainers can view own feedback" on public.feedback;
create policy "Trainers can view own feedback" on public.feedback
    for select using (auth.uid() = coach_id);

drop policy if exists "Service role full access" on public.android_tester_queue;
create policy "Service role full access" on public.android_tester_queue
    for all using (auth.role() = 'service_role');

drop policy if exists "Allow anonymous insert" on public.android_tester_queue;
create policy "Allow anonymous insert" on public.android_tester_queue
    for insert with check (true);
