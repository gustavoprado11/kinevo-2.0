-- ============================================================================
-- Kinevo — 087 Fix superset ordering in Training Room
-- ============================================================================
-- Bug: Superset children have local order_index (0,1,2...) which caused
-- the frontend grouping logic to place supersets at the top of the workout.
-- Fix: Add supersetOrderIndex field to the RPC response, carrying the
-- superset parent's global order_index so the frontend can position the
-- group correctly.
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

    -- First pass: build superset map (parent_id → rest_seconds, order_index)
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

    -- Second pass: build exercises and notes arrays
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
                'supersetOrderIndex', CASE
                    WHEN v_item.parent_item_id IS NOT NULL
                    THEN (v_superset_map -> v_item.parent_item_id::text ->> 'order_index')::int
                    ELSE NULL
                END,
                'order_index', v_item.order_index
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
