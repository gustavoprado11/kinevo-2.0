-- ============================================================================
-- 214_create_assigned_program_tree_rpc.sql
-- ============================================================================
-- Cria um RASCUNHO-DO-ALUNO completo numa ÚNICA chamada transacional, via MCP.
--
-- Contexto: o Assistente (IA do Treinador) autora o programa inteiro e, até aqui,
-- só tinha duas saídas para persistir:
--   (a) create_program_template_tree → transacional e completo, mas grava na
--       BIBLIOTECA (program_templates), não no aluno;
--   (b) create_program (com student_id) + N add_session/add_exercise → grava no
--       aluno como draft, mas INCREMENTAL/não-transacional (rate-limit deixa o
--       programa pela metade).
--
-- Esta função é o espelho de `create_program_template_tree` (migration 200), mas
-- escreve a árvore em assigned_programs (status='draft', ai_generated=true) →
-- assigned_workouts (scheduled_days int[]) → assigned_workout_items (+ snapshot
-- denormalizado do exercício, resolvido pelo tool) → assigned_workout_item_sets.
-- O ramo de INSERT segue exatamente o de `save_assigned_program_tree` (migration
-- 197), então a árvore é idêntica à que o builder grava.
--
-- Segurança: SECURITY DEFINER + escopo de tenant vindo de p_trainer_id (validado
-- pelo OAuth no MCP) + checagem de posse do aluno. Como o tenant é fornecido pelo
-- chamador, EXECUTE é restrito a service_role (mesma trava da migration 204) —
-- nenhum principal `authenticated`/`anon` pode chamar e forjar trainer/aluno.
-- Aditiva / backward-compatible.
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
                notes, item_config, method_key, rounds,
                exercise_name, exercise_muscle_group, exercise_equipment
            ) VALUES (
                v_wid, NULL, v_i->>'item_type', (v_i->>'order_index')::int,
                (v_i->>'exercise_id')::uuid,
                coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_i->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                nullif(v_i->>'sets','')::int, v_i->>'reps', nullif(v_i->>'rest_seconds','')::int,
                v_i->>'notes', coalesce(v_i->'item_config','{}'::jsonb), v_i->>'method_key', coalesce(nullif(v_i->>'rounds','')::int, 1),
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
                    notes, item_config, method_key, rounds,
                    exercise_name, exercise_muscle_group, exercise_equipment
                ) VALUES (
                    v_wid, v_iid, v_c->>'item_type', (v_c->>'order_index')::int,
                    (v_c->>'exercise_id')::uuid,
                    coalesce((SELECT array_agg(e::uuid) FROM jsonb_array_elements_text(coalesce(v_c->'substitute_exercise_ids','[]'::jsonb)) e), '{}'),
                    nullif(v_c->>'sets','')::int, v_c->>'reps', nullif(v_c->>'rest_seconds','')::int,
                    v_c->>'notes', coalesce(v_c->'item_config','{}'::jsonb), NULL, 1,
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

-- Trava de tenant (mesma política da migration 204): o escopo vem do parâmetro
-- p_trainer_id, então só o backend service-role (MCP, que valida a identidade do
-- treinador) pode chamar. NUNCA conceder a authenticated/anon/PUBLIC.
REVOKE EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assigned_program_tree(uuid, uuid, jsonb)
  TO service_role;
