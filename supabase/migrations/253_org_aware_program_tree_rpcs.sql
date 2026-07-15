-- ============================================================================
-- 253: Estúdios v1 — RPCs de escrita ficam org-aware
-- ============================================================================
-- Os write-paths transacionais de prescrição e da Sala de Treino validam posse
-- com "aluno é do treinador" (coach_id = p_trainer_id) ou "programa é do
-- treinador". Com alunos compartilhados do estúdio (252), o guard passa a ser
-- "responsável OU membro ativo da org do aluno".
--
-- Corpos idênticos às versões vigentes (234/235/245) — mudam APENAS os guards
-- (e, no save, o WHERE do UPDATE de metadados, que repetia trainer_id e viraria
-- no-op silencioso para o coach não-responsável).
--
-- NOTA de contexto de execução: create/finish rodam como service_role com
-- p_trainer_id explícito → o helper recebe o trainer como argumento (nada de
-- current_trainer_id()). O save roda como authenticated → deriva o ator de
-- current_trainer_id() como sempre fez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper para caminhos service-role (ator explícito)
-- ----------------------------------------------------------------------------
create or replace function public.trainer_can_access_student(p_trainer uuid, p_student uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
    select exists (
        select 1 from students s
        where s.id = p_student
          and (
            s.coach_id = p_trainer
            or (
                s.organization_id is not null
                and exists (
                    select 1 from organization_members om
                    where om.trainer_id = p_trainer
                      and om.organization_id = s.organization_id
                      and om.status = 'active'
                )
            )
          )
    )
$$;

revoke execute on function public.trainer_can_access_student(uuid, uuid) from anon, public;
grant execute on function public.trainer_can_access_student(uuid, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. create_assigned_program_tree — corpo da 234; guard org-aware
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_assigned_program_tree(
    p_trainer_id uuid,
    p_student_id uuid,
    p_payload jsonb
)
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

    -- Escopo do tenant (253): responsável OU membro ativo da org do aluno.
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
        INSERT INTO assigned_workouts (assigned_program_id, name, order_index, scheduled_days)
        VALUES (
            v_pid,
            v_w->>'name',
            (v_w->>'order_index')::int,
            coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}')
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

            -- Séries (set_scheme materializado). Modo simples não traz set_rows
            -- → o item carrega só os agregados sets/reps/rest (igual ao builder).
            INSERT INTO assigned_workout_item_sets (
                assigned_workout_item_id, set_number, set_type, reps, rest_seconds,
                weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number
            )
            SELECT v_iid,
                (s->>'set_number')::int, s->>'set_type', s->>'reps', coalesce(nullif(s->>'rest_seconds','')::int, 0),
                nullif(s->>'weight_target_kg','')::numeric, nullif(s->>'weight_target_pct1rm','')::numeric,
                nullif(s->>'rir','')::int, s->>'tempo', s->>'notes', nullif(s->>'round_number','')::int
            FROM jsonb_array_elements(coalesce(v_i->'set_rows','[]'::jsonb)) s;

            -- Filhos (supersets) — V1 não persiste set_scheme em filho.
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

-- Trava de tenant preservada (204/214/234): só service_role.
REVOKE EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  TO service_role;

-- ----------------------------------------------------------------------------
-- 3. save_assigned_program_tree — corpo da 235; guard org-aware
--    (e o UPDATE de metadados perde o "AND trainer_id = v_trainer", que
--    viraria no-op silencioso para o coach não-responsável)
-- ----------------------------------------------------------------------------
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

    -- Posse (253): dono do programa OU membro ativo da org do aluno do programa.
    PERFORM 1 FROM assigned_programs ap
    WHERE ap.id = p_program_id
      AND (ap.trainer_id = v_trainer
           OR public.trainer_can_access_student(v_trainer, ap.student_id));
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Program not found for current trainer';
    END IF;

    -- Metadados do programa (status/datas já resolvidos pelo cliente)
    UPDATE assigned_programs SET
        name = coalesce(v_prog->>'name', name),
        description = v_prog->>'description',
        -- FIX (230): 0 = sem prazo → NULL
        duration_weeks = nullif(coalesce(nullif(v_prog->>'duration_weeks','')::int, 0), 0),
        status = coalesce(v_prog->>'status', status),
        started_at = (v_prog->>'started_at')::timestamptz,
        scheduled_start_date = (v_prog->>'scheduled_start_date')::timestamptz,
        -- FIX (229/230): duração ausente ou ≤0 = nunca expira
        expires_at = CASE
            WHEN (v_prog->>'started_at') IS NOT NULL
                 AND coalesce(nullif(v_prog->>'duration_weeks','')::int, 0) > 0
            THEN (v_prog->>'started_at')::timestamptz
                 + (nullif(v_prog->>'duration_weeks','')::int * interval '1 week')
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = p_program_id;

    -- Treinos a manter (ids não-nulos no payload)
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
            INSERT INTO assigned_workouts (assigned_program_id, name, order_index, scheduled_days)
            VALUES (
                p_program_id,
                v_w->>'name',
                (v_w->>'order_index')::int,
                coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}')
            )
            RETURNING id INTO v_wid;
        ELSE
            v_wid := (v_w->>'id')::uuid;
            UPDATE assigned_workouts SET
                name = v_w->>'name',
                order_index = (v_w->>'order_index')::int,
                scheduled_days = coalesce((SELECT array_agg(e::int) FROM jsonb_array_elements_text(coalesce(v_w->'scheduled_days','[]'::jsonb)) e), '{}'),
                updated_at = now()
            WHERE id = v_wid AND assigned_program_id = p_program_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Workout % does not belong to program', v_wid;
            END IF;
        END IF;

        -- Itens a manter neste treino (raiz + filhos)
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

        -- FIX (215): solta do pai os itens que vão permanecer ANTES de deletar.
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
                    -- FIX (235): presença de chave — ausente preserva, null limpa
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

            -- Substitui as linhas de set_scheme do item
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

            -- Filhos (supersets) — V1 não persiste set_scheme em filho
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
                        -- FIX (235): presença de chave — ausente preserva, null limpa
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

                    -- FIX (228): filho não persiste set_scheme — limpa linhas
                    -- que ficaram do tempo em que o item era raiz.
                    DELETE FROM assigned_workout_item_sets
                    WHERE assigned_workout_item_id = v_cid;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'program_id', p_program_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_assigned_program_tree(uuid, jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. finish_training_room_session — corpo da 245; guard org-aware
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_training_room_session(
    p_trainer_id uuid,
    p_student_id uuid,
    p_assigned_workout_id uuid,
    p_assigned_program_id uuid,
    p_started_at timestamptz,
    p_rpe integer,
    p_feedback text,
    p_pre_submission_id uuid,
    p_post_submission_id uuid,
    p_scheduled_date date,
    p_program_week integer,
    p_set_logs jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_session_id uuid;
    v_existing_id uuid;
    v_existing_started timestamptz;
BEGIN
    -- Escopo do tenant (253): responsável OU membro ativo da org do aluno.
    IF NOT public.trainer_can_access_student(p_trainer_id, p_student_id) THEN
        RAISE EXCEPTION 'student does not belong to trainer';
    END IF;

    -- T4: sessão in_progress RECENTE do aluno para o mesmo treino.
    -- FOR UPDATE serializa contra o finish simultâneo vindo do app do aluno.
    SELECT id, started_at INTO v_existing_id, v_existing_started
    FROM workout_sessions
    WHERE student_id = p_student_id
      AND assigned_workout_id = p_assigned_workout_id
      AND status = 'in_progress'
      AND started_at > now() - INTERVAL '12 hours'
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
        UPDATE workout_sessions SET
            status = 'completed',
            completed_at = now(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - v_existing_started)))::int,
            sync_status = 'synced',
            rpe = COALESCE(p_rpe, rpe),
            feedback = COALESCE(p_feedback, feedback),
            pre_workout_submission_id = COALESCE(p_pre_submission_id, pre_workout_submission_id),
            post_workout_submission_id = COALESCE(p_post_submission_id, post_workout_submission_id),
            scheduled_date = COALESCE(p_scheduled_date, scheduled_date),
            program_week = COALESCE(p_program_week, program_week),
            assigned_program_id = COALESCE(assigned_program_id, p_assigned_program_id)
        WHERE id = v_existing_id;
        v_session_id := v_existing_id;
    ELSE
        INSERT INTO workout_sessions (
            student_id, trainer_id, assigned_workout_id, assigned_program_id,
            status, started_at, completed_at, duration_seconds, sync_status,
            rpe, feedback, pre_workout_submission_id, post_workout_submission_id,
            scheduled_date, program_week
        ) VALUES (
            p_student_id, p_trainer_id, p_assigned_workout_id, p_assigned_program_id,
            'completed', p_started_at, now(),
            GREATEST(0, EXTRACT(EPOCH FROM (now() - p_started_at)))::int, 'synced',
            p_rpe, p_feedback, p_pre_submission_id, p_post_submission_id,
            p_scheduled_date, p_program_week
        ) RETURNING id INTO v_session_id;
    END IF;

    -- T2: séries na MESMA transação. Upsert idempotente pela unique
    -- (workout_session_id, assigned_workout_item_id, set_number) — no reattach
    -- preserva séries que só o aluno logou; nas colididas a Sala vence.
    INSERT INTO set_logs (
        workout_session_id, assigned_workout_item_id, planned_exercise_id,
        executed_exercise_id, swap_source, exercise_id, set_number, weight,
        reps_completed, is_completed, completed_at, weight_unit, notes
    )
    SELECT
        v_session_id,
        (sl->>'assigned_workout_item_id')::uuid,
        (sl->>'planned_exercise_id')::uuid,
        (sl->>'executed_exercise_id')::uuid,
        COALESCE(sl->>'swap_source', 'none'),
        (sl->>'exercise_id')::uuid,
        (sl->>'set_number')::int,
        COALESCE((sl->>'weight')::numeric, 0),
        COALESCE((sl->>'reps_completed')::int, 0),
        COALESCE((sl->>'is_completed')::boolean, true),
        COALESCE((sl->>'completed_at')::timestamptz, now()),
        COALESCE(sl->>'weight_unit', 'kg'),
        sl->>'notes'
    FROM jsonb_array_elements(COALESCE(p_set_logs, '[]'::jsonb)) AS sl
    ON CONFLICT (workout_session_id, assigned_workout_item_id, set_number)
    DO UPDATE SET
        weight = EXCLUDED.weight,
        reps_completed = EXCLUDED.reps_completed,
        is_completed = EXCLUDED.is_completed,
        completed_at = EXCLUDED.completed_at,
        weight_unit = EXCLUDED.weight_unit,
        notes = EXCLUDED.notes,
        planned_exercise_id = EXCLUDED.planned_exercise_id,
        executed_exercise_id = EXCLUDED.executed_exercise_id,
        swap_source = EXCLUDED.swap_source,
        exercise_id = EXCLUDED.exercise_id;

    RETURN v_session_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM authenticated;
