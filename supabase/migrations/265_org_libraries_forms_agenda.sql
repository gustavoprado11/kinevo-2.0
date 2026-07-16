-- ============================================================================
-- 265: Estúdios — bibliotecas compartilhadas (programas + forms), inbox org
--      e dados de agenda para o app
-- ============================================================================
-- Decisões Gustavo 16/jul (2ª rodada do redesenho "estúdio nas telas normais"):
--   • Bibliotecas de PROGRAMAS e FORMULÁRIOS/AVALIAÇÕES compartilhadas entre
--     os treinadores do estúdio (mesmo modelo dos exercícios, migr 263):
--     policies ADITIVAS de SELECT via is_org_colleague; escrita segue owner.
--   • Inbox de formulários entra na lógica do estúdio: respostas de alunos do
--     estúdio visíveis à equipe (RPC mobile idem).
--   • Atribuir template de COLEGA a aluno do estúdio passa a funcionar (o gate
--     de template dos RPCs de assign vira org-aware).
--   • App: RPC get_studio_agenda_data entrega regras+exceções+nomes p/ o
--     mobile projetar a agenda do estúdio client-side (expandAppointments é
--     TS compartilhado; RLS de recurring_appointments é por-trainer).
-- ============================================================================

-- 1) Policies de SELECT org — biblioteca de programas (árvore completa).
drop policy if exists program_templates_org_select on public.program_templates;
create policy program_templates_org_select on public.program_templates
    for select to authenticated
    using (public.is_org_colleague(trainer_id));

drop policy if exists workout_templates_org_select on public.workout_templates;
create policy workout_templates_org_select on public.workout_templates
    for select to authenticated
    using (
        program_template_id in (
            select pt.id from program_templates pt
            where public.is_org_colleague(pt.trainer_id)
        )
    );

drop policy if exists workout_item_templates_org_select on public.workout_item_templates;
create policy workout_item_templates_org_select on public.workout_item_templates
    for select to authenticated
    using (
        workout_template_id in (
            select wt.id
            from workout_templates wt
            join program_templates pt on pt.id = wt.program_template_id
            where public.is_org_colleague(pt.trainer_id)
        )
    );

-- 2) Biblioteca de formulários/avaliações.
drop policy if exists form_templates_org_select on public.form_templates;
create policy form_templates_org_select on public.form_templates
    for select to authenticated
    using (trainer_id is not null and public.is_org_colleague(trainer_id));

-- 3) Patches in-place dos RPCs (asserção de 1 ocorrência — falham alto).
DO $patch$
DECLARE
    v_def text;
    v_n int;
    r record;
BEGIN
    -- assign_program_from_template: template de COLEGA também vale.
    FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname='public' AND p.proname='assign_program_from_template'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 'pt.trainer_id = p_trainer_id', ''))) / length('pt.trainer_id = p_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'assign_program_from_template(tpl): %x', v_n; END IF;
        EXECUTE replace(v_def, 'pt.trainer_id = p_trainer_id',
            '(pt.trainer_id = p_trainer_id OR public.is_org_colleague(pt.trainer_id))');
    END LOOP;

    -- assign_program_to_student (4 args, MCP): idem no gate do template.
    FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname='public' AND p.proname='assign_program_to_student'
               AND pg_get_functiondef(p.oid) LIKE '%can_access_org_student%'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 'AND trainer_id = v_trainer_id', ''))) / length('AND trainer_id = v_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'assign_program_to_student(tpl): %x', v_n; END IF;
        EXECUTE replace(v_def, 'AND trainer_id = v_trainer_id',
            'AND (trainer_id = v_trainer_id OR public.is_org_colleague(trainer_id))');
    END LOOP;

    -- Mobile: biblioteca de programas mostra as da equipe.
    v_def := pg_get_functiondef('public.get_trainer_program_templates()'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, 'pt.trainer_id = v_trainer_id', ''))) / length('pt.trainer_id = v_trainer_id');
    IF v_n <> 1 THEN RAISE EXCEPTION 'get_trainer_program_templates: %x', v_n; END IF;
    EXECUTE replace(v_def, 'pt.trainer_id = v_trainer_id',
        '(pt.trainer_id = v_trainer_id OR public.is_org_colleague(pt.trainer_id))');

    -- Mobile: templates de forms da equipe.
    v_def := pg_get_functiondef('public.get_trainer_form_templates()'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, 'ft.trainer_id = v_trainer_id', ''))) / length('ft.trainer_id = v_trainer_id');
    IF v_n <> 1 THEN RAISE EXCEPTION 'get_trainer_form_templates: %x', v_n; END IF;
    EXECUTE replace(v_def, 'ft.trainer_id = v_trainer_id',
        '(ft.trainer_id = v_trainer_id OR public.is_org_colleague(ft.trainer_id))');

    -- Mobile: inbox de respostas inclui os alunos do estúdio.
    v_def := pg_get_functiondef('public.get_trainer_form_submissions()'::regprocedure);
    v_n := (length(v_def) - length(replace(v_def, 'fs.trainer_id = v_trainer_id', ''))) / length('fs.trainer_id = v_trainer_id');
    IF v_n <> 1 THEN RAISE EXCEPTION 'get_trainer_form_submissions: %x', v_n; END IF;
    EXECUTE replace(v_def, 'fs.trainer_id = v_trainer_id',
        '(fs.trainer_id = v_trainer_id OR public.can_access_org_student(fs.student_id))');
END $patch$;

-- 4) Agenda do estúdio para o APP: regras + exceções + nomes num jsonb; o
--    mobile projeta com expandAppointments (shared). Gate: membro ATIVO.
create or replace function public.get_studio_agenda_data(p_start date, p_end date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
    v_trainer uuid;
    v_org uuid;
    v_result jsonb;
begin
    v_trainer := current_trainer_id();
    if v_trainer is null then return null; end if;
    select om.organization_id into v_org
    from organization_members om
    where om.trainer_id = v_trainer and om.status = 'active'
    limit 1;
    if v_org is null then return null; end if;

    with coaches as (
        select om.trainer_id, t.name
        from organization_members om
        join trainers t on t.id = om.trainer_id
        where om.organization_id = v_org and om.status = 'active' and om.is_coach = true
    ),
    rules as (
        select ra.* from recurring_appointments ra
        join coaches c on c.trainer_id = ra.trainer_id
        where ra.status = 'active'
          and ra.starts_on <= p_end
          and (ra.ends_on is null or ra.ends_on >= p_start)
    ),
    exc as (
        select ae.* from appointment_exceptions ae
        where ae.recurring_appointment_id in (select id from rules)
          and (
            (ae.occurrence_date >= p_start and ae.occurrence_date <= p_end)
            or (ae.new_date >= p_start and ae.new_date <= p_end)
          )
    ),
    studs as (
        select s.id, s.name from students s
        where s.id in (select student_id from rules)
    )
    select jsonb_build_object(
        'rules', coalesce((select jsonb_agg(to_jsonb(r)) from rules r), '[]'::jsonb),
        'exceptions', coalesce((select jsonb_agg(to_jsonb(e)) from exc e), '[]'::jsonb),
        'coaches', coalesce((select jsonb_agg(jsonb_build_object('id', c.trainer_id, 'name', c.name)) from coaches c), '[]'::jsonb),
        'students', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name)) from studs st), '[]'::jsonb)
    ) into v_result;

    return v_result;
end;
$$;
revoke execute on function public.get_studio_agenda_data(date, date) from anon, public;
grant execute on function public.get_studio_agenda_data(date, date) to authenticated, service_role;
