-- ============================================================================
-- Fase 13 · Onda 1A — Persistir HR/Calorias do Apple Watch
-- ----------------------------------------------------------------------------
-- workout_health_samples: 1 row por workout_session_id, com agregados (HR
-- avg/max/min, calorias ativas) e a série de HR downsampled em jsonb.
--
-- RLS: aluno lê/escreve/atualiza só samples próprios. Trainers NÃO acessam
-- nesta fase (Fase 15 introduz health_share_permissions + policy condicional).
--
-- Nota: workout_sessions.student_id referencia students(id), não auth.uid().
-- Por isso a policy faz join via students.auth_user_id.
-- ============================================================================

create table if not exists public.workout_health_samples (
    id uuid primary key default gen_random_uuid(),
    workout_session_id uuid not null references public.workout_sessions(id)
        on delete cascade,

    -- Aggregates
    avg_heart_rate numeric(5,1),
    max_heart_rate integer,
    min_heart_rate integer,
    calories_active numeric(8,2),

    -- Raw HR series, downsampled a ~1 sample/min.
    -- Format: [{"ts": <unix_epoch_seconds>, "bpm": <int>}, ...]
    heart_rate_series jsonb,

    source text not null default 'apple_watch'
        check (source in ('apple_watch')),

    created_at timestamptz not null default now(),

    unique (workout_session_id)
);

create index if not exists idx_workout_health_samples_session
    on public.workout_health_samples(workout_session_id);

alter table public.workout_health_samples enable row level security;

create policy "students_read_own_health_samples"
    on public.workout_health_samples for select
    using (
        exists (
            select 1
            from public.workout_sessions ws
            join public.students s on s.id = ws.student_id
            where ws.id = workout_health_samples.workout_session_id
              and s.auth_user_id = auth.uid()
        )
    );

create policy "students_insert_own_health_samples"
    on public.workout_health_samples for insert
    with check (
        exists (
            select 1
            from public.workout_sessions ws
            join public.students s on s.id = ws.student_id
            where ws.id = workout_health_samples.workout_session_id
              and s.auth_user_id = auth.uid()
        )
    );

create policy "students_update_own_health_samples"
    on public.workout_health_samples for update
    using (
        exists (
            select 1
            from public.workout_sessions ws
            join public.students s on s.id = ws.student_id
            where ws.id = workout_health_samples.workout_session_id
              and s.auth_user_id = auth.uid()
        )
    );

comment on table public.workout_health_samples is
    'HR + calorias coletadas pelo Apple Watch durante workout sessions. '
    'Fase 13 (Onda 1A). Trainers nao acessam ainda - Fase 15.';
