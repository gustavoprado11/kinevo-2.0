-- ============================================================================
-- 234: create_assigned_program_tree persiste exercise_function (R18, rodada 2)
-- ============================================================================
-- Auditoria rodada 2 (docs/analise-builder-rodada2-2026-07-06.md), achado R18.
--
-- PROBLEMA
-- --------
-- A RPC 214 não incluía exercise_function nos dois INSERTs de
-- assigned_workout_items (a 198, do lado template, inclui). Efeitos:
--   - kinevo_duplicate_program MANDA exercise_function no payload e a RPC o
--     ignorava → duplicar assigned→draft zerava a classificação warmup/main
--     de todos os itens (afeta volume "main" do useSessionStats e a UX de
--     aquecimento do mobile).
--   - kinevo_create_student_draft_program idem para payloads que enviem o campo.
--
-- FIX: única mudança vs 214 — exercise_function nos dois INSERTs.
-- ============================================================================

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

    -- Posse do aluno (escopo do tenant) — o aluno tem de ser deste treinador.
    PERFORM 1 FROM students WHERE id = p_student_id AND coach_id = p_trainer_id;
    IF NOT FOUND THEN
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

-- Trava de tenant preservada (migration 204/214): só service_role.
REVOKE EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  TO service_role;
