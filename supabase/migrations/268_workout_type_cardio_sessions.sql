-- ============================================================================
-- Migration 268: workout_type — sessões aeróbias exclusivas
-- ============================================================================
-- Treinos aeróbios hoje só existem como ITEM (item_type 'cardio') dentro de
-- uma sessão de força. Esta migração introduz o TIPO DA SESSÃO para permitir
-- prescrever treinos aeróbios exclusivos como sessões de primeira classe:
--
--   1. Coluna workout_type ('strength' default | 'cardio') em
--      workout_templates e assigned_workouts, com CHECK.
--   2. Backfill: sessões existentes cujo conteúdo já é só-cardio (têm >=1
--      item cardio e nenhum exercise/superset) viram 'cardio'.
--   3. Todas as RPCs que copiam/gravam sessões passam a propagar o campo:
--        • assign_program_from_template
--        • assign_program_to_student (4 args, MCP)
--        • assign_program_from_snapshot (aprovação de prescrição IA)
--        • save_assigned_program_tree (builder: editar programa do aluno)
--        • create_assigned_program_tree (builder IA: draft do aluno)
--        • create_program_template_tree (builder: criar template)
--        • duplicate_program_template (1 arg web e 2 args MCP)
--      NOTA: as migrações 260/262/265 patcharam algumas dessas funções
--      IN-PLACE (org-awareness) — os corpos abaixo foram extraídos de PROD em
--      20/07/2026 e portanto JÁ INCLUEM esses patches. Este arquivo volta a
--      ser a definição canônica. CREATE OR REPLACE preserva as ACLs
--      existentes (grants das migrações originais continuam valendo).
--   4. get_student_today_workout_for_trainer (sala de treino web/mobile)
--      devolve 'workoutType' no JSONB — patch in-place no prosrc vigente
--      (mesmo padrão das 260/262/265), com âncoras verificadas 1x.
--
-- Payloads JSONB: a chave workout_type é OPCIONAL em todos os fluxos
-- (coalesce para 'strength' / valor atual) — clientes antigos seguem
-- funcionando sem mudança.
-- ============================================================================

-- ============================================================================
-- 1) Colunas + CHECK
-- ============================================================================

ALTER TABLE workout_templates
    ADD COLUMN IF NOT EXISTS workout_type TEXT NOT NULL DEFAULT 'strength';

ALTER TABLE workout_templates
    DROP CONSTRAINT IF EXISTS workout_templates_workout_type_check;

ALTER TABLE workout_templates
    ADD CONSTRAINT workout_templates_workout_type_check
    CHECK (workout_type IN ('strength', 'cardio'));

ALTER TABLE assigned_workouts
    ADD COLUMN IF NOT EXISTS workout_type TEXT NOT NULL DEFAULT 'strength';

ALTER TABLE assigned_workouts
    DROP CONSTRAINT IF EXISTS assigned_workouts_workout_type_check;

ALTER TABLE assigned_workouts
    ADD CONSTRAINT assigned_workouts_workout_type_check
    CHECK (workout_type IN ('strength', 'cardio'));

-- ============================================================================
-- 2) Backfill: sessões que já são só-cardio (>=1 cardio, zero força)
-- ============================================================================

UPDATE workout_templates wt
SET workout_type = 'cardio'
WHERE EXISTS (
        SELECT 1 FROM workout_item_templates wit
        WHERE wit.workout_template_id = wt.id AND wit.item_type = 'cardio'
    )
  AND NOT EXISTS (
        SELECT 1 FROM workout_item_templates wit
        WHERE wit.workout_template_id = wt.id
          AND wit.item_type IN ('exercise', 'superset')
    );

UPDATE assigned_workouts aw
SET workout_type = 'cardio'
WHERE EXISTS (
        SELECT 1 FROM assigned_workout_items awi
        WHERE awi.assigned_workout_id = aw.id AND awi.item_type = 'cardio'
    )
  AND NOT EXISTS (
        SELECT 1 FROM assigned_workout_items awi
        WHERE awi.assigned_workout_id = aw.id
          AND awi.item_type IN ('exercise', 'superset')
    );

