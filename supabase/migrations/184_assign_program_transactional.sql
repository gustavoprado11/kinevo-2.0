-- ============================================================================
-- Migration 184: assign_program_from_template — atribuição transacional
--
-- Problema (auditoria 09/06/2026, achado crítico #4): a atribuição de
-- programa arquiva o programa vigente e copia treinos/itens/séries em N
-- round-trips SEM transação, em três implementações paralelas:
--   - supabase/functions/assign-program (mobile)
--   - web .../actions/assign-program.ts (server action)
--   - web /api/programs/assign (branch templateId)
-- Falha no meio do loop deixa o aluno sem programa válido (o anterior já
-- foi marcado completed) ou com programa pela metade.
--
-- Além da atomicidade, as cópias divergiram: server action e API route NÃO
-- copiavam workout_item_set_templates / method_key / rounds — prescrição
-- avançada atribuída pelo web perdia as séries detalhadas.
--
-- Esta RPC unifica o comportamento (superset do mais completo, a edge):
--   - completa o programa vigente (active OU expired, como o web fazia)
--   - scheduled_days: override do caller > frequency do template; sempre
--     ordenado cronologicamente (como o web fazia)
--   - copia itens raiz + séries por item (set templates) + filhos de
--     superset, com method_key/rounds (como a edge fazia)
--   - metadados de prescrição IA opcionais (como a server action fazia)
-- Notificação ao aluno fica FORA da RPC, nos callers (best-effort; não deve
-- desfazer a atribuição se falhar).
--
-- Autorização: SECURITY DEFINER. service_role (edge) passa direto; usuário
-- autenticado precisa ser o trainer dono (auth.uid() → trainers.auth_user_id).
-- Ownership de aluno e template é validado sempre, para qualquer caller.
-- ============================================================================

create or replace function public.assign_program_from_template(
    p_trainer_id uuid,
    p_student_id uuid,
    p_template_id uuid,
    p_is_scheduled boolean default false,
    p_scheduled_start_date date default null,
    p_workout_schedule jsonb default null,
    p_prescription_generation_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_template public.program_templates%rowtype;
    v_status text;
    v_started_at timestamptz;
    v_expires_at timestamptz;
    v_program_id uuid;
begin
    if auth.role() is distinct from 'service_role' then
        if not exists (
            select 1 from public.trainers t
            where t.id = p_trainer_id and t.auth_user_id = auth.uid()
        ) then
            raise exception 'Unauthorized' using errcode = '42501';
        end if;
    end if;

    if not exists (
        select 1 from public.students s
        where s.id = p_student_id and s.coach_id = p_trainer_id
    ) then
        raise exception 'Student not found or unauthorized';
    end if;

    select * into v_template
    from public.program_templates pt
    where pt.id = p_template_id and pt.trainer_id = p_trainer_id;
    if not found then
        raise exception 'Template not found';
    end if;

    if p_is_scheduled then
        if p_scheduled_start_date is null then
            raise exception 'scheduled_start_date is required when is_scheduled = true';
        end if;
        v_status := 'scheduled';
        v_started_at := null;
    else
        v_status := 'active';
        v_started_at := now();

        update public.assigned_programs
        set status = 'completed',
            completed_at = now(),
            updated_at = now()
        where student_id = p_student_id
          and status in ('active', 'expired');
    end if;

    v_expires_at := case
        when v_started_at is not null and v_template.duration_weeks is not null
            then v_started_at + (v_template.duration_weeks * interval '1 week')
        else null
    end;

    insert into public.assigned_programs (
        student_id, trainer_id, source_template_id, name, description,
        duration_weeks, status, started_at, scheduled_start_date,
        current_week, expires_at, ai_generated, prescription_generation_id
    ) values (
        p_student_id, p_trainer_id, p_template_id, v_template.name,
        v_template.description, v_template.duration_weeks, v_status,
        v_started_at,
        case when p_is_scheduled then p_scheduled_start_date end,
        1, v_expires_at,
        p_prescription_generation_id is not null,
        p_prescription_generation_id
    ) returning id into v_program_id;

    -- Cópia set-based em um único statement: treinos → itens raiz → séries
    -- por item → filhos de superset. CTEs com INSERT executam exatamente uma
    -- vez mesmo quando não referenciadas pelo statement principal.
    with new_workouts as (
        insert into public.assigned_workouts
            (assigned_program_id, source_template_id, name, order_index, scheduled_days)
        select
            v_program_id, wt.id, wt.name, wt.order_index,
            case
                when p_workout_schedule ? wt.order_index::text then
                    coalesce((
                        select array_agg(e.v::int order by e.v::int)
                        from jsonb_array_elements_text(p_workout_schedule -> wt.order_index::text) e(v)
                    ), '{}')
                else
                    coalesce((
                        select array_agg(m.d order by m.d)
                        from (
                            select case lower(f.day)
                                when 'sun' then 0 when 'mon' then 1 when 'tue' then 2
                                when 'wed' then 3 when 'thu' then 4 when 'fri' then 5
                                when 'sat' then 6
                            end as d
                            from unnest(coalesce(wt.frequency, '{}')) f(day)
                        ) m
                        where m.d is not null
                    ), '{}')
            end
        from public.workout_templates wt
        where wt.program_template_id = p_template_id
        returning id, source_template_id
    ),
    new_root_items as (
        insert into public.assigned_workout_items (
            assigned_workout_id, source_template_id, item_type, order_index,
            exercise_id, exercise_name, exercise_muscle_group, exercise_equipment,
            sets, reps, rest_seconds, notes, substitute_exercise_ids,
            exercise_function, item_config, parent_item_id, method_key, rounds
        )
        select
            nw.id, wit.id, wit.item_type, wit.order_index,
            wit.exercise_id, ex.name,
            (
                select string_agg(mg.name, ', ' order by mg.name)
                from public.exercise_muscle_groups emg
                join public.muscle_groups mg on mg.id = emg.muscle_group_id
                where emg.exercise_id = wit.exercise_id
            ),
            ex.equipment,
            wit.sets, wit.reps, wit.rest_seconds, wit.notes,
            coalesce(wit.substitute_exercise_ids, '{}'),
            wit.exercise_function, coalesce(wit.item_config, '{}'::jsonb),
            null, wit.method_key, coalesce(wit.rounds, 1)
        from public.workout_item_templates wit
        join new_workouts nw on nw.source_template_id = wit.workout_template_id
        left join public.exercises ex on ex.id = wit.exercise_id
        where wit.parent_item_id is null
        returning id, source_template_id
    ),
    new_sets as (
        insert into public.assigned_workout_item_sets (
            assigned_workout_item_id, set_number, set_type, reps, rest_seconds,
            weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
        )
        select
            nri.id, st.set_number, st.set_type, st.reps, st.rest_seconds,
            st.weight_target_kg, st.weight_target_pct1rm, st.rir, st.tempo,
            st.notes, st.round_number
        from public.workout_item_set_templates st
        join new_root_items nri on nri.source_template_id = st.workout_item_template_id
    )
    insert into public.assigned_workout_items (
        assigned_workout_id, source_template_id, item_type, order_index,
        exercise_id, exercise_name, exercise_muscle_group, exercise_equipment,
        sets, reps, rest_seconds, notes, substitute_exercise_ids,
        exercise_function, item_config, parent_item_id, method_key, rounds
    )
    select
        nw.id, wit.id, wit.item_type, wit.order_index,
        wit.exercise_id, ex.name,
        (
            select string_agg(mg.name, ', ' order by mg.name)
            from public.exercise_muscle_groups emg
            join public.muscle_groups mg on mg.id = emg.muscle_group_id
            where emg.exercise_id = wit.exercise_id
        ),
        ex.equipment,
        wit.sets, wit.reps, wit.rest_seconds, wit.notes,
        coalesce(wit.substitute_exercise_ids, '{}'),
        wit.exercise_function, coalesce(wit.item_config, '{}'::jsonb),
        nri.id, wit.method_key, coalesce(wit.rounds, 1)
    from public.workout_item_templates wit
    join new_workouts nw on nw.source_template_id = wit.workout_template_id
    join new_root_items nri on nri.source_template_id = wit.parent_item_id
    left join public.exercises ex on ex.id = wit.exercise_id
    where wit.parent_item_id is not null;

    if p_prescription_generation_id is not null then
        update public.prescription_generations
        set status = 'approved',
            approved_at = now(),
            assigned_program_id = v_program_id,
            updated_at = now()
        where id = p_prescription_generation_id
          and trainer_id = p_trainer_id;
    end if;

    return v_program_id;
end;
$$;

revoke all on function public.assign_program_from_template(uuid, uuid, uuid, boolean, date, jsonb, uuid) from public;
revoke all on function public.assign_program_from_template(uuid, uuid, uuid, boolean, date, jsonb, uuid) from anon;
grant execute on function public.assign_program_from_template(uuid, uuid, uuid, boolean, date, jsonb, uuid) to authenticated;
grant execute on function public.assign_program_from_template(uuid, uuid, uuid, boolean, date, jsonb, uuid) to service_role;
