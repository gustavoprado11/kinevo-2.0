-- ============================================================================
-- Kinevo — 076 Fix check_student_access() Authorization Logic
-- ============================================================================
-- Bug: Migration 075 introduced auth checks that return 'allowed: true'
-- in denial branches instead of 'allowed: false'. This makes the auth
-- check a no-op. Fix: return allowed=false with reason='unauthorized'.
-- ============================================================================

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

    -- Caller is a different student — deny
    IF v_caller_student_id IS NOT NULL AND v_caller_student_id != p_student_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
    END IF;

    -- Caller has no profile (neither student nor trainer) — deny
    IF v_caller_student_id IS NULL AND v_caller_trainer_id IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
    END IF;

    -- Caller is a trainer who does NOT own this student — deny
    IF v_caller_trainer_id IS NOT NULL AND v_caller_student_id IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM students
        WHERE id = p_student_id AND coach_id = v_caller_trainer_id
      ) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
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
    IF v_contract.billing_type IN ('manual_recurring', 'manual_one_off')
       AND v_contract.current_period_end IS NOT NULL
       AND v_contract.current_period_end < now()
    THEN
      IF v_contract.current_period_end >= now() - interval '3 days' THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'grace_period');
      END IF;
      IF v_contract.block_on_fail = true THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
      ELSE
        RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
      END IF;
    END IF;

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