-- ============================================================================
-- 3a) assign_program_from_template — copia workout_type do template
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
        where s.id = p_student_id and (s.coach_id = p_trainer_id OR public.can_access_org_student(s.id))
    ) then
        raise exception 'Student not found or unauthorized';
    end if;

    select * into v_template
    from public.program_templates pt
    where pt.id = p_template_id and (pt.trainer_id = p_trainer_id OR public.is_org_colleague(pt.trainer_id));
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

    with new_workouts as (
        insert into public.assigned_workouts
            (assigned_program_id, source_template_id, name, order_index, scheduled_days, workout_type)
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
            end,
            coalesce(wt.workout_type, 'strength')
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

-- ============================================================================
-- 3b) assign_program_to_student (4 args, MCP) — copia workout_type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_program_to_student(
    p_trainer_id uuid,
    p_template_id uuid,
    p_student_id uuid,
    p_start_date timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_assigned_program_id UUID;
    v_template RECORD;
    v_workout RECORD;
    v_assigned_workout_id UUID;
    v_item RECORD;
    v_assigned_item_id UUID;
    v_parent_mapping JSONB := '{}';
    v_child_item RECORD;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM students
        WHERE id = p_student_id AND (coach_id = v_trainer_id OR public.can_access_org_student(p_student_id))
    ) THEN
        RAISE EXCEPTION 'Student not found or does not belong to this trainer';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM program_templates
        WHERE id = p_template_id AND (trainer_id = v_trainer_id OR public.is_org_colleague(trainer_id))
    ) THEN
        RAISE EXCEPTION 'Program template not found or does not belong to this trainer';
    END IF;

    SELECT * INTO v_template FROM program_templates WHERE id = p_template_id;

    UPDATE assigned_programs
    SET status = 'paused', updated_at = now()
    WHERE student_id = p_student_id AND status = 'active';

    INSERT INTO assigned_programs (
        student_id, trainer_id, source_template_id, name, description,
        duration_weeks, status, started_at, current_week
    ) VALUES (
        p_student_id, v_trainer_id, p_template_id, v_template.name, v_template.description,
        v_template.duration_weeks, 'active', p_start_date, 1
    ) RETURNING id INTO v_assigned_program_id;

    FOR v_workout IN
        SELECT * FROM workout_templates
        WHERE program_template_id = p_template_id
        ORDER BY order_index
    LOOP
        INSERT INTO assigned_workouts (
            assigned_program_id, source_template_id, name, order_index, workout_type
        ) VALUES (
            v_assigned_program_id, v_workout.id, v_workout.name, v_workout.order_index,
            coalesce(v_workout.workout_type, 'strength')
        ) RETURNING id INTO v_assigned_workout_id;

        FOR v_item IN
            SELECT wit.*,
                   e.name as ex_name,
                   (SELECT string_agg(mg.name, ', ')
                    FROM exercise_muscle_groups emg
                    JOIN muscle_groups mg ON emg.muscle_group_id = mg.id
                    WHERE emg.exercise_id = e.id) as ex_muscle_group,
                   e.equipment as ex_equipment
            FROM workout_item_templates wit
            LEFT JOIN exercises e ON wit.exercise_id = e.id
            WHERE wit.workout_template_id = v_workout.id
              AND wit.parent_item_id IS NULL
            ORDER BY wit.order_index
        LOOP
            INSERT INTO assigned_workout_items (
                assigned_workout_id, parent_item_id, source_template_id, item_type,
                order_index, exercise_id, exercise_name, exercise_muscle_group,
                exercise_equipment, sets, reps, rest_seconds, notes,
                substitute_exercise_ids, exercise_function, item_config
            ) VALUES (
                v_assigned_workout_id, NULL, v_item.id, v_item.item_type,
                v_item.order_index, v_item.exercise_id, v_item.ex_name, v_item.ex_muscle_group,
                v_item.ex_equipment, v_item.sets, v_item.reps, v_item.rest_seconds, v_item.notes,
                v_item.substitute_exercise_ids, v_item.exercise_function, v_item.item_config
            ) RETURNING id INTO v_assigned_item_id;

            v_parent_mapping := v_parent_mapping || jsonb_build_object(v_item.id::text, v_assigned_item_id::text);

            FOR v_child_item IN
                SELECT wit.*,
                       e.name as ex_name,
                       (SELECT string_agg(mg.name, ', ')
                        FROM exercise_muscle_groups emg
                        JOIN muscle_groups mg ON emg.muscle_group_id = mg.id
                        WHERE emg.exercise_id = e.id) as ex_muscle_group,
                       e.equipment as ex_equipment
                FROM workout_item_templates wit
                LEFT JOIN exercises e ON wit.exercise_id = e.id
                WHERE wit.workout_template_id = v_workout.id
                  AND wit.parent_item_id = v_item.id
                ORDER BY wit.order_index
            LOOP
                INSERT INTO assigned_workout_items (
                    assigned_workout_id, parent_item_id, source_template_id, item_type,
                    order_index, exercise_id, exercise_name, exercise_muscle_group,
                    exercise_equipment, sets, reps, rest_seconds, notes,
                    substitute_exercise_ids, exercise_function, item_config
                ) VALUES (
                    v_assigned_workout_id, v_assigned_item_id, v_child_item.id, v_child_item.item_type,
                    v_child_item.order_index, v_child_item.exercise_id, v_child_item.ex_name, v_child_item.ex_muscle_group,
                    v_child_item.ex_equipment, v_child_item.sets, v_child_item.reps, v_child_item.rest_seconds, v_child_item.notes,
                    v_child_item.substitute_exercise_ids, v_child_item.exercise_function, v_child_item.item_config
                );
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN v_assigned_program_id;
END;
$$;

-- ============================================================================
-- 3c) assign_program_from_snapshot — workout_type opcional no snapshot IA
-- ============================================================================

