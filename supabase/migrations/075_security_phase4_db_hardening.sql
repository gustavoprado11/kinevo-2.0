-- ============================================================================
-- Kinevo — 075 Security Phase 4: Database Hardening
-- ============================================================================
-- Fixes 4 remaining HIGH-severity vulnerabilities:
--   1. check_student_access() — add caller authorization
--   2. cleanup_stale_sessions() — restrict to service_role
--   3. workout_sessions/set_logs — replace student FOR ALL with granular policies
--   4. exercises — remove system exercise insert for trainers
-- ============================================================================

-- ============================================================================
-- 1. FIX: check_student_access() — add caller authorization
-- ============================================================================
-- Problem: Any authenticated user can call check_student_access(any_uuid)
-- and learn the student's contract/access status.
-- Fix: Verify the caller is either the student themselves or their trainer.
-- The mobile app calls this as the student (profile.id = own student id).

CREATE OR REPLACE FUNCTION public.check_student_access(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_contract RECORD;
  v_caller_student_id UUID;
  v_caller_trainer_id UUID;
BEGIN
  -- Authorization: caller must be the student or their trainer
  -- Skip check for service_role (used by cron jobs, webhooks)
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    v_caller_student_id := public.current_student_id();
    v_caller_trainer_id := public.current_trainer_id();

    -- Must be either the student themselves or their coach
    IF v_caller_student_id IS NOT NULL AND v_caller_student_id != p_student_id THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'default');
    END IF;

    IF v_caller_student_id IS NULL AND v_caller_trainer_id IS NULL THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'default');
    END IF;

    -- If caller is a trainer, verify they own this student
    IF v_caller_trainer_id IS NOT NULL AND v_caller_student_id IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM students
        WHERE id = p_student_id AND coach_id = v_caller_trainer_id
      ) THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'default');
      END IF;
    END IF;
  END IF;

  -- 1. Get student
  SELECT id, status INTO v_student
  FROM students WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'student_not_found');
  END IF;

  -- 2. Student blocked/archived/inactive by trainer
  IF v_student.status IN ('blocked', 'archived', 'inactive') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'student_inactive');
  END IF;

  -- 3. Get most recent active/past_due contract
  SELECT * INTO v_contract
  FROM student_contracts
  WHERE student_id = p_student_id
    AND status IN ('active', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. No contract = courtesy access
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'courtesy');
  END IF;

  -- 5. Courtesy billing = always allow
  IF v_contract.billing_type = 'courtesy' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'courtesy');
  END IF;

  -- 6. Active contract
  IF v_contract.status = 'active' THEN
    -- Check manual contracts past their period end
    IF v_contract.billing_type IN ('manual_recurring', 'manual_one_off')
       AND v_contract.current_period_end IS NOT NULL
       AND v_contract.current_period_end < now()
    THEN
      -- Within 3-day grace period: still allow
      IF v_contract.current_period_end >= now() - interval '3 days' THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'grace_period');
      END IF;
      -- Past grace period: check block_on_fail
      IF v_contract.block_on_fail = true THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
      ELSE
        RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
      END IF;
    END IF;

    -- Canceling but still active
    IF v_contract.cancel_at_period_end = true THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'canceling');
    END IF;

    RETURN jsonb_build_object('allowed', true, 'reason', 'active');
  END IF;

  -- 7. Past due (Stripe): check block_on_fail
  IF v_contract.status = 'past_due' THEN
    IF v_contract.block_on_fail = true THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
    ELSE
      RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
    END IF;
  END IF;

  -- 8. Default: allow (safety net)
  RETURN jsonb_build_object('allowed', true, 'reason', 'default');
END;
$$;

-- ============================================================================
-- 2. FIX: cleanup_stale_sessions() — restrict to service_role only
-- ============================================================================
-- Problem: Any authenticated user can call this and abandon all in-progress
-- sessions across the entire platform.
-- Fix: Add service_role check. Revoke execute from public/authenticated.

CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected INTEGER;
BEGIN
    -- Only allow service_role to call this function
    IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Permission denied: only service_role can cleanup sessions';
    END IF;

    UPDATE workout_sessions
    SET status = 'abandoned', updated_at = now()
    WHERE status = 'in_progress'
      AND started_at < now() - INTERVAL '24 hours';

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

-- Revoke from public and authenticated, grant only to service_role
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_sessions() FROM public;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_sessions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_sessions() TO service_role;

-- ============================================================================
-- 3. FIX: Replace student FOR ALL policies with granular SELECT/INSERT/UPDATE
-- ============================================================================
-- Problem: FOR ALL includes DELETE. Students can permanently destroy their
-- workout history and set logs, which trainers depend on for tracking.
-- Fix: Drop FOR ALL, create separate SELECT + INSERT + UPDATE policies.

-- 3a. workout_sessions
DROP POLICY IF EXISTS workout_sessions_student_all ON workout_sessions;

CREATE POLICY workout_sessions_student_select ON workout_sessions
    FOR SELECT USING (student_id = current_student_id());

CREATE POLICY workout_sessions_student_insert ON workout_sessions
    FOR INSERT WITH CHECK (student_id = current_student_id());

CREATE POLICY workout_sessions_student_update ON workout_sessions
    FOR UPDATE USING (student_id = current_student_id());

-- 3b. set_logs
DROP POLICY IF EXISTS set_logs_student_all ON set_logs;

CREATE POLICY set_logs_student_select ON set_logs
    FOR SELECT USING (
        workout_session_id IN (
            SELECT id FROM workout_sessions WHERE student_id = current_student_id()
        )
    );

CREATE POLICY set_logs_student_insert ON set_logs
    FOR INSERT WITH CHECK (
        workout_session_id IN (
            SELECT id FROM workout_sessions WHERE student_id = current_student_id()
        )
    );

CREATE POLICY set_logs_student_update ON set_logs
    FOR UPDATE USING (
        workout_session_id IN (
            SELECT id FROM workout_sessions WHERE student_id = current_student_id()
        )
    );

-- ============================================================================
-- 4. FIX: Remove system exercise insert capability from trainers
-- ============================================================================
-- Problem: Any trainer can insert exercises with owner_id IS NULL, creating
-- "system" exercises visible to all users on the platform.
-- Fix: Only allow trainers to insert exercises they own (owner_id = their id).
-- System exercises should only be inserted via service_role (seeds/migrations).

DROP POLICY IF EXISTS exercises_owner_insert ON exercises;

CREATE POLICY exercises_owner_insert ON exercises
    FOR INSERT
    WITH CHECK (
        owner_id = current_trainer_id()
    );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
