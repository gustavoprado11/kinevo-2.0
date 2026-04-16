-- ============================================================================
-- Migration 101: Security hardening — RLS and Storage
-- ----------------------------------------------------------------------------
-- Fixes 4 CRITICAL findings from the 2026-04-16 security audit:
--   A. `trainer_notifications` INSERT policy was `WITH CHECK (true)` — any
--      authenticated user could create notifications for any trainer_id.
--      Vector: in-app phishing ("Pagamento recebido R$50k, clique aqui").
--   B. `workout_sessions_student_insert` only validated `student_id`,
--      letting a student spoof `trainer_id` to push notifications and
--      pollute stats on another trainer's dashboard.
--   C. `messages` storage bucket INSERT policy only required
--      `auth.role() = 'authenticated'` — any user could upload anywhere,
--      and the bucket is public so any uploaded file (HTML/JS) could be
--      served from the Supabase origin.
--   D. `feedback` bucket existed in the DB but had no corresponding
--      migration in the repo — state was undocumented and identical to
--      `messages` (public + unscoped INSERT).
--
-- Also adds defense-in-depth:
--   * Hardens file_size_limit and allowed_mime_types on public buckets
--     (avatars/feedback/messages/trainer-videos) so XSS via uploaded
--     HTML and DoS via unbounded uploads are blocked at the storage layer.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- A. Helper function — student's coach_id with SECURITY DEFINER
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_student_coach_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coach_id FROM public.students WHERE id = public.current_student_id();
$$;

GRANT EXECUTE ON FUNCTION public.current_student_coach_id() TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- B. Fix `trainer_notifications` INSERT policy
--    service_role bypasses RLS (server-side inserts continue to work);
--    authenticated users can only insert notifications addressed to themselves.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS trainer_notifications_insert ON public.trainer_notifications;

CREATE POLICY trainer_notifications_insert ON public.trainer_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = public.current_trainer_id());

-- ────────────────────────────────────────────────────────────────────────────
-- C. Fix `workout_sessions` INSERT — prevent student from spoofing trainer_id
--
--    Strategy: BEFORE INSERT trigger derives the authoritative trainer_id
--    from students.coach_id whenever the insert is initiated by the owning
--    student. This is defense-in-depth on top of the tightened RLS below.
--    Service-role and trainer-originated inserts skip the override.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_workout_session_trainer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_ctx uuid;
  expected_trainer uuid;
BEGIN
  student_ctx := public.current_student_id();

  IF student_ctx IS NOT NULL AND NEW.student_id = student_ctx THEN
    SELECT coach_id INTO expected_trainer
    FROM public.students
    WHERE id = NEW.student_id;

    IF expected_trainer IS NULL THEN
      RAISE EXCEPTION 'Cannot insert workout_session: student % has no coach', NEW.student_id;
    END IF;

    -- Override any client-provided trainer_id with the authoritative value.
    NEW.trainer_id := expected_trainer;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workout_session_trainer_id_trg ON public.workout_sessions;
CREATE TRIGGER enforce_workout_session_trainer_id_trg
  BEFORE INSERT ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workout_session_trainer_id();

-- Tighten the RLS policy to assert the same invariant.
DROP POLICY IF EXISTS workout_sessions_student_insert ON public.workout_sessions;

CREATE POLICY workout_sessions_student_insert ON public.workout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = public.current_student_id()
    AND trainer_id = public.current_student_coach_id()
  );

-- ────────────────────────────────────────────────────────────────────────────
-- D. Harden `messages` storage bucket
--
--    Path contract (set by web/src/app/messages/actions.ts and mobile chat
--    hook): `<student_id>/<timestamp>-<name>`. We enforce on INSERT that
--    the uploader is either the student or the student's coach.
--
--    NOTE: bucket stays `public=true` for backward compat with already-sent
--    chat image URLs. A follow-up migration should flip to private + signed
--    URLs once rollout in both clients lands.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  file_size_limit = 10 * 1024 * 1024,  -- 10 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
WHERE id = 'messages';

DROP POLICY IF EXISTS "Authenticated users can upload message images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for message images" ON storage.objects;
DROP POLICY IF EXISTS "messages_upload_scoped" ON storage.objects;
DROP POLICY IF EXISTS "messages_select_public" ON storage.objects;

CREATE POLICY "messages_upload_scoped" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'messages'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT s.id::text
      FROM public.students s
      LEFT JOIN public.trainers t ON t.id = s.coach_id
      WHERE s.auth_user_id = auth.uid() OR t.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "messages_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'messages');

-- ────────────────────────────────────────────────────────────────────────────
-- E. Harden `feedback` storage bucket
--
--    Bucket was created in the Supabase Dashboard outside of version control.
--    This migration brings it under declarative management, scopes INSERT
--    to the uploader's own folder, and applies mime/size limits.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  file_size_limit = 5 * 1024 * 1024,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'feedback';

DROP POLICY IF EXISTS "Authenticated users can upload feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "feedback_upload_scoped" ON storage.objects;
DROP POLICY IF EXISTS "feedback_select_public" ON storage.objects;

CREATE POLICY "feedback_upload_scoped" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedback_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback');

-- ────────────────────────────────────────────────────────────────────────────
-- F. Add mime/size limits to remaining public buckets
--    (avatars and trainer-videos — INSERT policies here already scope by
--    auth.uid() folder; this just caps payload and blocks HTML uploads.)
-- ────────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  file_size_limit = 5 * 1024 * 1024,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
WHERE id = 'avatars';

UPDATE storage.buckets
SET
  file_size_limit = 150 * 1024 * 1024,  -- 150 MB
  allowed_mime_types = ARRAY['video/mp4','video/webm','video/quicktime','video/x-m4v']
WHERE id = 'trainer-videos';