create or replace function public.assign_program_from_snapshot(
    p_generation_id uuid,
    p_trainer_id uuid,
    p_student_id uuid,
    p_is_scheduled boolean,
    p_start_date timestamptz,
    p_snapshot jsonb,
    p_bump_edits boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_generation public.prescription_generations%rowtype;
    v_status text;
    v_started_at timestamptz;
    v_expires_at timestamptz;
    v_duration_weeks int;
    v_program_id uuid;
    v_workout jsonb;
    v_workout_id uuid;
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

    -- Triple filter (id + trainer + student) + lock: serializa double-taps
    -- concorrentes na mesma geração — o segundo espera o lock e cai no check
    -- de status abaixo.
    select * into v_generation
    from public.prescription_generations pg
    where pg.id = p_generation_id
      and pg.trainer_id = p_trainer_id
      and pg.student_id = p_student_id
    for update;
    if not found then
        raise exception 'generation_not_found';
    end if;

    if v_generation.status = 'approved' then
        raise exception 'generation_already_approved';
    end if;

    if p_is_scheduled then
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

    -- duration_weeks fica null quando o snapshot omite ou traz valor <= 0
    -- (NULL é melhor que um 4 fabricado — ver log Fase 2.5.4 §5).
    v_duration_weeks := case
        when jsonb_typeof(p_snapshot -> 'program' -> 'duration_weeks') = 'number'
             and (p_snapshot -> 'program' ->> 'duration_weeks')::numeric > 0
            then floor((p_snapshot -> 'program' ->> 'duration_weeks')::numeric)::int
        else null
    end;

    v_expires_at := case
        when v_started_at is not null and v_duration_weeks is not null
            then v_started_at + (v_duration_weeks * interval '1 week')
        else null
    end;

    insert into public.assigned_programs (
        student_id, trainer_id, source_template_id, name, description,
        duration_weeks, status, started_at, scheduled_start_date,
        current_week, expires_at, ai_generated, prescription_generation_id
    ) values (
        p_student_id, p_trainer_id, null,
        p_snapshot -> 'program' ->> 'name',
        p_snapshot -> 'program' ->> 'description',
        v_duration_weeks, v_status, v_started_at,
        case when p_is_scheduled then p_start_date end,
        1, v_expires_at, true, p_generation_id
    ) returning id into v_program_id;

    -- Snapshot v2.5 é flat — sem parent/child (supersets). Se o pipeline
    -- passar a emitir parent_item_id, adicionar um segundo passe aqui
    -- (como a 184 faz para filhos de superset).
    for v_workout in
        select w from jsonb_array_elements(p_snapshot -> 'workouts') w
    loop
        insert into public.assigned_workouts
            (assigned_program_id, source_template_id, name, order_index, scheduled_days, workout_type)
        values (
            v_program_id,
            null,
            v_workout ->> 'name',
            (v_workout ->> 'order_index')::int,
            coalesce((
                select array_agg(d.v::int order by d.v::int)
                from jsonb_array_elements_text(v_workout -> 'scheduled_days') d(v)
            ), '{}'),
            coalesce(v_workout ->> 'workout_type', 'strength')
        ) returning id into v_workout_id;

        insert into public.assigned_workout_items (
            assigned_workout_id, source_template_id, parent_item_id,
            item_type, order_index, exercise_id, exercise_name,
            exercise_muscle_group, exercise_equipment, exercise_function,
            sets, reps, rest_seconds, notes, substitute_exercise_ids, item_config
        )
        select
            v_workout_id, null, null,
            it ->> 'item_type',
            (it ->> 'order_index')::int,
            (it ->> 'exercise_id')::uuid,
            it ->> 'exercise_name',
            it ->> 'exercise_muscle_group',
            it ->> 'exercise_equipment',
            it ->> 'exercise_function',
            (it ->> 'sets')::int,
            it ->> 'reps',
            (it ->> 'rest_seconds')::int,
            it ->> 'notes',
            coalesce((
                select array_agg(s.v::uuid)
                from jsonb_array_elements_text(it -> 'substitute_exercise_ids') s(v)
            ), '{}'),
            coalesce(it -> 'item_config', '{}'::jsonb)
        from jsonb_array_elements(v_workout -> 'items') it;
    end loop;

    update public.prescription_generations
    set status = 'approved',
        approved_at = now(),
        assigned_program_id = v_program_id,
        updated_at = now(),
        trainer_edits_count = case
            when p_bump_edits then coalesce(trainer_edits_count, 0) + 1
            else trainer_edits_count
        end
    where id = p_generation_id;

    return v_program_id;
end;
$$;

-- ============================================================================
-- 3d) save_assigned_program_tree — INSERT propaga, UPDATE preserva se omitido
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_assigned_program_tree(p_program_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer uuid;
    v_prog jsonb := p_payload->'program';
    v_w jsonb;
    v_i jsonb;
    v_c jsonb;
    v_wid uuid;
    v_iid uuid;
    v_cid uuid;
    v_kept_workouts uuid[];
    v_kept_items uuid[];
BEGIN
    v_trainer := current_trainer_id();
    IF v_trainer IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    PERFORM 1 FROM assigned_programs ap
    WHERE ap.id = p_program_id
      AND (ap.trainer_id = v_trainer
           OR public.trainer_can_access_student(v_trainer, ap.student_id));
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Program not found for current trainer';
    END IF;

    UPDATE assigned_programs SET
        name = coalesce(v_prog->>'name', name),
        description = v_prog->>'description',
        duration_weeks = nullif(coalesce(nullif(v_prog->>'duration_weeks','')::int, 0), 0),
        status = coalesce(v_prog->>'status', status),
        started_at = (v_prog->>'started_at')::timestamptz,
        scheduled_start_date = (v_prog->>'scheduled_start_date')::timestamptz,
        expires_at = CASE
            WHEN (v_prog->>'started_at') IS NOT NULL
                 AND coalesce(nullif(v_prog->>'duration_weeks','')::int, 0) > 0
            THEN (v_prog->>'started_at')::timestamptz
                 + (nullif(v_prog->>'duration_weeks','')::int * interval '1 week')
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_program_id;

    SELECT coalesce(array_agg((w->>'id')::uuid), '{}')
    INTO v_kept_workouts
    FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb)) w
    WHERE (w->>'id') IS NOT NULL;

    DELETE FROM assigned_workouts
    WHERE assigned_program_id = p_program_id
      AND id <> ALL(v_kept_workouts);

    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb))
    LOOP
        IF (v_w->>'id') IS NULL THEN
            INSERT INTO assigned_workouts (assigned_program_id, name, order_index, scheduled_days, workout_type)
            VALUES (
                p_program_id,
                v_w->>'name',
                (v_w->>'order_index')::int,
                coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}'),
                coalesce(v_w->>'workout_type', 'strength')
            )
            RETURNING id INTO v_wid;
        ELSE
            v_wid := (v_w->>'id')::uuid;
            UPDATE assigned_workouts SET
                name = v_w->>'name',
                order_index = (v_w->>'order_index')::int,
                scheduled_days = coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}'),
                workout_type = coalesce(v_w->>'workout_type', workout_type),
                updated_at = now()
            WHERE id = v_wid AND assigned_program_id = p_program_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Workout % does not belong to program', v_wid;
            END IF;
        END IF;

        SELECT coalesce(array_agg(x), '{}') INTO v_kept_items
        FROM (
            SELECT (it->>'id')::uuid AS x
            FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb)) it
            WHERE (it->>'id') IS NOT NULL
            UNION ALL
            SELECT (ch->>'id')::uuid
            FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb)) it,
                 jsonb_array_elements(coalesce(it->'children','[]'::jsonb)) ch
            WHERE (ch->>'id') IS NOT NULL
        ) q;

        UPDATE assigned_workout_items
        SET parent_item_id = NULL
        WHERE assigned_workout_id = v_wid
          AND parent_item_id IS NOT NULL
          AND id = ANY(v_kept_items);

        DELETE FROM assigned_workout_items
        WHERE assigned_workout_id = v_wid
          AND id <> ALL(v_kept_items);

        FOR v_i IN SELECT * FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb))
        LOOP
            IF (v_i->>'id') IS NULL THEN
                INSERT INTO assigned_workout_items (
                    assigned_workout_id, parent_item_id, item_type, order_index,
                    exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                    notes, item_config, method_key, rounds, exercise_function,
                    exercise_name, exercise_muscle_group, exercise_equipment
                ) VALUES (
                    v_wid, NULL, v_i->>'item_type', (v_i->>'order_index')::int,
                    (v_i->>'exercise_id')::uuid,
                    coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    nullif(v_i->>'sets','')::int, v_i->>'reps', nullif(v_i->>'rest_seconds','')::int,
                    v_i->>'notes', coalesce(v_i->'item_config','{}'::jsonb), v_i->>'method_key', nullif(v_i->>'rounds','')::int,
                    nullif(v_i->>'exercise_function',''),
                    v_i->>'exercise_name', v_i->>'exercise_muscle_group', v_i->>'exercise_equipment'
                )
                RETURNING id INTO v_iid;
            ELSE
                v_iid := (v_i->>'id')::uuid;
                UPDATE assigned_workout_items SET
                    parent_item_id = NULL,
                    item_type = v_i->>'item_type',
                    order_index = (v_i->>'order_index')::int,
                    exercise_id = (v_i->>'exercise_id')::uuid,
                    substitute_exercise_ids = coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    sets = nullif(v_i->>'sets','')::int,
                    reps = v_i->>'reps',
                    rest_seconds = nullif(v_i->>'rest_seconds','')::int,
                    notes = v_i->>'notes',
                    item_config = coalesce(v_i->'item_config','{}'::jsonb),
                    method_key = v_i->>'method_key',
                    rounds = nullif(v_i->>'rounds','')::int,
                    exercise_function = CASE WHEN v_i ? 'exercise_function'
                        THEN nullif(v_i->>'exercise_function','')
                        ELSE exercise_function END,
                    exercise_name = v_i->>'exercise_name',
                    exercise_muscle_group = v_i->>'exercise_muscle_group',
                    exercise_equipment = v_i->>'exercise_equipment',
                    updated_at = now()
                WHERE id = v_iid AND assigned_workout_id = v_wid;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Item % does not belong to workout', v_iid;
                END IF;
            END IF;

            DELETE FROM assigned_workout_item_sets WHERE assigned_workout_item_id = v_iid;
            INSERT INTO assigned_workout_item_sets (
                assigned_workout_item_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            SELECT v_iid,
                (s->>'set_number')::int, s->>'set_type', s->>'reps', nullif(s->>'rest_seconds','')::int,
                nullif(s->>'weight_target_kg','')::numeric, nullif(s->>'weight_target_pct1rm','')::numeric,
                nullif(s->>'rir','')::int, s->>'tempo', s->>'notes', nullif(s->>'round_number','')::int
            FROM jsonb_array_elements(coalesce(v_i->'set_rows','[]'::jsonb)) s;

            FOR v_c IN SELECT * FROM jsonb_array_elements(coalesce(v_i->'children','[]'::jsonb))
            LOOP
                IF (v_c->>'id') IS NULL THEN
                    INSERT INTO assigned_workout_items (
                        assigned_workout_id, parent_item_id, item_type, order_index,
                        exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                        notes, item_config, method_key, rounds, exercise_function,
                        exercise_name, exercise_muscle_group, exercise_equipment
                    ) VALUES (
                        v_wid, v_iid, v_c->>'item_type', (v_c->>'order_index')::int,
                        (v_c->>'exercise_id')::uuid,
                        coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                        nullif(v_c->>'sets','')::int, v_c->>'reps', nullif(v_c->>'rest_seconds','')::int,
                        v_c->>'notes', coalesce(v_c->'item_config','{}'::jsonb), NULL, 1,
                        nullif(v_c->>'exercise_function',''),
                        v_c->>'exercise_name', v_c->>'exercise_muscle_group', v_c->>'exercise_equipment'
                    );
                ELSE
                    v_cid := (v_c->>'id')::uuid;
                    UPDATE assigned_workout_items SET
                        parent_item_id = v_iid,
                        item_type = v_c->>'item_type',
                        order_index = (v_c->>'order_index')::int,
                        exercise_id = (v_c->>'exercise_id')::uuid,
                        substitute_exercise_ids = coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                        sets = nullif(v_c->>'sets','')::int,
                        reps = v_c->>'reps',
                        rest_seconds = nullif(v_c->>'rest_seconds','')::int,
                        notes = v_c->>'notes',
                        item_config = coalesce(v_c->'item_config','{}'::jsonb),
                        method_key = NULL,
                        rounds = 1,
                        exercise_function = CASE WHEN v_c ? 'exercise_function'
                            THEN nullif(v_c->>'exercise_function','')
                            ELSE exercise_function END,
                        exercise_name = v_c->>'exercise_name',
                        exercise_muscle_group = v_c->>'exercise_muscle_group',
                        exercise_equipment = v_c->>'exercise_equipment',
                        updated_at = now()
                    WHERE id = v_cid AND assigned_workout_id = v_wid;
                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Child item % does not belong to workout', v_cid;
                    END IF;

                    DELETE FROM assigned_workout_item_sets
                    WHERE assigned_workout_item_id = v_cid;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'program_id', p_program_id);
