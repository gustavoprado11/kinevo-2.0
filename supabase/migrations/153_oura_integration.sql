-- ============================================================================
-- Oura Ring Integration — schema (Fase 1 de wearables diretos)
-- ----------------------------------------------------------------------------
-- Spec: mobile/specs/active/oura-integration.md
--
-- Modelo B (server-side + webhooks): tokens vivem no backend (tabela
-- wearable_oauth_tokens, acessível só por service_role), uma edge function de
-- webhook recebe os dados de madrugada e um cron renova tokens. Espelha o
-- padrão já existente do Google Calendar (renew-google-watch-channels).
--
-- Tudo aditivo / backward-compat:
--   1. estende CHECK de `source` em wearable_connections + 4 tabelas de samples
--   2. adiciona `source` em readiness_scores (default 'computed')
--   3. cria wearable_oauth_tokens (RLS: somente service_role)
--   4. trigger de PRIORIDADE DE FONTE (#6): impede que uma fonte de menor
--      prioridade sobrescreva uma de maior prioridade no mesmo dia
--      (oura/whoop > healthkit/health_connect > computed)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Estender CHECK de source pra incluir 'oura' (e 'whoop' já antecipado)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.wearable_connections
    drop constraint if exists wearable_connections_source_check;
alter table public.wearable_connections
    add constraint wearable_connections_source_check
    check (source in ('healthkit', 'health_connect', 'strava', 'oura', 'whoop'));

alter table public.daily_sleep_samples
    drop constraint if exists daily_sleep_samples_source_check;
alter table public.daily_sleep_samples
    add constraint daily_sleep_samples_source_check
    check (source in ('healthkit', 'health_connect', 'oura', 'whoop'));

alter table public.daily_activity_samples
    drop constraint if exists daily_activity_samples_source_check;
alter table public.daily_activity_samples
    add constraint daily_activity_samples_source_check
    check (source in ('healthkit', 'health_connect', 'oura', 'whoop'));

alter table public.hr_resting_samples
    drop constraint if exists hr_resting_samples_source_check;
alter table public.hr_resting_samples
    add constraint hr_resting_samples_source_check
    check (source in ('healthkit', 'health_connect', 'oura', 'whoop'));

alter table public.hrv_samples
    drop constraint if exists hrv_samples_source_check;
alter table public.hrv_samples
    add constraint hrv_samples_source_check
    check (source in ('healthkit', 'health_connect', 'oura', 'whoop'));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. readiness_scores: coluna `source` (cache computado vs score nativo do device)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.readiness_scores
    add column if not exists source text not null default 'computed';
alter table public.readiness_scores
    drop constraint if exists readiness_scores_source_check;
alter table public.readiness_scores
    add constraint readiness_scores_source_check
    check (source in ('computed', 'oura', 'whoop'));

comment on column public.readiness_scores.source is
    'computed = algoritmo Kinevo (70% sono + 30% HR). oura/whoop = score nativo do device (prevalece sobre computed via trigger de prioridade).';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. wearable_oauth_tokens — tokens OAuth server-side (NUNCA no device)
-- RLS habilitado SEM policies → só service_role (edge functions) acessa.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.wearable_oauth_tokens (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    source text not null check (source in ('oura', 'whoop')),
    access_token text not null,
    refresh_token text,
    expires_at timestamptz,
    scope text,
    external_user_id text,
    webhook_subscription_ids jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_id, source)
);

create index if not exists idx_wearable_tokens_source_extuser
    on public.wearable_oauth_tokens(source, external_user_id);

alter table public.wearable_oauth_tokens enable row level security;
-- Deliberadamente SEM policies: apenas service_role (que ignora RLS) lê/escreve.
-- O app cliente nunca toca tokens — só dispara edge functions.

comment on table public.wearable_oauth_tokens is
    'Tokens OAuth de wearables cloud (Oura/Whoop). Server-side only (service_role). external_user_id mapeia eventos de webhook → aluno. Hardening futuro: cifrar via Supabase Vault/pgsodium.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Prioridade de fonte (#6) — trigger BEFORE UPDATE
-- Impede que uma fonte de menor prioridade sobrescreva uma de maior prioridade
-- no mesmo dia. Centraliza a regra no banco → vale pra sync mobile E edge
-- function, sem alterar código de app.
--   oura/whoop (3) > healthkit/health_connect (2) > computed/outros (1)
-- Mesma prioridade → atualiza normalmente (re-sync com dado fresco).
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.wearable_source_priority(src text)
returns int
language sql
immutable
as $$
    select case src
        when 'oura' then 3
        when 'whoop' then 3
        when 'healthkit' then 2
        when 'health_connect' then 2
        else 1
    end;
$$;

create or replace function public.guard_wearable_source_priority()
returns trigger
language plpgsql
as $$
begin
    -- Se a fonte nova tem prioridade MENOR que a existente, pula o update
    -- (mantém o dado de maior prioridade). NULL em BEFORE UPDATE = skip.
    if public.wearable_source_priority(NEW.source)
       < public.wearable_source_priority(OLD.source) then
        return null;
    end if;
    return NEW;
end;
$$;

drop trigger if exists trg_priority_sleep on public.daily_sleep_samples;
create trigger trg_priority_sleep before update on public.daily_sleep_samples
    for each row execute function public.guard_wearable_source_priority();

drop trigger if exists trg_priority_activity on public.daily_activity_samples;
create trigger trg_priority_activity before update on public.daily_activity_samples
    for each row execute function public.guard_wearable_source_priority();

drop trigger if exists trg_priority_hr on public.hr_resting_samples;
create trigger trg_priority_hr before update on public.hr_resting_samples
    for each row execute function public.guard_wearable_source_priority();

drop trigger if exists trg_priority_hrv on public.hrv_samples;
create trigger trg_priority_hrv before update on public.hrv_samples
    for each row execute function public.guard_wearable_source_priority();

drop trigger if exists trg_priority_readiness on public.readiness_scores;
create trigger trg_priority_readiness before update on public.readiness_scores
    for each row execute function public.guard_wearable_source_priority();

comment on function public.guard_wearable_source_priority() is
    'Prioridade de fonte de wearable (#6): oura/whoop > healthkit/health_connect > computed. Bloqueia overwrite de menor prioridade no upsert por (student_id, date).';
