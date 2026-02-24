-- ============================================================
-- 033: Trainer Notifications Table
-- Stores notifications for trainers (cancellations, alerts, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS trainer_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trainer_notifications ENABLE ROW LEVEL SECURITY;

-- Trainers can read their own notifications
CREATE POLICY trainer_notifications_select ON trainer_notifications
    FOR SELECT USING (trainer_id = current_trainer_id());

-- Trainers can mark as read
CREATE POLICY trainer_notifications_update ON trainer_notifications
    FOR UPDATE USING (trainer_id = current_trainer_id());

-- Service role inserts (from API routes) bypass RLS, so no INSERT policy needed for trainers.

CREATE INDEX idx_trainer_notifications_trainer ON trainer_notifications(trainer_id);
CREATE INDEX idx_trainer_notifications_unread ON trainer_notifications(trainer_id, read) WHERE read = false;
