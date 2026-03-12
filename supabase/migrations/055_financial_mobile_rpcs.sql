-- ============================================================================
-- Kinevo — 055 Financial Mobile RPCs
-- ============================================================================
-- Two new RPCs for the mobile financial module:
--   1. get_financial_dashboard() — monthly revenue + recent transactions
--   2. get_contract_events(p_contract_id) — timeline events for a contract
-- ============================================================================

-- ============================================================================
-- 1. RPC: Financial Dashboard
-- ============================================================================
-- Returns monthly revenue and the 10 most recent transactions for the
-- authenticated trainer. Uses current_trainer_id() for security.

CREATE OR REPLACE FUNCTION public.get_financial_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id UUID;
  v_monthly_revenue NUMERIC;
  v_recent_transactions JSONB;
BEGIN
  v_trainer_id := current_trainer_id();

  -- Monthly revenue: sum of succeeded transactions this month
  SELECT COALESCE(SUM(ft.amount_gross), 0)
  INTO v_monthly_revenue
  FROM financial_transactions ft
  WHERE ft.coach_id = v_trainer_id
    AND ft.status = 'succeeded'
    AND ft.created_at >= date_trunc('month', now());

  -- Recent transactions: last 10 with student name
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_recent_transactions
  FROM (
    SELECT
      ft.id,
      ft.student_id,
      s.name AS student_name,
      ft.amount_gross,
      ft.amount_net,
      ft.currency,
      ft.type,
      ft.status,
      ft.description,
      ft.created_at
    FROM financial_transactions ft
    LEFT JOIN students s ON s.id = ft.student_id
    WHERE ft.coach_id = v_trainer_id
    ORDER BY ft.created_at DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'monthlyRevenue', v_monthly_revenue,
    'recentTransactions', v_recent_transactions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard() TO service_role;

-- ============================================================================
-- 2. RPC: Contract Events (Timeline)
-- ============================================================================
-- Returns up to 50 events for a given contract. Validates that the contract
-- belongs to the authenticated trainer.

CREATE OR REPLACE FUNCTION public.get_contract_events(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id UUID;
  v_contract_exists BOOLEAN;
  v_events JSONB;
BEGIN
  v_trainer_id := current_trainer_id();

  -- Validate ownership
  SELECT EXISTS(
    SELECT 1 FROM student_contracts
    WHERE id = p_contract_id
      AND trainer_id = v_trainer_id
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'contract_not_found', 'events', '[]'::jsonb);
  END IF;

  -- Fetch events
  SELECT COALESCE(jsonb_agg(e ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      ce.id,
      ce.student_id,
      ce.trainer_id,
      ce.contract_id,
      ce.event_type,
      ce.metadata,
      ce.created_at
    FROM contract_events ce
    WHERE ce.contract_id = p_contract_id
    ORDER BY ce.created_at DESC
    LIMIT 50
  ) e;

  RETURN jsonb_build_object('events', v_events);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_events(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_events(UUID) TO service_role;
