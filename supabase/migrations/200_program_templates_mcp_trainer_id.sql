-- ============================================================================
-- 200_program_templates_mcp_trainer_id.sql
-- ============================================================================
-- Destrava criação de TEMPLATES de programa via MCP (service-role, sem JWT).
--
-- Bug: o trigger BEFORE INSERT `set_trainer_id` em program_templates chamava
-- current_trainer_id() e levantava 'Not authenticated as a trainer' ANTES de
-- checar se NEW.trainer_id já tinha sido informado. Como o MCP grava com o
-- service-role client (auth.uid() é NULL) passando trainer_id explícito, todo
-- insert de template via MCP falhava — incluindo o kinevo_create_program (ramo
-- template) e o RPC create_program_template_tree (migration 198), que também
-- derivava o trainer de current_trainer_id().
--
-- Correções (ambas aditivas / backward-compatible):
--   1) set_trainer_id() só exige contexto de auth quando NEW.trainer_id é NULL.
--      Inserts da UI (sem trainer_id, com JWT) seguem idênticos; inserts com
--      trainer_id explícito (MCP) passam a funcionar.
--   2) create_program_template_tree passa a receber p_trainer_id como parâmetro
--      (vindo do token OAuth já validado pelo MCP) em vez de current_trainer_id().
-- ============================================================================

-- 1) Trigger genérico: derivar trainer só quando não veio explícito.
CREATE OR REPLACE FUNCTION public.set_trainer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID;
BEGIN
    -- Só exige auth quando trainer_id não foi informado explicitamente.
    IF NEW.trainer_id IS NULL THEN
        v_trainer_id := current_trainer_id();
        IF v_trainer_id IS NULL THEN
            RAISE EXCEPTION 'Not authenticated as a trainer';
        END IF;
        NEW.trainer_id := v_trainer_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 2) RPC de criação de template recebe o trainer por parâmetro (MCP-friendly).
DROP FUNCTION IF EXISTS public.create_program_template_tree(jsonb);

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

GRANT EXECUTE ON FUNCTION public.create_program_template_tree(uuid, jsonb) TO authenticated;
