-- FIN3/P11 (auditoria 11/jul): check_student_access bloqueava aluno past_due
-- NA HORA do vencimento (passo 7: block_on_fail do contrato, cujo default é
-- TRUE — a migração 029 que tentava FALSE virou no-op), ignorando a carência
-- overdue_grace_days do treinador. Como o trilho de cobrança dos treinadores é
-- ASAAS (webhook PAYMENT_OVERDUE marca past_due no vencimento exato), um cartão
-- em retentativa bloqueava aluno pagante no dia 0.
--
-- Unificação com o cron block_overdue_students (o autoritativo, que seta
-- access_blocked_at respeitando block_on_overdue + overdue_grace_days do
-- treinador — o gate já honra isso no passo 2b):
--   • passo 7 (past_due): respeita a carência do treinador (fallback 3d) e o
--     flag trainer-level block_on_overdue (fallback: block_on_fail do contrato).
--     Sem current_period_end não há como medir carência → mantém acesso e deixa
--     o bloqueio para o cron/manual (mesmo critério do cron).
--   • passo 6 (manual active com período vencido): a carência deixa de ser
--     hardcoded 3d e passa a usar a mesma configuração (P11a).
-- Impacto imediato: zero (0 contratos past_due e 0 alunos bloqueados em prod
-- em 11/jul/2026) — muda o comportamento FUTURO para respeitar a carência.
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
  v_block_on_overdue BOOLEAN;
  v_grace_days INTEGER;
BEGIN
  -- Authorization: caller must be the student or their trainer
  -- Skip check for service_role (used by cron jobs, webhooks)
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    v_caller_student_id := public.current_student_id();
    v_caller_trainer_id := public.current_trainer_id();

    IF v_caller_student_id IS NOT NULL AND v_caller_student_id != p_student_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
    END IF;

    IF v_caller_student_id IS NULL AND v_caller_trainer_id IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
    END IF;

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

  -- 2b. Bloqueio por inadimplência via access_blocked_at (cron + manual).
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

  -- Configuração do TREINADOR (carência + opt-in de bloqueio), unificada com o
  -- cron block_overdue_students. Sem linha de settings: carência default 3d e
  -- o flag cai no block_on_fail do contrato (legado).
  SELECT tfs.block_on_overdue, tfs.overdue_grace_days
    INTO v_block_on_overdue, v_grace_days
  FROM trainer_financial_settings tfs
  WHERE tfs.trainer_id = v_contract.trainer_id;

  -- 6. Active contract
  IF v_contract.status = 'active' THEN
    IF v_contract.billing_type IN ('manual_recurring', 'manual_one_off')
       AND v_contract.current_period_end IS NOT NULL
       AND v_contract.current_period_end < now()
    THEN
      -- Carência configurável do treinador (era hardcoded 3d — P11a).
      IF v_contract.current_period_end >= now() - (COALESCE(v_grace_days, 3) || ' days')::interval THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'grace_period');
      END IF;
      IF COALESCE(v_block_on_overdue, v_contract.block_on_fail, true) = true THEN
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

  -- 7. Past due: bloqueia só DEPOIS da carência do treinador (antes bloqueava
  -- na hora). O bloqueio autoritativo é o access_blocked_at do cron (passo 2b);
  -- aqui é o backstop imediato pós-carência.
  IF v_contract.status = 'past_due' THEN
    IF COALESCE(v_block_on_overdue, v_contract.block_on_fail, true) = false THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
    END IF;

    -- Sem current_period_end não há como medir carência — mantém acesso e
    -- deixa o bloqueio para o cron/manual (mesmo critério do cron, que exige
    -- current_period_end IS NOT NULL).
    IF v_contract.current_period_end IS NULL THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
    END IF;

    IF v_contract.current_period_end >= now() - (COALESCE(v_grace_days, 3) || ' days')::interval THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'grace_period');
    END IF;

    RETURN jsonb_build_object('allowed', false, 'reason', 'past_due_blocked');
  END IF;

  -- 8. Default: allow (safety net)
  RETURN jsonb_build_object('allowed', true, 'reason', 'default');
END;
$function$;
