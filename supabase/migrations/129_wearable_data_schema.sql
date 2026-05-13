-- ============================================================================
-- Fase 14a · MVP Wearables Completo — schema base
-- ----------------------------------------------------------------------------
-- 6 tabelas: 4 de samples diários (sono, atividade, HR repouso, HRV) +
-- readiness_scores (cache do algoritmo) + wearable_connections (status).
--
-- RLS: aluno lê/escreve só samples próprios. Trainers NÃO acessam nesta
-- fase (Fase 15 introduz health_share_permissions + policy condicional).
--
-- Schema cobre toda a Fase 14 (a/b/c) — 14a popula via HealthKit, 14b
-- adiciona Health Connect (source='health_connect'), 14c só consome.
-- ============================================================================

-- ====================================================
-- 1. daily_sleep_samples
-- ====================================================
create table if not exists public.daily_sleep_samples (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    sample_date date not null,
    duration_minutes integer,
    efficiency_pct numeric(4,1),
    deep_minutes integer,
    rem_minutes integer,
    light_minutes integer,
    awake_minutes integer,
    source text not null default 'healthkit'
        check (source in ('healthkit', 'health_connect')),
    raw jsonb,
    synced_at timestamptz not null default now(),
    unique (student_id, sample_date)
);

-- ====================================================
-- 2. daily_activity_samples
-- ====================================================
create table if not exists public.daily_activity_samples (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    sample_date date not null,
    steps integer,
    calories_active numeric(8,2),
    distance_meters numeric(10,2),
    source text not null default 'healthkit'
        check (source in ('healthkit', 'health_connect')),
    synced_at timestamptz not null default now(),
    unique (student_id, sample_date)
);

-- ====================================================
-- 3. hr_resting_samples
-- ====================================================
create table if not exists public.hr_resting_samples (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    sample_date date not null,
    bpm integer not null,
    source text not null default 'healthkit'
        check (source in ('healthkit', 'health_connect')),
    synced_at timestamptz not null default now(),
    unique (student_id, sample_date)
);

-- ====================================================
-- 4. hrv_samples
-- ====================================================
create table if not exists public.hrv_samples (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    sample_date date not null,
    value_ms numeric(6,2) not null,
    source text not null default 'healthkit'
        check (source in ('healthkit', 'health_connect')),
    synced_at timestamptz not null default now(),
    unique (student_id, sample_date)
);

-- ====================================================
-- 5. readiness_scores (cache do algoritmo)
-- ====================================================
create table if not exists public.readiness_scores (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    score_date date not null,
    score integer not null check (score between 0 and 100),
    sleep_component numeric(4,3),
    hr_component numeric(4,3),
    hr_baseline_30d integer,
    sleep_minutes integer,
    computed_at timestamptz not null default now(),
    unique (student_id, score_date)
);

-- ====================================================
-- 6. wearable_connections
-- ====================================================
create table if not exists public.wearable_connections (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    source text not null
        check (source in ('healthkit', 'health_connect')),
    status text not null default 'active'
        check (status in ('active', 'revoked', 'error')),
    granted_categories text[] not null default array[]::text[],
    last_sync_at timestamptz,
    last_error text,
    connected_at timestamptz not null default now(),
    revoked_at timestamptz,
    unique (student_id, source)
);

-- ============================================================================
-- INDEXES (5) — lookups por aluno × data desc
-- ============================================================================
create index if not exists idx_sleep_student_date
    on public.daily_sleep_samples(student_id, sample_date desc);
create index if not exists idx_activity_student_date
    on public.daily_activity_samples(student_id, sample_date desc);
create index if not exists idx_hr_student_date
    on public.hr_resting_samples(student_id, sample_date desc);
create index if not exists idx_hrv_student_date
    on public.hrv_samples(student_id, sample_date desc);
create index if not exists idx_readiness_student_date
    on public.readiness_scores(student_id, score_date desc);

-- ============================================================================
-- RLS — Aluno lê só próprios. Trainer SEM acesso (Fase 15).
-- ============================================================================
alter table public.daily_sleep_samples enable row level security;
alter table public.daily_activity_samples enable row level security;
alter table public.hr_resting_samples enable row level security;
alter table public.hrv_samples enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.wearable_connections enable row level security;

-- ─── daily_sleep_samples ─────────────────────────────────────
create policy "students_read_own_sleep"
    on public.daily_sleep_samples for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_sleep"
    on public.daily_sleep_samples for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_sleep"
    on public.daily_sleep_samples for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ─── daily_activity_samples ──────────────────────────────────
create policy "students_read_own_activity"
    on public.daily_activity_samples for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_activity"
    on public.daily_activity_samples for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_activity"
    on public.daily_activity_samples for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ─── hr_resting_samples ──────────────────────────────────────
create policy "students_read_own_hr_resting"
    on public.hr_resting_samples for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_hr_resting"
    on public.hr_resting_samples for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_hr_resting"
    on public.hr_resting_samples for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ─── hrv_samples ─────────────────────────────────────────────
create policy "students_read_own_hrv"
    on public.hrv_samples for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_hrv"
    on public.hrv_samples for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_hrv"
    on public.hrv_samples for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ─── readiness_scores ────────────────────────────────────────
create policy "students_read_own_readiness"
    on public.readiness_scores for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_readiness"
    on public.readiness_scores for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_readiness"
    on public.readiness_scores for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ─── wearable_connections ────────────────────────────────────
create policy "students_read_own_connections"
    on public.wearable_connections for select
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_insert_own_connections"
    on public.wearable_connections for insert
    with check (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));
create policy "students_update_own_connections"
    on public.wearable_connections for update
    using (student_id in (
        select id from public.students where auth_user_id = auth.uid()
    ));

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on table public.daily_sleep_samples is
    'Sono diario lido do HealthKit (iOS) ou Health Connect (Android). Fase 14. Trainer nao acessa - Fase 15 adicionara compartilhamento.';
comment on table public.daily_activity_samples is
    'Passos / calorias ativas / distancia. Fase 14.';
comment on table public.hr_resting_samples is
    'HR de repouso diario. Fase 14.';
comment on table public.hrv_samples is
    'HRV diario (SDNN em ms). Requer Apple Watch ou wearable compativel. Fase 14.';
comment on table public.readiness_scores is
    'Score de prontidao diario cached. Algoritmo: 70% sono + 30% HR repouso vs baseline 30d. Fase 14.';
comment on table public.wearable_connections is
    'Status de conexao por fonte (healthkit/health_connect) + categorias autorizadas. Fase 14.';
