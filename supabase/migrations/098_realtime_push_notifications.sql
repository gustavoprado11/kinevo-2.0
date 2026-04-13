-- ============================================================
-- Migration 098: Real-time push notifications via pg_net + Edge Function
--
-- Problem: DB triggers create trainer_notifications rows but don't send
-- push notifications. Push was only sent by daily cron or when app calls
-- flush-pending. This means trainers don't get banner notifications
-- in real-time when students complete workouts, submit forms, etc.
--
-- Solution: Use pg_net to make async HTTP calls to an Edge Function
-- (send-push-notification) immediately after INSERT into
-- trainer_notifications or student_inbox_items.
-- ============================================================

-- 1. Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Trigger: trainer_notifications INSERT → send push via Edge Function
CREATE OR REPLACE FUNCTION notify_push_on_trainer_notification()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'trainer_notifications',
        'record', row_to_json(NEW)::jsonb
    );

    PERFORM net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/send-push-notification',
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push-trigger] Failed to call Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_trainer_notification_push ON trainer_notifications;
CREATE TRIGGER on_trainer_notification_push
    AFTER INSERT ON trainer_notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_push_on_trainer_notification();

-- 3. Trigger: student_inbox_items INSERT → send push via Edge Function
CREATE OR REPLACE FUNCTION notify_push_on_student_inbox_item()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'student_inbox_items',
        'record', row_to_json(NEW)::jsonb
    );

    PERFORM net.http_post(
        url := 'https://lylksbtgrihzepbteest.supabase.co/functions/v1/send-push-notification',
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push-trigger] Failed to call Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_student_inbox_item_push ON student_inbox_items;
CREATE TRIGGER on_student_inbox_item_push
    AFTER INSERT ON student_inbox_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_push_on_student_inbox_item();
