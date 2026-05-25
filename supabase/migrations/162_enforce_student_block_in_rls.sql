-- Security fix (A3): enforce the inadimplência/access block server-side.
--
-- Until now the block lived only in the client (useStudentAccess ->
-- PaymentBlockedScreen). check_student_access() computes the block correctly,
-- but the data tables' RLS gated student reads on ownership only, so a
-- delinquent student who patched the client (or hit PostgREST directly with
-- the public anon key + their JWT) kept reading/writing their own training
-- content. This is a revenue/enforcement bypass (no cross-tenant data leak —
-- ownership RLS is intact).
--
-- Approach (per decision): gate ONLY the paid training content on
-- access_blocked_at, consistent with the cron block_overdue_students() which is
-- the authoritative source for that column. We do NOT replicate the full
-- contract/grace/courtesy logic here.
--
-- Mechanism: a dedicated helper current_student_id_active() that mirrors
-- current_student_id() but returns NULL when the student is blocked. We swap it
-- into the *student-self* policies only. Trainer policies (current_trainer_id())
-- are untouched, so a coach still sees and manages blocked students. Profile,
-- contract and messaging tables keep current_student_id() so the block screen
-- and payment flow still work.

CREATE OR REPLACE FUNCTION public.current_student_id_active()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT id FROM students
    WHERE auth_user_id = auth.uid()
      AND access_blocked_at IS NULL
$function$;

GRANT EXECUTE ON FUNCTION public.current_student_id_active() TO authenticated, service_role;

COMMENT ON FUNCTION public.current_student_id_active() IS
    'Como current_student_id(), mas retorna NULL se o aluno está bloqueado '
    '(access_blocked_at IS NOT NULL). Usado nas RLS de conteúdo pago para '
    'enforce do bloqueio de inadimplência no servidor.';

-- assigned_programs
ALTER POLICY assigned_programs_student_select ON public.assigned_programs
  USING (student_id = current_student_id_active());

-- assigned_workouts
ALTER POLICY assigned_workouts_student_select ON public.assigned_workouts
  USING (assigned_program_id IN (
    SELECT assigned_programs.id FROM assigned_programs
    WHERE assigned_programs.student_id = current_student_id_active()));

-- assigned_workout_items
ALTER POLICY assigned_workout_items_student_select ON public.assigned_workout_items
  USING (assigned_workout_id IN (
    SELECT aw.id FROM assigned_workouts aw
      JOIN assigned_programs ap ON aw.assigned_program_id = ap.id
    WHERE ap.student_id = current_student_id_active()));

-- workout_sessions
ALTER POLICY workout_sessions_student_select ON public.workout_sessions
  USING (student_id = current_student_id_active());

ALTER POLICY workout_sessions_student_update ON public.workout_sessions
  USING (student_id = current_student_id_active());

ALTER POLICY workout_sessions_student_insert ON public.workout_sessions
  WITH CHECK ((student_id = current_student_id_active())
              AND (trainer_id = current_student_coach_id()));

-- set_logs
ALTER POLICY set_logs_student_select ON public.set_logs
  USING (workout_session_id IN (
    SELECT workout_sessions.id FROM workout_sessions
    WHERE workout_sessions.student_id = current_student_id_active()));

ALTER POLICY set_logs_student_update ON public.set_logs
  USING (workout_session_id IN (
    SELECT workout_sessions.id FROM workout_sessions
    WHERE workout_sessions.student_id = current_student_id_active()));

ALTER POLICY set_logs_student_insert ON public.set_logs
  WITH CHECK (workout_session_id IN (
    SELECT workout_sessions.id FROM workout_sessions
    WHERE workout_sessions.student_id = current_student_id_active()));