END;
$$;

-- ============================================================================
-- 3e) create_assigned_program_tree — workout_type opcional no payload
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_assigned_program_tree(p_trainer_id uuid, p_student_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prog jsonb := p_payload->'program';
    v_w jsonb;
    v_i jsonb;
    v_c jsonb;
    v_pid uuid;
    v_wid uuid;
    v_iid uuid;
    v_workout_count int := 0;
    v_item_count int := 0;
BEGIN
    IF p_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'student_id is required';
    END IF;

    IF NOT public.trainer_can_access_student(p_trainer_id, p_student_id) THEN
        RAISE EXCEPTION 'Student not found for current trainer';
    END IF;

    IF coalesce(v_prog->>'name','') = '' THEN
        RAISE EXCEPTION 'Program name is required';
    END IF;

    INSERT INTO assigned_programs (
        trainer_id, student_id, name, description, duration_weeks, status, ai_generated
    )
    VALUES (
        p_trainer_id,
        p_student_id,
        v_prog->>'name',
        v_prog->>'description',
        nullif(v_prog->>'duration_weeks','')::int,
        'draft',
        true
    )
    RETURNING id INTO v_pid;

    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb))
    LOOP
        INSERT INTO assigned_workouts (assigned_program_id, name, order_index, scheduled_days, workout_type)
        VALUES (
            v_pid,
            v_w->>'name',
            (v_w->>'order_index')::int,
            coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}'),
            coalesce(v_w->>'workout_type', 'strength')
        )
        RETURNING id INTO v_wid;
        v_workout_count := v_workout_count + 1;

        FOR v_i IN SELECT * FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb))
        LOOP
            INSERT INTO assigned_workout_items (
                assigned_workout_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, item_config, method_key, rounds, exercise_function,
                exercise_name, exercise_muscle_group, exercise_equipment
            ) VALUES (
                v_wid, NULL, v_i->>'item_type', (v_i->>'order_index')::int,
                (v_i->>'exercise_id')::uuid,
                coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                nullif(v_i->>'sets','')::int, v_i->>'reps', nullif(v_i->>'rest_seconds','')::int,
                v_i->>'notes', coalesce(v_i->'item_config','{}'::jsonb), v_i->>'method_key', coalesce(nullif(v_i->>'rounds','')::int, 1),
                nullif(v_i->>'exercise_function',''),
                v_i->>'exercise_name', v_i->>'exercise_muscle_group', v_i->>'exercise_equipment'
            )
            RETURNING id INTO v_iid;
            v_item_count := v_item_count + 1;

            INSERT INTO assigned_workout_item_sets (
                assigned_workout_item_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            SELECT v_iid,
                (s->>'set_number')::int, s->>'set_type', s->>'reps', coalesce(nullif(s->>'rest_seconds','')::int, 0),
                nullif(s->>'weight_target_kg','')::numeric, nullif(s->>'weight_target_pct1rm','')::numeric,
                nullif(s->>'rir','')::int, s->>'tempo', s->>'notes', nullif(s->>'round_number','')::int
            FROM jsonb_array_elements(coalesce(v_i->'set_rows','[]'::jsonb)) s;

            FOR v_c IN SELECT * FROM jsonb_array_elements(coalesce(v_i->'children','[]'::jsonb))
            LOOP
                INSERT INTO assigned_workout_items (
                    assigned_workout_id, parent_item_id, item_type, order_index,
                    exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                    notes, item_config, method_key, rounds, exercise_function,
                    exercise_name, exercise_muscle_group, exercise_equipment
                ) VALUES (
                    v_wid, v_iid, v_c->>'item_type', (v_c->>'order_index')::int,
                    (v_c->>'exercise_id')::uuid,
                    coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    nullif(v_c->>'sets','')::int, v_c->>'reps', nullif(v_c->>'rest_seconds','')::int,
                    v_c->>'notes', coalesce(v_c->'item_config','{}'::jsonb), NULL, 1,
                    nullif(v_c->>'exercise_function',''),
                    v_c->>'exercise_name', v_c->>'exercise_muscle_group', v_c->>'exercise_equipment'
                );
                v_item_count := v_item_count + 1;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'assigned_program_id', v_pid,
        'workout_count', v_workout_count,
        'item_count', v_item_count
    );
