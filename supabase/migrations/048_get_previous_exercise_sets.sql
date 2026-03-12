-- ============================================================================
-- Kinevo — 048 Per-Set Previous Data for Workout Execution
-- ============================================================================
-- Returns per-set weight and reps from the student's last completed session
-- for a given exercise. Used to show "Anterior" column in the workout screen.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_previous_exercise_sets(
    p_student_id UUID,
    p_exercise_id UUID
)
RETURNS TABLE (
    set_number INTEGER,
    weight DECIMAL(10,2),
    reps INTEGER
)
LANGUAGE sql
STABLE
AS $$
    WITH latest_session AS (
        SELECT ws.id
        FROM workout_sessions ws
        JOIN set_logs sl
            ON sl.workout_session_id = ws.id
        WHERE ws.student_id = p_student_id
          AND ws.status = 'completed'
          AND sl.is_completed = true
          AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
        ORDER BY ws.completed_at DESC NULLS LAST
        LIMIT 1
    )
    SELECT
        sl.set_number,
        sl.weight,
        sl.reps_completed AS reps
    FROM set_logs sl
    JOIN latest_session ls ON sl.workout_session_id = ls.id
    WHERE sl.is_completed = true
      AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
    ORDER BY sl.set_number;
$$;

GRANT EXECUTE ON FUNCTION get_previous_exercise_sets(UUID, UUID) TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
