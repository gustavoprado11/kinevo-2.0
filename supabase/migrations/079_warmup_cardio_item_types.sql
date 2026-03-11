-- ============================================================================
-- Migration 079: Warmup & Cardio Item Types
-- ============================================================================
-- Adds 'warmup' and 'cardio' as new workout item types, plus a JSONB
-- item_config column for type-specific parameters.
--
-- Changes:
--   1. Expand item_type CHECK constraint on both tables
--   2. Add item_config JSONB column to both tables
--   3. Relax chk_exercise_required (warmup/cardio don't need exercise_id)
--   4. Update assign_program_to_student RPC to copy item_config
--   5. Update get_student_today_workout_for_trainer RPC to return item_config
-- ============================================================================

-- ============================================================================
-- 1) Expand item_type CHECK on workout_item_templates
-- ============================================================================

-- Drop the unnamed inline CHECK on item_type
-- PostgreSQL auto-names inline CHECK as: <table>_item_type_check
ALTER TABLE workout_item_templates
    DROP CONSTRAINT IF EXISTS workout_item_templates_item_type_check;

ALTER TABLE workout_item_templates
    ADD CONSTRAINT workout_item_templates_item_type_check
    CHECK (item_type IN ('exercise', 'superset', 'note', 'warmup', 'cardio'));

-- Same for assigned_workout_items
ALTER TABLE assigned_workout_items
    DROP CONSTRAINT IF EXISTS assigned_workout_items_item_type_check;

ALTER TABLE assigned_workout_items
    ADD CONSTRAINT assigned_workout_items_item_type_check
    CHECK (item_type IN ('exercise', 'superset', 'note', 'warmup', 'cardio'));

-- ============================================================================
-- 2) Add item_config JSONB column
-- ============================================================================

ALTER TABLE workout_item_templates
    ADD COLUMN IF NOT EXISTS item_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE assigned_workout_items
    ADD COLUMN IF NOT EXISTS item_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 3) Relax chk_exercise_required
-- ============================================================================
-- Old: item_type != 'exercise' OR exercise_id IS NOT NULL
-- New: item_type NOT IN ('exercise') OR exercise_id IS NOT NULL
--      (warmup/cardio don't require exercise_id — they're standalone)
-- The original constraint already allows NULL exercise_id for non-exercise types,
-- but let's make it explicit with a clearer name.

ALTER TABLE workout_item_templates
    DROP CONSTRAINT IF EXISTS chk_exercise_required;

ALTER TABLE workout_item_templates
    ADD CONSTRAINT chk_exercise_required
    CHECK (item_type != 'exercise' OR exercise_id IS NOT NULL);

-- assigned_workout_items doesn't have this named constraint in the original schema
-- (it was only on workout_item_templates), but let's ensure consistency
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'assigned_workout_items_chk_exercise_required'
    ) THEN
        ALTER TABLE assigned_workout_items
            DROP CONSTRAINT assigned_workout_items_chk_exercise_required;
    END IF;
END $$;

