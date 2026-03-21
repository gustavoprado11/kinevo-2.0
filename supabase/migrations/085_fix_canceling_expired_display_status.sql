-- 085 Fix 'canceling' display_status when period has already ended
--
-- When cancel_at_period_end = true AND current_period_end < now(),
-- the contract should show 'expired', not 'canceling'.
-- This aligns the SQL RPC with the TypeScript computeDisplayStatus() fix.

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
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_trainer_id IS DISTINCT FROM (SELECT public.current_trainer_id())
  THEN
    RETURN;
  END IF;

  RETURN QUERY
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
      -- Canceled: distinguish expired (period ended) from canceled (deliberate)
      WHEN sc.status = 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 'expired'
      WHEN sc.status = 'canceled' THEN 'canceled'
      WHEN sc.status = 'pending' THEN 'awaiting_payment'
      -- Canceling: if period already ended, show as expired instead
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 'expired'
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
    AND s.status = 'active'
    AND COALESCE(s.is_trainer_profile, false) = false
  ORDER BY
    CASE
      WHEN sc.status = 'past_due' THEN 0
      WHEN sc.status = 'active'
        AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off')
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now() - interval '3 days'
        THEN 1
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND (sc.current_period_end IS NULL OR sc.current_period_end >= now())
        THEN 2
      WHEN sc.status = 'active'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 3
      WHEN sc.status = 'pending' THEN 4
      WHEN sc.status = 'active' THEN 5
      -- Expired (canceled + period ended OR canceling + period ended)
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 6
      WHEN sc.status = 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 6
      WHEN sc.status = 'canceled' THEN 7
      ELSE 8
    END,
    s.name;
END;
$$;