END;
$$;

-- ============================================================================
-- 3f) create_program_template_tree — workout_type opcional no payload
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_program_template_tree(p_trainer_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prog jsonb := p_payload->'program';
    v_w jsonb;
    v_i jsonb;
    v_c jsonb;
    v_pid uuid;
    v_wid uuid;
    v_iid uuid;
    v_workout_count int := 0;
    v_item_count int := 0;
BEGIN
    IF p_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;

    IF coalesce(v_prog->>'name','') = '' THEN
        RAISE EXCEPTION 'Template name is required';
    END IF;

    INSERT INTO program_templates (trainer_id, name, description, duration_weeks, is_template, is_archived)
    VALUES (
        p_trainer_id,
        v_prog->>'name',
        v_prog->>'description',
        nullif(v_prog->>'duration_weeks','')::int,
        true,
        false
    )
    RETURNING id INTO v_pid;

    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb))
    LOOP
        INSERT INTO workout_templates (program_template_id, name, order_index, frequency, workout_type)
        VALUES (
            v_pid,
            v_w->>'name',
            (v_w->>'order_index')::int,
            coalesce((SELECT array_agg(e) FROM jsonb_array_elements_text(coalesce(v_w->'frequency','[]'::jsonb)) e), '{}'),
            coalesce(v_w->>'workout_type', 'strength')
        )
        RETURNING id INTO v_wid;
        v_workout_count := v_workout_count + 1;

        FOR v_i IN SELECT * FROM jsonb_array_elements(coalesce(v_w->'items','[]'::jsonb))
        LOOP
            INSERT INTO workout_item_templates (
                workout_template_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, item_config, exercise_function, method_key, rounds
            ) VALUES (
                v_wid, NULL, v_i->>'item_type', (v_i->>'order_index')::int,
                (v_i->>'exercise_id')::uuid,
                coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                nullif(v_i->>'sets','')::int, v_i->>'reps', nullif(v_i->>'rest_seconds','')::int,
                v_i->>'notes', coalesce(v_i->'item_config','{}'::jsonb),
                v_i->>'exercise_function', v_i->>'method_key', coalesce(nullif(v_i->>'rounds','')::int, 1)
            )
            RETURNING id INTO v_iid;
            v_item_count := v_item_count + 1;

            INSERT INTO workout_item_set_templates (
                workout_item_template_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            SELECT v_iid,
                (s->>'set_number')::int, s->>'set_type', s->>'reps', nullif(s->>'rest_seconds','')::int,
                nullif(s->>'weight_target_kg','')::numeric, nullif(s->>'weight_target_pct1rm','')::numeric,
                nullif(s->>'rir','')::int, s->>'tempo', s->>'notes', nullif(s->>'round_number','')::int
            FROM jsonb_array_elements(coalesce(v_i->'set_rows','[]'::jsonb)) s;

            FOR v_c IN SELECT * FROM jsonb_array_elements(coalesce(v_i->'children','[]'::jsonb))
            LOOP
                INSERT INTO workout_item_templates (
                    workout_template_id, parent_item_id, item_type, order_index,
                    exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                    notes, item_config, exercise_function, method_key, rounds
                ) VALUES (
                    v_wid, v_iid, v_c->>'item_type', (v_c->>'order_index')::int,
                    (v_c->>'exercise_id')::uuid,
                    coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    nullif(v_c->>'sets','')::int, v_c->>'reps', nullif(v_c->>'rest_seconds','')::int,
                    v_c->>'notes', coalesce(v_c->'item_config','{}'::jsonb),
                    v_c->>'exercise_function', NULL, 1
                );
                v_item_count := v_item_count + 1;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'program_template_id', v_pid,
        'workout_count', v_workout_count,
        'item_count', v_item_count
    );
