-- ============================================================================
-- 105_fix_trainer_stats_adherence_formula.sql
-- ============================================================================
-- Corrige a fórmula de `adherencePercent` em `get_trainer_stats()`.
--
-- ANTES (migration 049):
--   adherencePercent = (alunos que treinaram nos últimos 5 dias / alunos com programa ativo) * 100
--   Problema: qualquer aluno que completou UMA sessão nos últimos 5 dias contava como
--   "on track", o que fazia a métrica bater em 100% trivialmente mesmo quando a aderência
--   real ao plano era baixa (ex: 2 sessões completadas numa semana em que eram esperadas 33).
--
-- DEPOIS (esta migration):
--   adherencePercent = min(100, round(sessionsThisWeek / expectedSessionsThisWeek * 100))
--   Fallback: se expectedSessionsThisWeek = 0 OU não há programa ativo, retorna 0 e
--   `hasActivePrograms` segue false (UI exibe "sem programas" via subtitle).
--
-- Rationale: o card "Treinos X/Y" na dashboard já expõe esses dois números —
-- a aderência agora é simplesmente a razão explícita deles, tornando a métrica
-- honesta e coerente com o que o trainer vê ao lado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_trainer_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    v_total_with_program INT;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Week boundaries (Monday-based, America/Sao_Paulo)
    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';

    -- Active students count (exclude trainer's own profile)
    SELECT count(*) INTO v_active_students_count
    FROM students
    WHERE coach_id = v_trainer_id
      AND status = 'active'
      AND is_trainer_profile IS NOT TRUE;

    -- Sessions completed this week
    SELECT count(*) INTO v_sessions_this_week
    FROM workout_sessions
    WHERE trainer_id = v_trainer_id
      AND status = 'completed'
      AND completed_at >= v_week_start
      AND completed_at < v_week_end;

    -- Expected sessions per week: sum of unique scheduled days across active programs
    SELECT COALESCE(sum(day_count), 0)::int INTO v_expected_sessions_this_week
    FROM (
        SELECT ap.id AS program_id,
               count(DISTINCT d.day) AS day_count
        FROM assigned_programs ap
        JOIN assigned_workouts aw ON aw.assigned_program_id = ap.id
        CROSS JOIN LATERAL unnest(aw.scheduled_days) AS d(day)
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
        GROUP BY ap.id
    ) sub;

    -- MRR from active contracts
    SELECT COALESCE(sum(amount), 0) INTO v_mrr
    FROM student_contracts
    WHERE trainer_id = v_trainer_id
      AND status = 'active';

    -- Active students with an active program (used for hasActivePrograms flag).
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

    -- Adherence: razão entre sessões completadas e esperadas nesta semana, capada a 100%.
    -- Fallback a 0 quando não há programa ativo ou expected é 0 (UI mostra "sem programas").
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
$$;

-- Grant permanece idêntico (já concedido em 049) — re-grant é seguro.
GRANT EXECUTE ON FUNCTION public.get_trainer_stats() TO authenticated;

-- ============================================================================
-- Smoke test inline
-- ============================================================================
DO $$
DECLARE
    v_stats JSONB;
BEGIN
    BEGIN
        v_stats := public.get_trainer_stats();
        IF NOT (
            v_stats ? 'activeStudentsCount' AND
            v_stats ? 'sessionsThisWeek' AND
            v_stats ? 'expectedSessionsThisWeek' AND
            v_stats ? 'mrr' AND
            v_stats ? 'adherencePercent' AND
            v_stats ? 'hasActivePrograms'
        ) THEN
            RAISE EXCEPTION 'get_trainer_stats() missing expected keys. Got: %', v_stats;
        END IF;
        IF (v_stats->>'adherencePercent')::int < 0 OR (v_stats->>'adherencePercent')::int > 100 THEN
            RAISE EXCEPTION 'adherencePercent fora de [0,100]: %', v_stats->>'adherencePercent';
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_stats() returned valid structure';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_stats() correctly rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;
END $$;
