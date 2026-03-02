-- ============================================================================
-- Kinevo — 043 Financial v2 Functions
-- ============================================================================
-- Creates the trigger for student registration events, the main RPC for
-- student-centered financial listing, and updates check_student_access
-- with a 3-day grace period buffer for manual contracts.
-- Part of the financial module v2 redesign.
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER: Auto-create 'student_registered' event on student INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_student_registered_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip trainer self-profiles (they are not real students)
  IF NEW.is_trainer_profile = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO contract_events (student_id, trainer_id, event_type, metadata)
  VALUES (NEW.id, NEW.coach_id, 'student_registered', '{}');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent trigger creation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_student_registered') THEN
    CREATE TRIGGER on_student_registered
      AFTER INSERT ON students
      FOR EACH ROW EXECUTE FUNCTION register_student_registered_event();
  END IF;
END;
$$;

-- ============================================================================
-- 2. RPC: Student-centered financial listing
-- ============================================================================
-- Returns one row per student with their most relevant contract and a
-- derived display_status. Security: only the authenticated trainer can
-- query their own students (p_trainer_id must match current_trainer_id()).

CREATE OR REPLACE FUNCTION public.get_financial_students(p_trainer_id UUID)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  contract_id UUID,
  billing_type TEXT,
  contract_status TEXT,
  amount NUMERIC,
  current_period_end TIMESTAMPTZ,
  block_on_fail BOOLEAN,
  cancel_at_period_end BOOLEAN,
  canceled_by TEXT,
  canceled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  plan_title TEXT,
  plan_interval TEXT,
  display_status TEXT
) AS $$
SELECT
  s.id,
  s.name,
  s.avatar_url,
  s.phone,
  sc.id,
  sc.billing_type::TEXT,
  sc.status,
  sc.amount,
  sc.current_period_end,
  sc.block_on_fail,
  sc.cancel_at_period_end,
  sc.canceled_by,
  sc.canceled_at,
  sc.stripe_subscription_id,
  tp.title,
  tp.interval,
  -- Derived display status
  CASE
    WHEN sc.id IS NULL THEN 'courtesy'
    WHEN sc.billing_type = 'courtesy' THEN 'courtesy'
    WHEN sc.status = 'canceled' THEN 'canceled'
    WHEN sc.status = 'pending' THEN 'awaiting_payment'
    WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled' THEN 'canceling'
    WHEN sc.status = 'past_due' THEN 'overdue'
    WHEN sc.status = 'active'
      AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end IS NOT NULL
      AND sc.current_period_end < now()
      AND sc.current_period_end >= now() - interval '3 days'
      THEN 'grace_period'
    WHEN sc.status = 'active'
      AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end IS NOT NULL
      AND sc.current_period_end < now() - interval '3 days'
      THEN 'overdue'
    WHEN sc.status = 'active' THEN 'active'
    ELSE 'courtesy'
  END
FROM students s
-- Get the most relevant contract per student (active > past_due > pending > canceled)
LEFT JOIN LATERAL (
  SELECT * FROM student_contracts sc2
  WHERE sc2.student_id = s.id
    AND sc2.trainer_id = p_trainer_id
  ORDER BY
    CASE sc2.status
      WHEN 'active' THEN 0
      WHEN 'past_due' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'canceled' THEN 3
      ELSE 4
    END,
    sc2.created_at DESC
  LIMIT 1
) sc ON true
LEFT JOIN trainer_plans tp ON tp.id = sc.plan_id
WHERE s.coach_id = p_trainer_id
  AND p_trainer_id = (SELECT public.current_trainer_id())  -- SECURITY: only own data
  AND s.status = 'active'
  AND COALESCE(s.is_trainer_profile, false) = false
ORDER BY
  -- Priority: urgent items first
  CASE
    WHEN sc.status = 'past_due' THEN 0
    WHEN sc.status = 'active'
      AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off')
      AND sc.current_period_end IS NOT NULL
      AND sc.current_period_end < now() - interval '3 days'
      THEN 1
    WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled' THEN 2
    WHEN sc.status = 'active'
      AND sc.current_period_end IS NOT NULL
      AND sc.current_period_end < now()
      THEN 3
    WHEN sc.status = 'pending' THEN 4
    WHEN sc.status = 'active' THEN 5
    WHEN sc.status = 'canceled' THEN 6
    ELSE 7
  END,
  s.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_financial_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_students(UUID) TO service_role;

-- ============================================================================
-- 3. UPDATE: check_student_access with 3-day grace period
-- ============================================================================
-- Changes from v1:
--   - Returns 'courtesy' instead of 'no_contract' when no contract exists
--   - Adds 3-day grace period for manual contracts past due date
--   - Manual overdue with block_on_fail checks grace buffer first

CREATE OR REPLACE FUNCTION public.check_student_access(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_contract RECORD;
BEGIN
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
