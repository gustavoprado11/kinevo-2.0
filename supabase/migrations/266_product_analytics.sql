-- 266 — Instrumentação de produto (P0 da auditoria de 13/jul).
-- First-party: eventos em tabela própria (LGPD-friendly, consultável por SQL/
-- assistente), attribution de origem no signup e view canônica do funil.
-- Backward-compatible: só adições.

-- ── Tabela de eventos ────────────────────────────────────────────────
create table if not exists product_events (
    id bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    trainer_id uuid references trainers(id) on delete set null,
    student_id uuid references students(id) on delete set null,
    event text not null,
    source text not null default 'web',
    props jsonb not null default '{}'::jsonb
);

create index if not exists idx_product_events_event_time on product_events (event, occurred_at desc);
create index if not exists idx_product_events_trainer on product_events (trainer_id, occurred_at desc);

alter table product_events enable row level security;
-- Sem policies de leitura/escrita: clients escrevem SÓ pela RPC definer
-- abaixo; leitura é service_role (assistente/MCP/queries internas).

-- ── RPC de escrita para clients logados (web e mobile) ───────────────
-- Resolve trainer/aluno do JWT; valida tamanho; nunca lança (analytics
-- não pode quebrar fluxo de produto).
create or replace function log_product_event(
    p_event text,
    p_props jsonb default '{}'::jsonb,
    p_source text default 'web'
) returns void
language plpgsql security definer set search_path = public as $$
declare
    v_trainer uuid;
    v_student uuid;
begin
    if auth.uid() is null then return; end if;
    if p_event is null or length(p_event) = 0 then return; end if;
    if p_props is null or pg_column_size(p_props) > 8192 then
        p_props := '{}'::jsonb;
    end if;

    select id into v_trainer from trainers where auth_user_id = auth.uid();
    select id into v_student from students where auth_user_id = auth.uid() limit 1;
    if v_trainer is null and v_student is null then return; end if;

    insert into product_events (trainer_id, student_id, event, source, props)
    values (v_trainer, v_student, left(p_event, 64),
            coalesce(nullif(left(p_source, 16), ''), 'web'), p_props);
exception when others then
    -- analytics jamais propaga erro pro caller
    return;
end $$;

revoke all on function log_product_event(text, jsonb, text) from public, anon;
grant execute on function log_product_event(text, jsonb, text) to authenticated;

-- ── Trigger: treino concluído vira evento (web/mobile/watch, sem client) ──
create or replace function trg_log_workout_completed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.status = 'completed'
       and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
        insert into product_events (trainer_id, student_id, event, source, props)
        values (new.trainer_id, new.student_id, 'student_workout_completed', 'server',
                jsonb_build_object('session_id', new.id, 'workout_name', new.workout_name));
    end if;
    return new;
exception when others then
    return new;
end $$;

drop trigger if exists product_event_workout_completed on workout_sessions;
create trigger product_event_workout_completed
    after insert or update of status on workout_sessions
    for each row execute function trg_log_workout_completed();

-- ── Attribution de signup ────────────────────────────────────────────
alter table trainers add column if not exists signup_source jsonb;

-- ── View canônica do funil (leitura: service_role/assistente) ────────
create or replace view v_trainer_funnel as
select
    t.id,
    t.name,
    t.email,
    t.created_at as signup_at,
    t.signup_source,
    (select min(e.occurred_at) from product_events e
      where e.trainer_id = t.id and e.event = 'welcome_tour_completed') as tour_done_at,
    (select min(s.created_at) from students s
      where s.coach_id = t.id and s.is_trainer_profile = false) as first_student_at,
    (select min(p.created_at) from assigned_programs p
      where p.trainer_id = t.id) as first_program_at,
    (select min(e.occurred_at) from product_events e
      where e.trainer_id = t.id and e.event = 'milestone_app_link_shared') as app_shared_at,
    (select min(w.completed_at) from workout_sessions w
      where w.trainer_id = t.id and w.status = 'completed') as first_student_workout_at,
    (select min(e.occurred_at) from product_events e
      where e.trainer_id = t.id and e.event = 'checkout_started') as checkout_started_at,
    (select min(sub.created_at) from subscriptions sub
      where sub.trainer_id = t.id and sub.status in ('active', 'trialing')) as subscribed_at
from trainers t;

revoke all on v_trainer_funnel from public, anon, authenticated;
