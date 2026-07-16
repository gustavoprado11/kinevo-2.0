-- ============================================================================
-- 259: Estúdios v1 — RPCs do mobile passam a enxergar alunos compartilhados
-- ============================================================================
-- O RLS org-aware (migr 252) já deixa o coach de estúdio LER/EDITAR os alunos
-- do estúdio via `.from()` direto (telas de detalhe/programas do app). Mas os
-- RPCs SECURITY DEFINER do mobile ainda filtram por `coach_id = current_trainer_id()`,
-- então a LISTA de alunos, o DETALHE, o GUARD de acesso e o HEATMAP ficavam
-- cegos aos alunos de colegas. Aqui esses 4 RPCs ganham o mesmo eixo de tenancy
-- do RLS: o próprio (coach_id) OU aluno de uma org da qual o ator é membro ativo.
--
-- Consistência: usa o MESMO primitivo do RLS (can_access_org_student / membership
-- ativa em organization_members), sem gate de billing — idêntico ao que as telas
-- de detalhe do mobile já fazem hoje via RLS. NÃO toca em financeiro
-- (get_financial_*), nem no dashboard agregado (get_trainer_stats): decisão de
-- produto (estúdio não tem módulo financeiro; agregados ficam coach-scoped).
--
-- Backward-compat: para treinador SOLO (sem linha em organization_members) o
-- ramo org é sempre falso → comportamento byte a byte como hoje. Os enriquecimentos
-- por sessão/programa deixam de filtrar por trainer_id e passam a escopar só por
-- student_id — para o aluno solo é idêntico (todo dado dele é do único coach), e
-- para o compartilhado passa a mostrar o que outro coach do estúdio prescreveu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) get_trainer_students_list() — lista enriquecida, agora org-aware
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_trainer_students_list()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_org_id UUID;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Org ativa do ator (no máx. 1 por treinador). Solo → NULL → ramo org falso.
    SELECT om.organization_id INTO v_org_id
    FROM organization_members om
    WHERE om.trainer_id = v_trainer_id
      AND om.status = 'active'
    LIMIT 1;

    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.name ASC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT s.id,
               s.name,
               s.email,
               s.phone,
               s.status,
               s.modality,
               s.avatar_url,
               s.created_at,
               s.is_trainer_profile,
               -- Active program info (qualquer coach do estúdio, não só o ator)
               ap.name AS program_name,
               ap.duration_weeks,
               ap.started_at AS program_started_at,
               -- Last session date
               (
                   SELECT max(ws.completed_at)
                   FROM workout_sessions ws
                   WHERE ws.student_id = s.id
                     AND ws.status = 'completed'
               ) AS last_session_date,
               -- Sessions this week
               (
                   SELECT count(*)
                   FROM workout_sessions ws
                   WHERE ws.student_id = s.id
                     AND ws.status = 'completed'
                     AND ws.completed_at >= v_week_start
                     AND ws.completed_at < v_week_end
               )::int AS sessions_this_week,
               -- Expected sessions per week (unique scheduled days)
               COALESCE((
                   SELECT count(DISTINCT d.day)::int
                   FROM assigned_workouts aw2
                   CROSS JOIN LATERAL unnest(aw2.scheduled_days) AS d(day)
                   WHERE aw2.assigned_program_id = ap.id
               ), 0) AS expected_per_week
        FROM students s
        LEFT JOIN LATERAL (
            SELECT ap2.id, ap2.name, ap2.duration_weeks, ap2.started_at
            FROM assigned_programs ap2
            WHERE ap2.student_id = s.id
              AND ap2.status = 'active'
            ORDER BY ap2.started_at DESC
            LIMIT 1
        ) ap ON TRUE
        WHERE (
                  s.coach_id = v_trainer_id
                  OR (v_org_id IS NOT NULL AND s.organization_id = v_org_id)
              )
          -- Perfil-treinador: mostra só o do PRÓPRIO ator (não o dos colegas).
          AND (s.is_trainer_profile IS NOT TRUE OR s.coach_id = v_trainer_id)
        ORDER BY s.name ASC
    ) sub;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2) get_student_profile_detail(p_student_id) — detalhe, agora org-aware
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_profile_detail(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_student JSONB;
    v_active_program JSONB;
    v_program_history JSONB;
    v_recent_sessions JSONB;
    v_form_submissions JSONB;
    v_prescription_profile JSONB;
    v_ai_enabled BOOLEAN;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_sessions_this_week INT;
    v_expected_per_week INT;
    v_total_sessions INT;
    v_last_session_date TIMESTAMPTZ;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Verify access: dono (coach_id) OU aluno de estúdio do qual o ator é membro.
    SELECT jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'email', s.email,
        'phone', s.phone,
        'status', s.status,
        'modality', s.modality,
        'avatar_url', s.avatar_url,
        'is_trainer_profile', s.is_trainer_profile,
        'created_at', s.created_at
    )
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id
      AND (s.coach_id = v_trainer_id OR public.can_access_org_student(p_student_id));

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student not found for current trainer';
    END IF;

    -- Week boundaries
    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';

    -- Sessions this week (do aluno, independente do coach que acompanhou)
    SELECT count(*) INTO v_sessions_this_week
    FROM workout_sessions ws
    WHERE ws.student_id = p_student_id
      AND ws.status = 'completed'
      AND ws.completed_at >= v_week_start
      AND ws.completed_at < v_week_end;

    -- Total sessions
    SELECT count(*), max(ws.completed_at)
    INTO v_total_sessions, v_last_session_date
    FROM workout_sessions ws
    WHERE ws.student_id = p_student_id
      AND ws.status = 'completed';

    -- Active program with workouts
    SELECT jsonb_build_object(
        'id', ap.id,
        'name', ap.name,
        'description', ap.description,
        'duration_weeks', ap.duration_weeks,
        'started_at', ap.started_at,
        'current_week', ap.current_week,
        'ai_generated', ap.ai_generated,
        'workouts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', aw.id,
                'name', aw.name,
                'order_index', aw.order_index,
                'scheduled_days', COALESCE(to_jsonb(aw.scheduled_days), '[]'::jsonb)
            ) ORDER BY aw.order_index)
            FROM assigned_workouts aw
            WHERE aw.assigned_program_id = ap.id
        ), '[]'::jsonb)
    )
    INTO v_active_program
    FROM assigned_programs ap
    WHERE ap.student_id = p_student_id
      AND ap.status = 'active'
    ORDER BY ap.started_at DESC
    LIMIT 1;

    -- Expected per week from active program
    IF v_active_program IS NOT NULL THEN
        SELECT COALESCE(count(DISTINCT d.day), 0)::int
        INTO v_expected_per_week
        FROM assigned_workouts aw
        CROSS JOIN LATERAL unnest(aw.scheduled_days) AS d(day)
        WHERE aw.assigned_program_id = (v_active_program ->> 'id')::uuid;
    ELSE
        v_expected_per_week := 0;
    END IF;

    -- Program history (completed/paused, last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_program_history
    FROM (
        SELECT ap.id, ap.name, ap.duration_weeks, ap.status,
               ap.started_at, ap.completed_at, ap.ai_generated
        FROM assigned_programs ap
        WHERE ap.student_id = p_student_id
          AND ap.status IN ('completed', 'paused')
        ORDER BY ap.completed_at DESC NULLS LAST
        LIMIT 10
    ) sub;

    -- Recent sessions (last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC), '[]'::jsonb)
    INTO v_recent_sessions
    FROM (
        SELECT ws.id, aw.name AS workout_name,
               ws.completed_at, ws.duration_seconds, ws.rpe, ws.feedback
        FROM workout_sessions ws
        LEFT JOIN assigned_workouts aw ON aw.id = ws.assigned_workout_id
        WHERE ws.student_id = p_student_id
          AND ws.status = 'completed'
        ORDER BY ws.completed_at DESC
        LIMIT 10
    ) sub;

    -- Form submissions (last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.submitted_at DESC), '[]'::jsonb)
    INTO v_form_submissions
    FROM (
        SELECT fs.id, ft.title AS template_title, ft.category,
               fs.status, fs.submitted_at, fs.feedback_sent_at
        FROM form_submissions fs
        JOIN form_templates ft ON ft.id = fs.form_template_id
        WHERE fs.student_id = p_student_id
          AND fs.status IN ('submitted', 'reviewed')
        ORDER BY fs.submitted_at DESC
        LIMIT 10
    ) sub;

    -- Prescription profile (do aluno, independente do coach)
    SELECT jsonb_build_object(
        'id', spp.id,
        'training_level', spp.training_level,
        'goal', spp.goal,
        'available_days', spp.available_days,
        'session_duration_minutes', spp.session_duration_minutes,
        'available_equipment', spp.available_equipment,
        'medical_restrictions', spp.medical_restrictions,
        'ai_mode', spp.ai_mode,
        'updated_at', spp.updated_at
    )
    INTO v_prescription_profile
    FROM student_prescription_profiles spp
    WHERE spp.student_id = p_student_id;

    -- AI enabled flag — capacidade de IA do ATOR que está visualizando.
    SELECT t.ai_prescriptions_enabled INTO v_ai_enabled
    FROM trainers t WHERE t.id = v_trainer_id;

    RETURN jsonb_build_object(
        'student', v_student,
        'activeProgram', v_active_program,
        'programHistory', v_program_history,
        'recentSessions', v_recent_sessions,
        'formSubmissions', v_form_submissions,
        'prescriptionProfile', v_prescription_profile,
        'aiEnabled', COALESCE(v_ai_enabled, false),
        'sessionsThisWeek', v_sessions_this_week,
        'expectedPerWeek', v_expected_per_week,
        'totalSessions', v_total_sessions,
        'lastSessionDate', v_last_session_date
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) check_student_access(p_student_id) — guard: autorização agora org-aware
--    (só o predicado de AUTORIZAÇÃO muda; toda a lógica de billing é idêntica)
-- ----------------------------------------------------------------------------
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
  -- Authorization: caller must be the student, their trainer, OR a member of
  -- the student's studio. Skip check for service_role (cron jobs, webhooks).
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
      ) AND NOT public.can_access_org_student(p_student_id) THEN
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

  -- 7. Past due: bloqueia só DEPOIS da carência do treinador.
  IF v_contract.status = 'past_due' THEN
    IF COALESCE(v_block_on_overdue, v_contract.block_on_fail, true) = false THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'past_due_allowed');
    END IF;

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

