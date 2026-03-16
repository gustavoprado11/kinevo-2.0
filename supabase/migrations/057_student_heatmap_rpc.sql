-- ============================================================
-- Migration 057: Student sessions heatmap RPC
-- Returns daily session counts + details for a date range
-- Used by mobile trainer heatmap component
-- ============================================================

CREATE OR REPLACE FUNCTION get_student_sessions_heatmap(
    p_student_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_trainer_id UUID;
    v_result JSONB;
BEGIN
    -- Validate trainer ownership
    SELECT coach_id INTO v_trainer_id
    FROM students
    WHERE id = p_student_id;

    IF v_trainer_id IS NULL OR v_trainer_id != current_trainer_id() THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(day_data ORDER BY day_data->>'date'), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'date', d.session_date::text,
            'count', COUNT(*)::int,
            'sessions', jsonb_agg(
                jsonb_build_object(
                    'id', ws.id,
                    'workout_name', COALESCE(aw.name, 'Treino'),
                    'duration_seconds', ws.duration_seconds,
                    'completed_at', ws.completed_at
                )
                ORDER BY ws.completed_at
            )
        ) AS day_data
        FROM (
            SELECT
                ws.id,
                ws.assigned_workout_id,
                ws.duration_seconds,
                ws.completed_at,
                (ws.completed_at AT TIME ZONE 'America/Sao_Paulo')::date AS session_date
            FROM workout_sessions ws
            WHERE ws.student_id = p_student_id
              AND ws.status = 'completed'
              AND ws.completed_at IS NOT NULL
              AND (ws.completed_at AT TIME ZONE 'America/Sao_Paulo')::date
                  BETWEEN p_start_date AND p_end_date
        ) d
        JOIN workout_sessions ws ON ws.id = d.id
        LEFT JOIN assigned_workouts aw ON aw.id = d.assigned_workout_id
        GROUP BY d.session_date
    ) grouped;

    RETURN v_result;
END;
$$;
