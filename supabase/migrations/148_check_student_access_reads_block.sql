-- ============================================================================
-- Kinevo — 148 check_student_access() passa a respeitar access_blocked_at
-- ============================================================================
-- BUG (end-to-end quebrado): a migration 140 criou block_overdue_students()
-- (cron `block-overdue-students-daily`, ativo em prod) que seta
-- students.access_blocked_at respeitando trainer_financial_settings
-- (block_on_overdue + overdue_grace_days). O webhook PAYMENT_RECEIVED da Asaas
-- chama unblock_student_access() pra limpar. A API /api/students/[id]/access
-- seta/limpa manualmente.
--
-- PORÉM: check_student_access() — a função que o app (web + mobile) consulta
-- pra liberar/bloquear treino — NUNCA leu access_blocked_at. Ela só bloqueava
-- por status de contrato + block_on_fail (caminho Stripe legado). Resultado:
-- todo o sistema de bloqueio por access_blocked_at (cron + manual) era código
-- morto — aluno marcado como bloqueado continuava recebendo allowed:true.
--
-- FIX (cirúrgico, retrocompatível): adicionar UMA checagem logo após validar
-- o status do aluno. Se access_blocked_at IS NOT NULL → nega com reason
-- 'past_due_blocked' (reason que o PaymentBlockedScreen do mobile já trata).
-- Nenhuma outra branch é alterada. block_overdue_students() continua sendo a
-- fonte autoritativa que respeita as settings do trainer.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_student_access(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 1. Get student (agora incluindo access_blocked_at)
  SELECT id, status, access_blocked_at INTO v_student
  FROM students WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'student_not_found');
  END IF;

  -- 2. Student blocked/archived/inactive by trainer
  IF v_student.status IN ('blocked', 'archived', 'inactive') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'student_inactive');
  END IF;

  -- 2b. Bloqueio por inadimplência via access_blocked_at.
  --     Fonte autoritativa: block_overdue_students() (cron diário) que respeita
  --     trainer_financial_settings (block_on_overdue + overdue_grace_days), e o
  --     bloqueio manual via /api/students/[id]/access. Desbloqueio vem do
  --     webhook PAYMENT_RECEIVED (unblock_student_access). Vale Stripe e Asaas.
  IF v_student.access_blocked_at IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
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
$function$;

COMMENT ON FUNCTION public.check_student_access(uuid) IS
    'Gate de acesso do aluno. Respeita: status do aluno, access_blocked_at '
    '(inadimplência via cron/manual) e status do contrato (block_on_fail). '
    'Reasons de bloqueio: unauthorized, student_inactive, past_due_blocked.';