-- ----------------------------------------------------------------------------
-- 4) get_student_sessions_heatmap(...) — gate de posse agora org-aware
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_student_sessions_heatmap(
    p_student_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_owner UUID;
    v_result JSONB;
BEGIN
    -- Validate access: dono (coach_id) OU membro do estúdio do aluno.
    SELECT coach_id INTO v_owner
    FROM students
    WHERE id = p_student_id;

    IF v_owner IS NULL THEN
        RETURN '[]'::jsonb;  -- aluno inexistente
    END IF;

    IF v_owner != current_trainer_id() AND NOT public.can_access_org_student(p_student_id) THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(day_data ORDER BY day_data->>'date'), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'date', d.session_date::text,
            'count', COUNT(*)::int,
            'sessions', jsonb_agg(
                jsonb_build_object(
                    'id', ws.id,
                    'workout_name', COALESCE(aw.name, 'Treino'),
                    'duration_seconds', ws.duration_seconds,
                    'completed_at', ws.completed_at
                )
                ORDER BY ws.completed_at
            )
        ) AS day_data
        FROM (
            SELECT
                ws.id,
                ws.assigned_workout_id,
                ws.duration_seconds,
                ws.completed_at,
                (ws.completed_at AT TIME ZONE 'America/Sao_Paulo')::date AS session_date
            FROM workout_sessions ws
            WHERE ws.student_id = p_student_id
              AND ws.status = 'completed'
              AND ws.completed_at IS NOT NULL
              AND (ws.completed_at AT TIME ZONE 'America/Sao_Paulo')::date
                  BETWEEN p_start_date AND p_end_date
        ) d
        JOIN workout_sessions ws ON ws.id = d.id
        LEFT JOIN assigned_workouts aw ON aw.id = d.assigned_workout_id
        GROUP BY d.session_date
    ) grouped;

    RETURN v_result;
END;
$$;

-- Grants preservados (idempotente).
GRANT EXECUTE ON FUNCTION public.get_trainer_students_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_profile_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_student_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_sessions_heatmap(uuid, date, date) TO authenticated;
