-- ============================================================
-- 099: Fix notification mark-as-read bug
--
-- Root cause: Migration 094 introduced RPCs and RLS policies
-- that use auth.uid() directly, but trainer_notifications.trainer_id
-- references trainers(id) — a different UUID from auth.uid().
-- The correct lookup is current_trainer_id() which resolves
-- the trainer PK from the authenticated user.
--
-- This migration:
-- 1. Drops the broken RLS policies from 094
-- 2. Ensures the correct policies from 033 exist (using current_trainer_id())
-- 3. Replaces all three RPCs to use current_trainer_id()
-- ============================================================

-- 1. Drop the broken policies added by migration 094
DROP POLICY IF EXISTS "Trainers can view own notifications" ON trainer_notifications;
DROP POLICY IF EXISTS "Trainers can update own notifications" ON trainer_notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON trainer_notifications;

-- 2. Re-create correct RLS policies using current_trainer_id()
-- (Drop first in case 033's originals still exist, to avoid conflicts)
DROP POLICY IF EXISTS trainer_notifications_select ON trainer_notifications;
DROP POLICY IF EXISTS trainer_notifications_update ON trainer_notifications;
DROP POLICY IF EXISTS trainer_notifications_insert ON trainer_notifications;

CREATE POLICY trainer_notifications_select ON trainer_notifications
    FOR SELECT USING (trainer_id = current_trainer_id());

CREATE POLICY trainer_notifications_update ON trainer_notifications
    FOR UPDATE USING (trainer_id = current_trainer_id());

CREATE POLICY trainer_notifications_insert ON trainer_notifications
    FOR INSERT WITH CHECK (true);

-- 3. Fix RPCs to use current_trainer_id() instead of auth.uid()
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE trainer_notifications SET is_read = true
    WHERE id = p_notification_id AND trainer_id = current_trainer_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE trainer_notifications SET is_read = true
    WHERE trainer_id = current_trainer_id() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS integer AS $$
BEGIN
    RETURN (SELECT COUNT(*)::integer FROM trainer_notifications
            WHERE trainer_id = current_trainer_id() AND is_read = false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
