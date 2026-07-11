-- Unifica a definição de "expected sessions" da semana: SOMA DE OCORRÊNCIAS
-- de treino agendado (2 treinos no mesmo dia = 2), em vez de dias únicos.
--
-- Motivo: 'done' conta SESSÕES concluídas, então 'expected' deve contar
-- sessões esperadas — é a semântica que a página do aluno, o ranking do
-- dashboard e o painel de contexto do assistente (computeWeeklyAdherence)
-- já usam. Só o stat agregado do dashboard (web get-dashboard-data + este
-- RPC, consumido pelo mobile) deduplicava dias. Decisão do Gustavo 10/jul/2026.
--
-- Única mudança vs migração 168: count(DISTINCT d.day) → count(d.day).
CREATE OR REPLACE FUNCTION public.get_trainer_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID;
    v_active_students_count INT;
    v_sessions_this_week INT;
    v_expected_sessions_this_week INT;
    v_mrr NUMERIC;
    v_adherence_percent INT;
    v_has_active_programs BOOLEAN;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
    v_total_with_program INT;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';
    v_month_start := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;

    SELECT count(*) INTO v_active_students_count
    FROM students
    WHERE coach_id = v_trainer_id
      AND status = 'active'
      AND is_trainer_profile IS NOT TRUE;

    SELECT count(*) INTO v_sessions_this_week
    FROM workout_sessions
    WHERE trainer_id = v_trainer_id
      AND status = 'completed'
      AND completed_at >= v_week_start
      AND completed_at < v_week_end;

    -- Soma de OCORRÊNCIAS agendadas (não deduplica dias entre treinos).
    SELECT COALESCE(sum(day_count), 0)::int INTO v_expected_sessions_this_week
    FROM (
        SELECT ap.id AS program_id,
               count(d.day) AS day_count
        FROM assigned_programs ap
        JOIN assigned_workouts aw ON aw.assigned_program_id = ap.id
        CROSS JOIN LATERAL unnest(aw.scheduled_days) AS d(day)
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
        GROUP BY ap.id
    ) sub;

    SELECT COALESCE(sum(amount_gross), 0) INTO v_mrr
    FROM financial_transactions
    WHERE coach_id = v_trainer_id
      AND status IN ('succeeded', 'completed')
      AND created_at >= v_month_start;

    SELECT count(*) INTO v_total_with_program
    FROM (
        SELECT DISTINCT ap.student_id
        FROM assigned_programs ap
        JOIN students s ON s.id = ap.student_id
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
    ) sub;

    v_has_active_programs := v_total_with_program > 0;

    v_adherence_percent := CASE
        WHEN v_expected_sessions_this_week > 0 AND v_has_active_programs
            THEN LEAST(100, round((v_sessions_this_week::numeric / v_expected_sessions_this_week) * 100)::int)
        ELSE 0
    END;

    RETURN jsonb_build_object(
        'activeStudentsCount', v_active_students_count,
        'sessionsThisWeek', v_sessions_this_week,
        'expectedSessionsThisWeek', v_expected_sessions_this_week,
        'mrr', v_mrr,
        'adherencePercent', v_adherence_percent,
        'hasActivePrograms', v_has_active_programs
    );
END;
$function$;
