-- ============================================================================
-- Fase 16 · Strava Integration — external_activities + wearable_connections ext
-- ============================================================================
-- Atividades físicas externas ao Kinevo (corrida, bike, natação, trilha, etc.)
-- importadas via Strava. Filosofia: Strava é contexto, não protagonista.
-- Trainer NÃO acessa nesta fase — Fase 15 adicionará compartilhamento.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. external_activities
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.external_activities (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,

    -- Origem
    source text not null check (source in ('strava')),
    external_id text not null,

    -- Metadados
    activity_type text not null,
        -- 'running', 'cycling', 'swimming', 'hiking', 'walking',
        -- 'workout', 'rowing', 'crossfit', 'other'
    name text not null,

    -- Métricas
    distance_meters numeric(10, 2),
    duration_seconds integer not null,
    calories numeric(8, 2),
    avg_heart_rate integer,
    max_heart_rate integer,
    elevation_gain_meters numeric(8, 2),

    -- Timing
    started_at timestamptz not null,

    -- Raw payload pra futuras features (polyline, splits, etc.)
    raw jsonb,

    synced_at timestamptz not null default now(),

    unique (source, external_id)
);

create index if not exists idx_ext_activities_student_date
    on public.external_activities(student_id, started_at desc);

alter table public.external_activities enable row level security;

create policy "students_read_own_activities"
    on public.external_activities for select
    using (
        student_id in (
            select id from public.students where auth_user_id = auth.uid()
        )
    );

create policy "students_insert_own_activities"
    on public.external_activities for insert
    with check (
        student_id in (
            select id from public.students where auth_user_id = auth.uid()
        )
    );

create policy "students_update_own_activities"
    on public.external_activities for update
    using (
        student_id in (
            select id from public.students where auth_user_id = auth.uid()
        )
    );

-- DELIBERADAMENTE: nenhuma policy pra trainers. Fase 15 adicionará
-- policy condicional via health_share_permissions.

comment on table public.external_activities is
    'Fase 16 · Atividades físicas externas ao Kinevo (Strava). '
    'Trainer não acessa — Fase 15 adicionará compartilhamento.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. wearable_connections — adicionar source = 'strava'
-- ──────────────────────────────────────────────────────────────────────────
alter table public.wearable_connections
    drop constraint if exists wearable_connections_source_check;

alter table public.wearable_connections
    add constraint wearable_connections_source_check
    check (source in ('healthkit', 'health_connect', 'strava'));

-- Strava athlete id (nullable — só preenchido pra conexões Strava).
-- Útil pra debugging e identificar conta vinculada sem precisar abrir tokens.
alter table public.wearable_connections
    add column if not exists external_user_id text;

comment on column public.wearable_connections.external_user_id is
    'ID do usuário na fonte externa. Ex: Strava athlete.id. NULL pra HealthKit/Health Connect.';