END;
$$;

-- ============================================================================
-- 3g) duplicate_program_template (1 arg, web) — copia workout_type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.duplicate_program_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id uuid;
    v_new_program uuid;
    v_wmap jsonb := '{}'::jsonb;
    v_imap jsonb := '{}'::jsonb;
    w record;
    it record;
    v_new_w uuid;
    v_new_i uuid;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    PERFORM 1 FROM program_templates
    WHERE id = p_template_id AND trainer_id = v_trainer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or not owned by trainer';
    END IF;

    INSERT INTO program_templates (trainer_id, name, description, duration_weeks, is_template, is_archived)
    SELECT trainer_id, name || ' (cópia)', description, duration_weeks, true, false
    FROM program_templates
    WHERE id = p_template_id
    RETURNING id INTO v_new_program;

    FOR w IN
        SELECT * FROM workout_templates
        WHERE program_template_id = p_template_id
        ORDER BY order_index
    LOOP
        INSERT INTO workout_templates (program_template_id, name, order_index, frequency, workout_type)
        VALUES (v_new_program, w.name, w.order_index, w.frequency, coalesce(w.workout_type, 'strength'))
        RETURNING id INTO v_new_w;
        v_wmap := v_wmap || jsonb_build_object(w.id::text, v_new_w::text);
    END LOOP;

    FOR it IN
        SELECT wit.* FROM workout_item_templates wit
        JOIN workout_templates wt ON wt.id = wit.workout_template_id
        WHERE wt.program_template_id = p_template_id
          AND wit.parent_item_id IS NULL
        ORDER BY wit.order_index
    LOOP
        INSERT INTO workout_item_templates (
            workout_template_id, parent_item_id, item_type, order_index,
            exercise_id, sets, reps, rest_seconds, notes,
            substitute_exercise_ids, exercise_function, item_config, method_key, rounds
        )
        VALUES (
            (v_wmap ->> it.workout_template_id::text)::uuid, NULL, it.item_type, it.order_index,
            it.exercise_id, it.sets, it.reps, it.rest_seconds, it.notes,
            it.substitute_exercise_ids, it.exercise_function, it.item_config, it.method_key, it.rounds
        )
        RETURNING id INTO v_new_i;
        v_imap := v_imap || jsonb_build_object(it.id::text, v_new_i::text);

        INSERT INTO workout_item_set_templates (
            workout_item_template_id, set_number, set_type, reps, rest_seconds,
            weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
        )
        SELECT v_new_i, set_number, set_type, reps, rest_seconds,
               weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
        FROM workout_item_set_templates
        WHERE workout_item_template_id = it.id;
    END LOOP;

    FOR it IN
        SELECT wit.* FROM workout_item_templates wit
        JOIN workout_templates wt ON wt.id = wit.workout_template_id
        WHERE wt.program_template_id = p_template_id
          AND wit.parent_item_id IS NOT NULL
        ORDER BY wit.order_index
    LOOP
        INSERT INTO workout_item_templates (
            workout_template_id, parent_item_id, item_type, order_index,
            exercise_id, sets, reps, rest_seconds, notes,
            substitute_exercise_ids, exercise_function, item_config, method_key, rounds
        )
        VALUES (
            (v_wmap ->> it.workout_template_id::text)::uuid,
            (v_imap ->> it.parent_item_id::text)::uuid,
            it.item_type, it.order_index,
            it.exercise_id, it.sets, it.reps, it.rest_seconds, it.notes,
            it.substitute_exercise_ids, it.exercise_function, it.item_config, it.method_key, it.rounds
        );
    END LOOP;

    RETURN v_new_program;
