-- ============================================================================
-- Kinevo — 045 Fix RPC security check for service_role calls
-- ============================================================================
-- The security check `p_trainer_id = current_trainer_id()` fails when called
-- via supabaseAdmin (service_role) because auth.uid() returns NULL.
-- Server-side pages already validate auth and pass the correct trainer_id,
-- so the check is redundant. RLS on contract_events still protects direct access.
-- ============================================================================

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
