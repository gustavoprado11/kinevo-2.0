-- ============================================================
-- Migration 069: Student push notification support
-- Expands student_inbox_items types + adds push tracking
-- ============================================================

-- 1. Expand the type CHECK constraint to include program_assigned
ALTER TABLE student_inbox_items DROP CONSTRAINT IF EXISTS student_inbox_items_type_check;
ALTER TABLE student_inbox_items ADD CONSTRAINT student_inbox_items_type_check
    CHECK (type IN ('form_request', 'feedback', 'system_alert', 'text_message', 'program_assigned'));

-- 2. Add push tracking column (mirrors trainer_notifications.push_sent_at)
ALTER TABLE student_inbox_items ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- 3. Index for pending push processing
CREATE INDEX IF NOT EXISTS idx_student_inbox_push_pending
    ON student_inbox_items (student_id)
    WHERE push_sent_at IS NULL;