-- ============================================================================
-- 4) Update assign_program_to_student to copy item_config
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_program_to_student(
    p_template_id UUID,
    p_student_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_assigned_program_id UUID;
    v_template RECORD;
    v_workout RECORD;
    v_assigned_workout_id UUID;
    v_item RECORD;
    v_assigned_item_id UUID;
    v_parent_mapping JSONB := '{}';
    v_child_item RECORD;
BEGIN
    -- Get the trainer ID from the current user
    v_trainer_id := current_trainer_id();

    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated as a trainer';
    END IF;

    -- Verify the student belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM students
        WHERE id = p_student_id AND trainer_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student not found or does not belong to this trainer';
    END IF;

    -- Verify the template belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM program_templates
        WHERE id = p_template_id AND trainer_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Program template not found or does not belong to this trainer';
    END IF;

    -- Get template data
    SELECT * INTO v_template FROM program_templates WHERE id = p_template_id;

    -- Deactivate any existing active programs for this student
    UPDATE assigned_programs
    SET status = 'paused', updated_at = now()
    WHERE student_id = p_student_id AND status = 'active';

    -- Create assigned program
    INSERT INTO assigned_programs (
        student_id,
        trainer_id,
        source_template_id,
        name,
        description,
        duration_weeks,
        status,
        started_at,
        current_week
    ) VALUES (
        p_student_id,
        v_trainer_id,
        p_template_id,
        v_template.name,
        v_template.description,
        v_template.duration_weeks,
        'active',
        p_start_date,
        1
    ) RETURNING id INTO v_assigned_program_id;

    -- Copy workouts
    FOR v_workout IN
        SELECT * FROM workout_templates
        WHERE program_template_id = p_template_id
        ORDER BY order_index
    LOOP
        INSERT INTO assigned_workouts (
            assigned_program_id,
            source_template_id,
            name,
            order_index
        ) VALUES (
            v_assigned_program_id,
            v_workout.id,
            v_workout.name,
            v_workout.order_index
        ) RETURNING id INTO v_assigned_workout_id;

        -- Copy workout items (first pass: items without parent)
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
                assigned_workout_id,
                parent_item_id,
                source_template_id,
                item_type,
                order_index,
                exercise_id,
                exercise_name,
                exercise_muscle_group,
                exercise_equipment,
                sets,
                reps,
                rest_seconds,
                notes,
                substitute_exercise_ids,
                exercise_function,
                item_config
            ) VALUES (
                v_assigned_workout_id,
                NULL,
                v_item.id,
                v_item.item_type,
                v_item.order_index,
                v_item.exercise_id,
                v_item.ex_name,
                v_item.ex_muscle_group,
                v_item.ex_equipment,
                v_item.sets,
                v_item.reps,
                v_item.rest_seconds,
                v_item.notes,
                v_item.substitute_exercise_ids,
                v_item.exercise_function,
                v_item.item_config
            ) RETURNING id INTO v_assigned_item_id;

            -- Store mapping for parent references
            v_parent_mapping := v_parent_mapping || jsonb_build_object(v_item.id::text, v_assigned_item_id::text);

            -- Copy child items (for supersets)
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
                    assigned_workout_id,
                    parent_item_id,
                    source_template_id,
                    item_type,
                    order_index,
                    exercise_id,
                    exercise_name,
                    exercise_muscle_group,
                    exercise_equipment,
                    sets,
                    reps,
                    rest_seconds,
                    notes,
                    substitute_exercise_ids,
                    exercise_function,
                    item_config
                ) VALUES (
                    v_assigned_workout_id,
                    v_assigned_item_id,
                    v_child_item.id,
                    v_child_item.item_type,
                    v_child_item.order_index,
                    v_child_item.exercise_id,
                    v_child_item.ex_name,
                    v_child_item.ex_muscle_group,
                    v_child_item.ex_equipment,
                    v_child_item.sets,
                    v_child_item.reps,
                    v_child_item.rest_seconds,
                    v_child_item.notes,
                    v_child_item.substitute_exercise_ids,
                    v_child_item.exercise_function,
                    v_child_item.item_config
                );
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN v_assigned_program_id;
END;
$$;

