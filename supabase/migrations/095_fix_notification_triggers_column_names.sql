-- ============================================================
-- Migration 095: Fix notification trigger functions after column renames
--
-- Migration 094 renamed trainer_notifications columns:
--   message  → body
--   metadata → data
--   read     → is_read
--
-- But the trigger functions from 077 still reference the old names,
-- causing "column message does not exist" errors when students
-- complete workouts or submit forms.
-- ============================================================

-- 1. notify_trainer_workout_completed
CREATE OR REPLACE FUNCTION notify_trainer_workout_completed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, body, data, category)
        SELECT
            s.coach_id,
            'workout_completed',
            s.name || ' completou treino',
            s.name || ' completou ' || COALESCE(aw.name, 'treino'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'session_id', NEW.id,
                'workout_name', aw.name
            ),
            'students'
        FROM students s
        LEFT JOIN assigned_workouts aw ON aw.id = NEW.assigned_workout_id
        WHERE s.id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. notify_trainer_form_submitted
CREATE OR REPLACE FUNCTION notify_trainer_form_submitted() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, body, data, category)
        SELECT
            NEW.trainer_id,
            'form_submitted',
            s.name || ' respondeu formulário',
            s.name || ' respondeu ' || COALESCE(ft.title, 'formulário'),
            jsonb_build_object(
                'student_id', NEW.student_id,
                'submission_id', NEW.id,
                'form_title', ft.title
            ),
            'forms'
        FROM students s
        LEFT JOIN form_templates ft ON ft.id = NEW.form_template_id
        WHERE s.id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
