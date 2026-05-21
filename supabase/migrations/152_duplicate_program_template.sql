-- ============================================================================
-- Migration 152: duplicate_program_template(uuid) RPC
-- ============================================================================
-- Server-side deep copy of a program template for the mobile Template Library
-- (Fase 2). Copies the program row, all workouts, all items (root + superset
-- children, preserving parent links via an id map) and the per-set rows.
--
-- SECURITY DEFINER + explicit ownership check (current_trainer_id()), mirroring
-- the web duplicate-program server action. Atomic: runs in the caller's
-- transaction, so a failure rolls the whole copy back.
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
    v_wmap jsonb := '{}'::jsonb;   -- old workout id -> new workout id
    v_imap jsonb := '{}'::jsonb;   -- old item id    -> new item id
    w record;
    it record;
    v_new_w uuid;
    v_new_i uuid;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Ownership check: the template must belong to the calling trainer.
    PERFORM 1 FROM program_templates
    WHERE id = p_template_id AND trainer_id = v_trainer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or not owned by trainer';
    END IF;

    -- 1. Copy the program row.
    INSERT INTO program_templates (trainer_id, name, description, duration_weeks, is_template, is_archived)
    SELECT trainer_id, name || ' (cópia)', description, duration_weeks, true, false
    FROM program_templates
    WHERE id = p_template_id
    RETURNING id INTO v_new_program;

    -- 2. Copy workouts (build old->new id map).
    FOR w IN
        SELECT * FROM workout_templates
        WHERE program_template_id = p_template_id
        ORDER BY order_index
    LOOP
        INSERT INTO workout_templates (program_template_id, name, order_index, frequency)
        VALUES (v_new_program, w.name, w.order_index, w.frequency)
        RETURNING id INTO v_new_w;
        v_wmap := v_wmap || jsonb_build_object(w.id::text, v_new_w::text);
    END LOOP;

    -- 3. Copy root items (parent_item_id IS NULL) + their per-set rows.
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

    -- 4. Copy superset child items (parent already mapped above).
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

GRANT EXECUTE ON FUNCTION public.duplicate_program_template(uuid) TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
