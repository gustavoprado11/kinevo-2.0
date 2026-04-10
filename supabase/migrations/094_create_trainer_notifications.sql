-- Migration: align trainer_notifications schema with mobile app
-- Table was pre-created; this migration aligns columns and adds RPCs.

-- Add category column
ALTER TABLE trainer_notifications ADD COLUMN IF NOT EXISTS category TEXT;

-- Rename columns to match app schema
ALTER TABLE trainer_notifications RENAME COLUMN message TO body;
ALTER TABLE trainer_notifications RENAME COLUMN read TO is_read;
ALTER TABLE trainer_notifications RENAME COLUMN metadata TO data;

-- Drop unused column
ALTER TABLE trainer_notifications DROP COLUMN IF EXISTS push_sent_at;

-- Defaults
ALTER TABLE trainer_notifications ALTER COLUMN data SET DEFAULT '{}';
ALTER TABLE trainer_notifications ALTER COLUMN is_read SET DEFAULT false;

-- Backfill category
UPDATE trainer_notifications SET category = CASE
    WHEN type IN ('form_request', 'feedback', 'form_submission') THEN 'forms'
    WHEN type IN ('payment_received', 'payment_failed', 'payment_overdue', 'subscription_canceled', 'cancellation_alert') THEN 'payments'
    WHEN type IN ('program_assigned', 'program_expired') THEN 'programs'
    ELSE 'students'
END WHERE category IS NULL;

ALTER TABLE trainer_notifications ALTER COLUMN category SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trainer_notifications_trainer ON trainer_notifications(trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_notifications_unread ON trainer_notifications(trainer_id) WHERE is_read = false;

-- RLS
ALTER TABLE trainer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can view own notifications" ON trainer_notifications;
DROP POLICY IF EXISTS "Trainers can update own notifications" ON trainer_notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON trainer_notifications;

CREATE POLICY "Trainers can view own notifications"
    ON trainer_notifications FOR SELECT
    USING (trainer_id = auth.uid());

CREATE POLICY "Trainers can update own notifications"
    ON trainer_notifications FOR UPDATE
    USING (trainer_id = auth.uid());

CREATE POLICY "Service can insert notifications"
    ON trainer_notifications FOR INSERT
    WITH CHECK (true);

-- RPCs
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE trainer_notifications SET is_read = true
    WHERE id = p_notification_id AND trainer_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE trainer_notifications SET is_read = true
    WHERE trainer_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS integer AS $$
BEGIN
    RETURN (SELECT COUNT(*)::integer FROM trainer_notifications
            WHERE trainer_id = auth.uid() AND is_read = false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
