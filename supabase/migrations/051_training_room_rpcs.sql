-- ============================================================================
-- Kinevo — 051 Training Room RPCs for Mobile Trainer Mode (Phase 2)
-- ============================================================================
-- Two SECURITY DEFINER RPCs that let the mobile trainer app:
--   1. Fetch a student's full workout data (exercises, supersets, notes, previous loads)
--   2. Finish a workout session on behalf of a student (insert session + set_logs)
-- ============================================================================

-- ============================================================================
-- 1. get_student_today_workout_for_trainer
-- ============================================================================
-- Returns the full workout structure for a given student + assigned_workout_id.
-- Validates the student belongs to the calling trainer via coach_id.
-- Returns JSONB with: assignedProgramId, workoutName, exercises[], workoutNotes[]
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


-- ============================================================================
-- 2. trainer_finish_workout_session
-- ============================================================================
-- Creates a workout_session + set_logs on behalf of a student.
-- Only inserts completed sets. Returns the session ID.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trainer_finish_workout_session(
    p_student_id       UUID,
    p_assigned_workout_id UUID,
    p_assigned_program_id UUID,
    p_sets             JSONB,       -- array of { assignedWorkoutItemId, plannedExerciseId, executedExerciseId, swapSource, setNumber, weight, repsCompleted, weightUnit }
    p_started_at       TIMESTAMPTZ,
    p_duration_seconds INTEGER,
    p_rpe              SMALLINT DEFAULT NULL,
    p_feedback         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id  UUID;
    v_session_id  UUID;
    v_set         JSONB;
    v_duration    INTEGER;
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

    -- Safety cap on duration: max 6 hours (21600 seconds)
    v_duration := LEAST(COALESCE(p_duration_seconds, 0), 21600);

    -- Insert workout_session
    INSERT INTO workout_sessions (
        student_id,
        trainer_id,
        assigned_workout_id,
        assigned_program_id,
        status,
        started_at,
        completed_at,
        duration_seconds,
        sync_status,
        rpe,
        feedback
    ) VALUES (
        p_student_id,
        v_trainer_id,
        p_assigned_workout_id,
        p_assigned_program_id,
        'completed',
        p_started_at,
        now(),
        v_duration,
        'synced',
        p_rpe,
        p_feedback
    )
    RETURNING id INTO v_session_id;

    -- Insert set_logs for each completed set
    FOR v_set IN SELECT * FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb))
    LOOP
        INSERT INTO set_logs (
            workout_session_id,
            assigned_workout_item_id,
            planned_exercise_id,
            executed_exercise_id,
            swap_source,
            exercise_id,
            set_number,
            weight,
            reps_completed,
            is_completed,
            completed_at,
            weight_unit
        ) VALUES (
            v_session_id,
            (v_set ->> 'assignedWorkoutItemId')::uuid,
            NULLIF(v_set ->> 'plannedExerciseId', '')::uuid,
            NULLIF(v_set ->> 'executedExerciseId', '')::uuid,
            COALESCE(v_set ->> 'swapSource', 'none'),
            NULLIF(v_set ->> 'executedExerciseId', '')::uuid,
            (v_set ->> 'setNumber')::int,
            COALESCE((v_set ->> 'weight')::decimal, 0),
            COALESCE((v_set ->> 'repsCompleted')::int, 0),
            true,
            now(),
            COALESCE(v_set ->> 'weightUnit', 'kg')
        );
    END LOOP;

    RETURN v_session_id;
END;
$$;


-- ============================================================================
-- 3. get_training_room_students
-- ============================================================================
-- Returns active students with their programs and workout options.
-- Used by the StudentPickerModal.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_training_room_students()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_result     JSONB := '[]'::jsonb;
    v_student    RECORD;
    v_program    RECORD;
    v_workouts   JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    FOR v_student IN
        SELECT s.id, s.name, s.avatar_url
        FROM students s
        WHERE s.coach_id = v_trainer_id
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
        ORDER BY s.name
    LOOP
        -- Find active program
        SELECT ap.id, ap.name, ap.started_at, ap.duration_weeks
        INTO v_program
        FROM assigned_programs ap
        WHERE ap.student_id = v_student.id
          AND ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
        ORDER BY ap.started_at DESC
        LIMIT 1;

        -- Get workouts for program
        v_workouts := '[]'::jsonb;
        IF v_program.id IS NOT NULL THEN
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', aw.id,
                    'name', aw.name,
                    'scheduled_days', COALESCE(to_jsonb(aw.scheduled_days), '[]'::jsonb)
                ) ORDER BY aw.name
            ), '[]'::jsonb)
            INTO v_workouts
            FROM assigned_workouts aw
            WHERE aw.assigned_program_id = v_program.id;
        END IF;

        v_result := v_result || jsonb_build_object(
            'id', v_student.id,
            'name', v_student.name,
            'avatar_url', v_student.avatar_url,
            'program', CASE
                WHEN v_program.id IS NOT NULL THEN jsonb_build_object(
                    'id', v_program.id,
                    'name', v_program.name,
                    'started_at', v_program.started_at,
                    'duration_weeks', v_program.duration_weeks
                )
                ELSE NULL
            END,
            'workouts', v_workouts
        );
    END LOOP;

    RETURN v_result;
END;
$$;


-- ============================================================================
-- Verify all RPCs
-- ============================================================================
DO $test$
BEGIN
    -- Test 1: get_student_today_workout_for_trainer
    BEGIN
        PERFORM public.get_student_today_workout_for_trainer(
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid
        );
        RAISE NOTICE 'TEST UNEXPECTED: should have raised Not a trainer';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_student_today_workout_for_trainer rejects non-trainer';
            ELSE
                RAISE EXCEPTION 'get_student_today_workout_for_trainer failed: %', SQLERRM;
            END IF;
    END;

    -- Test 2: trainer_finish_workout_session
    BEGIN
        PERFORM public.trainer_finish_workout_session(
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid,
            '[]'::jsonb,
            now(),
            0
        );
        RAISE NOTICE 'TEST UNEXPECTED: should have raised Not a trainer';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: trainer_finish_workout_session rejects non-trainer';
            ELSE
                RAISE EXCEPTION 'trainer_finish_workout_session failed: %', SQLERRM;
            END IF;
    END;

    -- Test 3: get_training_room_students
    BEGIN
        PERFORM public.get_training_room_students();
        RAISE NOTICE 'TEST UNEXPECTED: should have raised Not a trainer';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_training_room_students rejects non-trainer';
            ELSE
                RAISE EXCEPTION 'get_training_room_students failed: %', SQLERRM;
            END IF;
    END;
END;
$test$;