END;
$$;

-- ============================================================================
-- 3h) duplicate_program_template (2 args, MCP) — copia workout_type
-- ============================================================================

create or replace function public.duplicate_program_template(p_trainer_id uuid, p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_original public.program_templates%rowtype;
    v_w public.workout_templates%rowtype;
    v_i public.workout_item_templates%rowtype;
    v_new_id uuid;
    v_new_wid uuid;
    v_new_iid uuid;
begin
    if auth.role() is distinct from 'service_role' then
        if not exists (
            select 1 from public.trainers t
            where t.id = p_trainer_id and t.auth_user_id = auth.uid()
        ) then
            raise exception 'Unauthorized' using errcode = '42501';
        end if;
    end if;

    select * into v_original
    from public.program_templates pt
    where pt.id = p_template_id and pt.trainer_id = p_trainer_id;
    if not found then
        raise exception 'Template not found';
    end if;

    insert into public.program_templates (trainer_id, name, description, duration_weeks, is_template)
    values (p_trainer_id, v_original.name || ' (Cópia)', v_original.description,
            v_original.duration_weeks, true)
    returning id into v_new_id;

    for v_w in
        select * from public.workout_templates
        where program_template_id = p_template_id
        order by order_index
    loop
        insert into public.workout_templates (program_template_id, name, order_index, frequency, workout_type)
        values (v_new_id, v_w.name, v_w.order_index, v_w.frequency, coalesce(v_w.workout_type, 'strength'))
        returning id into v_new_wid;

        for v_i in
            select * from public.workout_item_templates
            where workout_template_id = v_w.id and parent_item_id is null
            order by order_index
        loop
            insert into public.workout_item_templates (
                workout_template_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, exercise_function, item_config, method_key, rounds
            ) values (
                v_new_wid, null, v_i.item_type, v_i.order_index,
                v_i.exercise_id, coalesce(v_i.substitute_exercise_ids, '{}'),
                v_i.sets, v_i.reps, v_i.rest_seconds,
                v_i.notes, v_i.exercise_function, coalesce(v_i.item_config, '{}'::jsonb),
                v_i.method_key, coalesce(v_i.rounds, 1)
            ) returning id into v_new_iid;

            insert into public.workout_item_set_templates (
                workout_item_template_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            select v_new_iid, st.set_number, st.set_type, st.reps, st.rest_seconds,
                   st.weight_target_kg, st.weight_target_pct1rm, st.rir, st.tempo,
                   st.notes, st.round_number
            from public.workout_item_set_templates st
            where st.workout_item_template_id = v_i.id;

            insert into public.workout_item_templates (
                workout_template_id, parent_item_id, item_type, order_index,
                exercise_id, substitute_exercise_ids, sets, reps, rest_seconds,
                notes, exercise_function, item_config, method_key, rounds
            )
            select v_new_wid, v_new_iid, c.item_type, c.order_index,
                   c.exercise_id, coalesce(c.substitute_exercise_ids, '{}'),
                   c.sets, c.reps, c.rest_seconds,
                   c.notes, c.exercise_function, coalesce(c.item_config, '{}'::jsonb),
                   null, 1
            from public.workout_item_templates c
            where c.parent_item_id = v_i.id;
        end loop;
    end loop;

    insert into public.program_form_triggers (
        program_template_id, form_template_id, trainer_id, trigger_type, is_active
    )
    select v_new_id, t.form_template_id, p_trainer_id, t.trigger_type, t.is_active
    from public.program_form_triggers t
    where t.program_template_id = p_template_id;

    return v_new_id;
end;
$$;

-- ============================================================================
-- 4) get_student_today_workout_for_trainer — devolve workoutType
--    Patch in-place no prosrc vigente (preserva patches 087/100/260).
-- ============================================================================

DO $patch$
DECLARE
    v_def text;
    v_n int;
BEGIN
    v_def := pg_get_functiondef('public.get_student_today_workout_for_trainer(uuid, uuid)'::regprocedure);

    -- Âncora 1: SELECT do workout ganha a coluna workout_type
    SELECT count(*) INTO v_n
    FROM regexp_matches(v_def, 'aw\.id, aw\.name, aw\.assigned_program_id', 'g');
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'get_student_today_workout_for_trainer: âncora do SELECT encontrada %x (esperado 1) — revisar manualmente', v_n;
    END IF;
    v_def := replace(
        v_def,
        'aw.id, aw.name, aw.assigned_program_id',
        'aw.id, aw.name, aw.workout_type, aw.assigned_program_id'
    );

    -- Âncora 2: JSONB de retorno ganha workoutType
    SELECT count(*) INTO v_n
    FROM regexp_matches(v_def, '''workoutName'', v_workout\.name,', 'g');
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'get_student_today_workout_for_trainer: âncora do JSONB encontrada %x (esperado 1) — revisar manualmente', v_n;
    END IF;
    v_def := replace(
        v_def,
        '''workoutName'', v_workout.name,',
        '''workoutName'', v_workout.name,
        ''workoutType'', coalesce(v_workout.workout_type, ''strength''),'
    );

    EXECUTE v_def;
END $patch$;
