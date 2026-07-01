-- ============================================================================
-- Migration 223: baseline dos RPCs de KPI de Estúdio (DRIFT → repo)
--
-- get_org_coach_load / get_org_class_overview / get_org_athlete_absences
-- existem em produção (criados por migration cloud-only, sem arquivo local) e
-- NÃO são chamados por nenhum código ainda. São formalizados aqui idênticos ao
-- prod para que um db reset os tenha (dependem de 222: students.organization_id).
--
-- Segurança (já no prod, preservada): SECURITY DEFINER + search_path fixo +
-- gate is_org_member(p_org) no WHERE (quem não é membro recebe zero linhas —
-- sem vazamento cross-org). NÃO apertar para is_org_manager aqui (P1.3 decide).
-- Idempotente: create or replace = no-op em prod.
-- ============================================================================

-- Carga por treinador: nº de turmas e de alunos ativos na org ----------------
create or replace function public.get_org_coach_load(p_org uuid)
returns table(coach_id uuid, coach_name text, classes bigint, athletes bigint)
language sql
stable security definer
set search_path to 'public'
as $$
    select t.id, t.name,
           count(distinct ag.id) as classes,
           count(distinct s.id)  as athletes
    from organization_members om
    join trainers t on t.id = om.trainer_id
    left join appointment_groups ag on ag.coach_id = t.id and ag.organization_id = p_org and ag.status = 'active'
    left join students s on s.coach_id = t.id and s.organization_id = p_org and s.status = 'active'
    where om.organization_id = p_org and om.status = 'active' and om.is_coach = true and public.is_org_member(p_org)
    group by t.id, t.name
    order by athletes desc;
$$;

-- Ocupação por turma/horário: matriculados vs capacidade ---------------------
create or replace function public.get_org_class_overview(p_org uuid)
returns table(class_id uuid, title text, coach_id uuid, coach_name text,
              day_of_week smallint, start_time time without time zone,
              capacity smallint, enrolled bigint, occupancy_pct numeric)
language sql
stable security definer
set search_path to 'public'
as $$
    select ag.id, ag.title, ag.coach_id, t.name,
           ag.day_of_week, ag.start_time, ag.capacity,
           count(ra.id) as enrolled,
           case when ag.capacity is null or ag.capacity = 0 then null
                else round(count(ra.id)::numeric * 100 / ag.capacity, 0) end as occupancy_pct
    from appointment_groups ag
    join trainers t on t.id = ag.coach_id
    left join recurring_appointments ra on ra.appointment_group_id = ag.id and ra.status = 'active'
    where ag.organization_id = p_org and ag.status = 'active' and public.is_org_member(p_org)
    group by ag.id, ag.title, ag.coach_id, t.name, ag.day_of_week, ag.start_time, ag.capacity
    order by ag.day_of_week nulls last, ag.start_time nulls last;
$$;

-- Frequência/faltas por aluno nos últimos p_days dias ------------------------
create or replace function public.get_org_athlete_absences(p_org uuid, p_days integer default 30)
returns table(student_id uuid, student_name text, coach_id uuid, no_shows bigint, completed bigint)
language sql
stable security definer
set search_path to 'public'
as $$
    select s.id, s.name, s.coach_id,
           count(*) filter (where ae.kind = 'no_show')   as no_shows,
           count(*) filter (where ae.kind = 'completed') as completed
    from students s
    join recurring_appointments ra on ra.student_id = s.id
    join appointment_exceptions ae on ae.recurring_appointment_id = ra.id
    where s.organization_id = p_org
      and ae.occurrence_date >= (current_date - p_days)
      and public.is_org_member(p_org)
    group by s.id, s.name, s.coach_id
    having count(*) filter (where ae.kind = 'no_show') > 0
    order by no_shows desc;
$$;

revoke execute on function public.get_org_coach_load(uuid)                from anon, public;
revoke execute on function public.get_org_class_overview(uuid)            from anon, public;
revoke execute on function public.get_org_athlete_absences(uuid, integer) from anon, public;
grant execute on function public.get_org_coach_load(uuid)                to authenticated, service_role;
grant execute on function public.get_org_class_overview(uuid)            to authenticated, service_role;
grant execute on function public.get_org_athlete_absences(uuid, integer) to authenticated, service_role;