-- ============================================================================
-- 5) Update get_student_today_workout_for_trainer to return warmup/cardio + item_config
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_today_workout_for_trainer(
    p_student_id UUID,
    p_assigned_workout_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_workout    RECORD;
    v_items      JSONB;
    v_exercises  JSONB := '[]'::jsonb;
    v_notes      JSONB := '[]'::jsonb;
    v_superset_map JSONB := '{}'::jsonb;
    v_item       RECORD;
    v_prev       RECORD;
    v_prev_load  TEXT;
    v_prev_sets  JSONB;
BEGIN
    -- Validate trainer
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Validate student belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM students
        WHERE id = p_student_id
          AND coach_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this trainer';
    END IF;

    -- Fetch workout
    SELECT aw.id, aw.name, aw.assigned_program_id
    INTO v_workout
    FROM assigned_workouts aw
    WHERE aw.id = p_assigned_workout_id;

    IF v_workout IS NULL THEN
        RAISE EXCEPTION 'Workout not found';
    END IF;

    -- First pass: build superset map (parent_id → rest_seconds)
    FOR v_item IN
        SELECT id, rest_seconds, order_index
        FROM assigned_workout_items
        WHERE assigned_workout_id = p_assigned_workout_id
          AND item_type = 'superset'
        ORDER BY order_index
    LOOP
        v_superset_map := v_superset_map || jsonb_build_object(
            v_item.id::text,
            jsonb_build_object('rest_seconds', COALESCE(v_item.rest_seconds, 60), 'order_index', v_item.order_index)
        );
    END LOOP;

    -- Second pass: build exercises, warmups, cardios, and notes arrays
    FOR v_item IN
        SELECT
            awi.id,
            awi.exercise_id,
            awi.exercise_name,
            awi.sets,
            awi.reps,
            awi.rest_seconds,
            awi.order_index,
            awi.substitute_exercise_ids,
            awi.item_type,
            awi.parent_item_id,
            awi.notes,
            awi.exercise_function,
            awi.item_config,
            e.name AS exercise_ref_name,
            e.video_url AS exercise_video_url
        FROM assigned_workout_items awi
        LEFT JOIN exercises e ON e.id = awi.exercise_id
        WHERE awi.assigned_workout_id = p_assigned_workout_id
        ORDER BY awi.order_index
    LOOP
        IF v_item.item_type = 'note' AND v_item.notes IS NOT NULL AND trim(v_item.notes) <> '' THEN
            v_notes := v_notes || jsonb_build_object(
                'id', v_item.id,
                'notes', v_item.notes,
                'order_index', v_item.order_index
            );

        ELSIF v_item.item_type IN ('warmup', 'cardio') THEN
            -- Warmup and cardio items: no set tracking, just config
            v_exercises := v_exercises || jsonb_build_object(
                'id', v_item.id,
                'item_type', v_item.item_type,
                'name', COALESCE(v_item.notes, CASE v_item.item_type WHEN 'warmup' THEN 'Aquecimento' ELSE 'Aeróbio' END),
                'order_index', v_item.order_index,
                'item_config', COALESCE(v_item.item_config, '{}'::jsonb),
                'exercise_function', v_item.exercise_function
            );

        ELSIF v_item.item_type = 'exercise' THEN
            -- Fetch previous load (max weight from last completed session)
            v_prev_load := NULL;
            IF v_item.exercise_id IS NOT NULL THEN
                SELECT format('%skg', round(sl.weight::numeric)::text)
                INTO v_prev_load
                FROM set_logs sl
                JOIN workout_sessions ws ON ws.id = sl.workout_session_id
                WHERE sl.exercise_id = v_item.exercise_id
                  AND ws.student_id = p_student_id
                  AND ws.status = 'completed'
                  AND sl.weight IS NOT NULL
                  AND sl.weight > 0
                ORDER BY ws.completed_at DESC, sl.set_number DESC
                LIMIT 1;
            END IF;

            -- Fetch previous per-set data
            v_prev_sets := '[]'::jsonb;
            IF v_item.exercise_id IS NOT NULL THEN
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'set_number', sub.set_number,
                        'weight', sub.weight,
                        'reps', sub.reps_completed
                    ) ORDER BY sub.set_number
                ), '[]'::jsonb)
                INTO v_prev_sets
                FROM (
                    SELECT sl.set_number, sl.weight, sl.reps_completed
                    FROM set_logs sl
                    JOIN workout_sessions ws ON ws.id = sl.workout_session_id
                    WHERE sl.exercise_id = v_item.exercise_id
                      AND ws.student_id = p_student_id
                      AND ws.status = 'completed'
                      AND sl.is_completed = true
                      AND ws.completed_at = (
                          SELECT max(ws2.completed_at)
                          FROM workout_sessions ws2
                          JOIN set_logs sl2 ON sl2.workout_session_id = ws2.id
                          WHERE sl2.exercise_id = v_item.exercise_id
                            AND ws2.student_id = p_student_id
                            AND ws2.status = 'completed'
                            AND sl2.is_completed = true
                      )
                    ORDER BY sl.set_number
                ) sub;
            END IF;

            v_exercises := v_exercises || jsonb_build_object(
                'id', v_item.id,
                'item_type', 'exercise',
                'planned_exercise_id', v_item.exercise_id,
                'exercise_id', v_item.exercise_id,
                'name', COALESCE(v_item.exercise_ref_name, v_item.exercise_name, 'Exercício'),
                'sets', COALESCE(v_item.sets, 3),
                'reps', COALESCE(v_item.reps, '12'),
                'rest_seconds', COALESCE(v_item.rest_seconds, 60),
                'video_url', v_item.exercise_video_url,
                'substitute_exercise_ids', COALESCE(to_jsonb(v_item.substitute_exercise_ids), '[]'::jsonb),
                'swap_source', 'none',
                'previousLoad', v_prev_load,
                'previousSets', v_prev_sets,
                'notes', v_item.notes,
                'supersetId', v_item.parent_item_id,
                'supersetRestSeconds', CASE
                    WHEN v_item.parent_item_id IS NOT NULL
                    THEN (v_superset_map -> v_item.parent_item_id::text ->> 'rest_seconds')::int
                    ELSE NULL
                END,
                'order_index', v_item.order_index,
                'exercise_function', v_item.exercise_function,
                'item_config', COALESCE(v_item.item_config, '{}'::jsonb)
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'assignedProgramId', v_workout.assigned_program_id,
        'workoutName', v_workout.name,
        'exercises', v_exercises,
        'workoutNotes', v_notes
    );
END;
$$;
