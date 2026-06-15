-- ============================================================================
-- 198_create_program_template_tree_rpc.sql
-- ============================================================================
-- Criação de um TEMPLATE de programa (biblioteca) em UMA chamada transacional.
--
-- Espelha 197_save_assigned_program_tree, mas:
--   • Grava nas tabelas de template (program_templates / workout_templates /
--     workout_item_templates / workout_item_set_templates), não nas de assigned;
--   • É create-only (sempre insere uma árvore nova) — não há upsert-by-id nem
--     delete-do-que-saiu, porque o template nasce do zero. Edição in-place do
--     template continua sendo feita pelas tools granulares.
--   • Templates NÃO guardam snapshots do exercício (exercise_name/equipment) —
--     referenciam exercises live via exercise_id; o snapshot é materializado em
--     assign_program_to_student (migration 184) na hora de atribuir ao aluno.
--   • workout_templates.frequency guarda códigos de dia ('mon','thu',…), não o
--     int[] de assigned_workouts.scheduled_days; a tool MCP converte.
--
-- SECURITY DEFINER + current_trainer_id() garantem que o template nasce sob o
-- treinador autenticado. Backward-compatible (aditivo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_program_template_tree(p_payload jsonb)
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
    v_pid uuid;
    v_wid uuid;
    v_iid uuid;
    v_workout_count int := 0;
    v_item_count int := 0;
BEGIN
    v_trainer := current_trainer_id();
    IF v_trainer IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    IF coalesce(v_prog->>'name','') = '' THEN
        RAISE EXCEPTION 'Template name is required';
    END IF;

    -- Programa (template)
    INSERT INTO program_templates (trainer_id, name, description, duration_weeks, is_template, is_archived)
    VALUES (
        v_trainer,
        v_prog->>'name',
        v_prog->>'description',
        nullif(v_prog->>'duration_weeks','')::int,
        true,
        false
    )
    RETURNING id INTO v_pid;

    FOR v_w IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'workouts','[]'::jsonb))
    LOOP
        INSERT INTO workout_templates (program_template_id, name, order_index, frequency)
        VALUES (
            v_pid,
            v_w->>'name',
            (v_w->>'order_index')::int,
            coalesce((SELECT array_agg(e) FROM jsonb_array_elements_text(coalesce(v_w->'frequency','[]'::jsonb)) e), '{}')
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

            -- Séries (set_scheme) do item
            INSERT INTO workout_item_set_templates (
                workout_item_template_id, set_number, set_type, reps, rest_seconds,
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

GRANT EXECUTE ON FUNCTION public.create_program_template_tree(jsonb) TO authenticated;
