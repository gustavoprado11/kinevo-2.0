-- ============================================================================
-- 256: Estúdios v1 — RPCs do painel do gestor
-- ============================================================================
-- Agregações por TREINADOR RESPONSÁVEL (students.coach_id) e por ALUNO do
-- estúdio. Agrupar por coach_id (não por workout_sessions.trainer_id) faz o
-- crédito acompanhar a reatribuição de responsável.
--
-- Gate is_org_manager(p_org) no WHERE: não-gestor recebe ZERO linhas (o painel
-- é do gestor; coaches usam as telas normais). SECURITY DEFINER + search_path.
-- ============================================================================

-- Por treinador na semana: alunos ativos, sessões feitas/esperadas, aderência.
create or replace function public.get_org_coach_week_stats(p_org uuid, p_week_start date)
returns table(
    coach_id uuid,
    coach_name text,
    active_students bigint,
    completed_sessions bigint,
    expected_sessions bigint,
    adherence_pct numeric
)
language sql
stable security definer
set search_path to 'public'
as $$
    with coaches as (
        select t.id, t.name
        from organization_members om
        join trainers t on t.id = om.trainer_id
        where om.organization_id = p_org and om.status = 'active' and om.is_coach = true
    ),
    active_stu as (
        select s.id, s.coach_id
        from students s
        where s.organization_id = p_org and s.status = 'active' and s.is_trainer_profile = false
    ),
    sess as (
        select st.coach_id, count(*) as done
        from workout_sessions ws
        join active_stu st on st.id = ws.student_id
        where ws.status = 'completed'
          and ws.completed_at >= p_week_start::timestamptz
          and ws.completed_at < (p_week_start + 7)::timestamptz
        group by st.coach_id
    ),
    expected as (
        select st.coach_id, coalesce(sum(coalesce(array_length(aw.scheduled_days, 1), 0)), 0) as exp
        from active_stu st
        join assigned_programs ap on ap.student_id = st.id and ap.status = 'active'
        join assigned_workouts aw on aw.assigned_program_id = ap.id
        group by st.coach_id
    )
    select c.id, c.name,
        (select count(*) from active_stu a where a.coach_id = c.id) as active_students,
        coalesce(se.done, 0) as completed_sessions,
        coalesce(e.exp, 0) as expected_sessions,
        case when coalesce(e.exp, 0) = 0 then null
             else round(coalesce(se.done, 0)::numeric * 100 / e.exp, 0) end as adherence_pct
    from coaches c
    left join sess se on se.coach_id = c.id
    left join expected e on e.coach_id = c.id
    where public.is_org_manager(p_org)
    order by active_students desc, c.name;
$$;

-- Por aluno do estúdio: responsável, programa ativo?, último treino, risco.
create or replace function public.get_org_students_overview(p_org uuid)
returns table(
    student_id uuid,
    student_name text,
    coach_id uuid,
    coach_name text,
    has_active_program boolean,
    last_session timestamptz,
    at_risk boolean
)
language sql
stable security definer
set search_path to 'public'
as $$
    select s.id, s.name, s.coach_id, t.name,
        exists(select 1 from assigned_programs ap where ap.student_id = s.id and ap.status = 'active') as has_active_program,
        (select max(ws.completed_at) from workout_sessions ws where ws.student_id = s.id and ws.status = 'completed') as last_session,
        (
            not exists(select 1 from assigned_programs ap where ap.student_id = s.id and ap.status = 'active')
            or coalesce(
                (select max(ws.completed_at) from workout_sessions ws where ws.student_id = s.id and ws.status = 'completed'),
                'epoch'::timestamptz
            ) < now() - interval '14 days'
        ) as at_risk
    from students s
    left join trainers t on t.id = s.coach_id
    where s.organization_id = p_org and s.status = 'active' and s.is_trainer_profile = false
      and public.is_org_manager(p_org)
    order by at_risk desc, s.name;
$$;

revoke execute on function public.get_org_coach_week_stats(uuid, date) from anon, public;
revoke execute on function public.get_org_students_overview(uuid)      from anon, public;
grant execute on function public.get_org_coach_week_stats(uuid, date) to authenticated, service_role;
grant execute on function public.get_org_students_overview(uuid)      to authenticated, service_role;
