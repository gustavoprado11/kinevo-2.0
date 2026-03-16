-- ============================================================
-- Migration 056: Push notification infrastructure
-- push_tokens table, notification_preferences on trainers,
-- push_sent_at on trainer_notifications, DB triggers
-- ============================================================

-- 1. Push tokens table
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('trainer', 'student')),
    expo_push_token TEXT NOT NULL,
    platform TEXT DEFAULT 'ios',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role, expo_push_token)
);

-- RLS for push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_trainer_select ON push_tokens
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY push_tokens_trainer_update ON push_tokens
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Service role can insert/delete (used by API routes)
CREATE POLICY push_tokens_service_insert ON push_tokens
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY push_tokens_service_delete ON push_tokens
    FOR DELETE TO service_role
    USING (true);

CREATE POLICY push_tokens_service_select ON push_tokens
    FOR SELECT TO service_role
    USING (true);

CREATE POLICY push_tokens_service_update ON push_tokens
    FOR UPDATE TO service_role
    USING (true);

-- 2. Notification preferences on trainers
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS notification_preferences JSONB
    DEFAULT '{"workout_completed":true,"form_submitted":true,"payment_received":true,"payment_overdue":true,"program_expiring":true,"student_inactive":true}'::jsonb;

-- 3. Push tracking on trainer_notifications
ALTER TABLE trainer_notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- ============================================================
-- 4. Trigger: workout completed → notify trainer
-- ============================================================
CREATE OR REPLACE FUNCTION notify_trainer_workout_completed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        INSERT INTO trainer_notifications (trainer_id, type, title, message, metadata)
        SELECT
            NEW.trainer_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workout_completed
    AFTER INSERT OR UPDATE ON workout_sessions
    FOR EACH ROW EXECUTE FUNCTION notify_trainer_workout_completed();

-- ============================================================
-- 5. Trigger: form submitted → notify trainer
-- ============================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_form_submitted
    AFTER INSERT ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION notify_trainer_form_submitted();
