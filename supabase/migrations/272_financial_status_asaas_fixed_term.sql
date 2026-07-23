-- ============================================================================
-- Kinevo — 272 get_financial_students: janela de graça/vencido p/ Asaas prazo-fixo
-- ============================================================================
-- Contexto: contratos `asaas_auto` (link Asaas pago uma vez, à vista ou
-- parcelado = plano de PRAZO FIXO) passaram a ganhar `current_period_end` na
-- confirmação do pagamento (webhook). Antes eles ficavam sem vigência e nunca
-- entravam na lógica de expiração — o "acesso invisível" que levou a vigência
-- da Fernanda a ser corrigida no dedo (e a sair errada).
--
-- Esta migration alinha o RPC ao cálculo TS (computeDisplayStatus): `asaas_auto`
-- ativo com vigência vencida vira 'grace_period' (<=3d) ou 'overdue' (>3d),
-- igual aos manuais. Assim a lista do Financeiro para de divergir do card do
-- aluno. `asaas_auto_recurring` (assinatura recorrente) segue tratado pelo
-- webhook e pelo status normal — não entra aqui.
--
-- Assinatura do RETURNS TABLE inalterada → CREATE OR REPLACE (preserva grants).
-- Base: migration 179. Únicas mudanças: 'asaas_auto' nos três IN-lists.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_financial_students(p_trainer_id uuid)
 RETURNS TABLE(student_id uuid, student_name text, avatar_url text, phone text, contract_id uuid, billing_type text, contract_status text, amount numeric, current_period_end timestamp with time zone, block_on_fail boolean, cancel_at_period_end boolean, canceled_by text, canceled_at timestamp with time zone, stripe_subscription_id text, plan_title text, plan_interval text, display_status text, access_blocked_at timestamp with time zone, access_blocked_reason text, installment_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE
      WHEN sc.id IS NULL THEN 'courtesy'
      WHEN sc.billing_type = 'courtesy' THEN 'courtesy'
      WHEN sc.status = 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 'expired'
      WHEN sc.status = 'canceled' THEN 'canceled'
      WHEN sc.status = 'pending' THEN 'awaiting_payment'
      WHEN sc.status = 'pending_payment' THEN 'awaiting_payment'
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 'expired'
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled' THEN 'canceling'
      WHEN sc.status = 'past_due' THEN 'overdue'
      WHEN sc.status = 'active'
        AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off', 'asaas_auto')
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        AND sc.current_period_end >= now() - interval '3 days'
        THEN 'grace_period'
      WHEN sc.status = 'active'
        AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off', 'asaas_auto')
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now() - interval '3 days'
        THEN 'overdue'
      WHEN sc.status = 'active' THEN 'active'
      ELSE 'courtesy'
    END,
    s.access_blocked_at,
    s.access_blocked_reason,
    sc.installment_count
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
        WHEN 'pending_payment' THEN 2
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
      WHEN s.access_blocked_at IS NOT NULL THEN 0
      WHEN sc.status = 'past_due' THEN 1
      WHEN sc.status = 'active'
        AND sc.billing_type::TEXT IN ('manual_recurring', 'manual_one_off', 'asaas_auto')
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now() - interval '3 days'
        THEN 2
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND (sc.current_period_end IS NULL OR sc.current_period_end >= now())
        THEN 3
      WHEN sc.status = 'active'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 4
      WHEN sc.status = 'pending' THEN 5
      WHEN sc.status = 'pending_payment' THEN 5
      WHEN sc.status = 'active' THEN 6
      WHEN sc.cancel_at_period_end = true AND sc.status != 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 7
      WHEN sc.status = 'canceled'
        AND sc.current_period_end IS NOT NULL
        AND sc.current_period_end < now()
        THEN 7
      WHEN sc.status = 'canceled' THEN 8
      ELSE 9
    END,
    s.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_financial_students(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_financial_students(uuid) TO authenticated, service_role;
