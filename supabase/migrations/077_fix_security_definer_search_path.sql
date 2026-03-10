-- ============================================================
-- Migration 077: Fix SECURITY DEFINER functions missing SET search_path
--
-- SECURITY DEFINER functions run with the privileges of the function owner.
-- Without SET search_path, an attacker could create malicious objects in a
-- user-writable schema that shadows public schema objects, leading to
-- privilege escalation. This migration adds SET search_path = public
-- to all affected functions.
-- ============================================================

-- 1. notify_trainer_workout_completed (from migration 056)
CREATE OR REPLACE FUNCTION notify_trainer_workout_completed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, message, metadata)
        SELECT
            s.coach_id,
            'workout_completed',
            s.name || ' completou treino',
            s.name || ' completou ' || COALESCE(aw.name, 'treino'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'session_id', NEW.id,
                'workout_name', aw.name
            )
        FROM students s
        LEFT JOIN assigned_workouts aw ON aw.id = NEW.assigned_workout_id
        WHERE s.id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. notify_trainer_form_submitted (from migration 056)
CREATE OR REPLACE FUNCTION notify_trainer_form_submitted() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, message, metadata)
        SELECT
            NEW.trainer_id,
            'form_submitted',
            s.name || ' respondeu formulário',
            s.name || ' respondeu ' || COALESCE(ft.title, 'formulário'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'submission_id', NEW.id,
                'form_title', ft.title
            )
        FROM students s
        LEFT JOIN form_templates ft ON ft.id = NEW.form_template_id
        WHERE s.id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. get_student_sessions_heatmap (from migration 057)
CREATE OR REPLACE FUNCTION get_student_sessions_heatmap(
    p_student_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
