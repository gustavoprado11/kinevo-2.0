-- Add notification_preferences JSONB column to students table
-- Format: { "push_enabled": true, "categories": { "program_assigned": true, "form_request": true, "feedback": true, "reminders": true } }
-- NULL means everything enabled (backward compatible)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT NULL;

COMMENT ON COLUMN students.notification_preferences IS 'Student push notification preferences. NULL = all enabled.';
