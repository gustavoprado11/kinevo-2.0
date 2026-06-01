-- Security hardening (RLS audit, 2026-06): pin search_path on SECURITY DEFINER
-- functions that had a mutable search_path (prevents search_path hijacking, which
-- is the main escalation vector for SECURITY DEFINER functions).

ALTER FUNCTION public.create_trainer_self_student()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.get_student_detail_v2(uuid)                   SET search_path = public, pg_temp;
ALTER FUNCTION public.get_unread_notification_count()              SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_all_notifications_read()               SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_notification_read(uuid)                 SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_push_on_student_inbox_item()         SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_push_on_trainer_notification()       SET search_path = public, pg_temp;
ALTER FUNCTION public.register_student_registered_event()         SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_student_avatar_to_trainer()            SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_trainer_avatar_to_student()            SET search_path = public, pg_temp;
