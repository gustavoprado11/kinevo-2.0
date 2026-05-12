-- ============================================================
-- Migration 125: Restore push_sent_at on trainer_notifications
--
-- Background: Migration 094 dropped trainer_notifications.push_sent_at,
-- but the send-push-notification Edge Function still references it
-- (SELECT for dedupe, UPDATE after Expo send). The SELECT returns
-- `null` silently because Supabase JS doesn't throw on missing column,
-- which silently breaks the dedupe guard and can lead to duplicate
-- pushes when the same trainer_notifications row is processed twice
-- (DB trigger + API route flush, for example).
--
-- This migration restores the column and adds a partial index for the
-- "not-yet-pushed" lookup pattern used by the dedupe check.
-- ============================================================

ALTER TABLE trainer_notifications
    ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ NULL;

-- Partial index: most queries against this column look for rows where it
-- IS NULL (pending push). Indexing only those keeps it small.
CREATE INDEX IF NOT EXISTS idx_trainer_notifications_push_pending
    ON trainer_notifications(id)
    WHERE push_sent_at IS NULL;

COMMENT ON COLUMN trainer_notifications.push_sent_at IS
    'Timestamp when the Expo push was successfully dispatched. NULL means not yet pushed. Used by send-push-notification Edge Function for dedupe.';
