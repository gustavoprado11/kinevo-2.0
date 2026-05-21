-- ============================================================================
-- Kinevo — 150 get_financial_dashboard: receita inclui pagamentos Asaas
-- ============================================================================
-- A RPC só somava status='succeeded' (Stripe legado). Pagamentos Asaas entram
-- como status='completed' (webhook + sync), então a "Receita do mês" no mobile
-- aparecia zerada mesmo com PIX recebido. O web já soma as duas (page.tsx).
-- Fix: monthlyRevenue soma status IN ('succeeded','completed').
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_financial_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer_id UUID;
  v_monthly_revenue NUMERIC;
  v_recent_transactions JSONB;
BEGIN
  v_trainer_id := current_trainer_id();

  -- Monthly revenue: soma dos recebimentos do mês (Stripe 'succeeded' + Asaas 'completed')
  SELECT COALESCE(SUM(ft.amount_gross), 0)
  INTO v_monthly_revenue
  FROM financial_transactions ft
  WHERE ft.coach_id = v_trainer_id
    AND ft.status IN ('succeeded', 'completed')
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
$function$;
