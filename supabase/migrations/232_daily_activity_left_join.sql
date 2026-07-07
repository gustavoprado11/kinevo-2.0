-- ============================================================================
-- 232: get_trainer_daily_activity com LEFT JOIN + snapshot (R13, rodada 2)
-- ============================================================================
-- Auditoria rodada 2 (docs/analise-builder-rodada2-2026-07-06.md), achado R13.
--
-- PROBLEMA
-- --------
-- Desde a 227, deletar um treino da prescrição preserva as sessões executadas
-- com assigned_workout_id = NULL (SET NULL + snapshot workout_name). O feed
-- diário do dashboard mobile do treinador (RPC desta função, definida na 049)
-- usava INNER JOIN em assigned_workouts → a sessão que o aluno completou HOJE
-- some do feed se o treinador editar o programa removendo aquele treino — o
-- exato dado que a 227 quis preservar. (Os 2 feeds equivalentes do web tinham
-- o mesmo bug via embed !inner; corrigidos no client.)
--
-- FIX
-- ---
-- LEFT JOIN + COALESCE(aw.name, ws.workout_name, 'Treino'). Única mudança vs
-- a definição da 049.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_trainer_daily_activity()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_today_start TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    v_today_start := (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT ws.id,
               s.name AS student_name,
               s.id AS student_id,
               -- FIX (232): treino deletado da prescrição → snapshot da 227
               COALESCE(aw.name, ws.workout_name, 'Treino') AS workout_name,
               ws.completed_at,
               ws.duration_seconds,
               ws.rpe,
               ws.feedback
        FROM workout_sessions ws
        JOIN students s ON s.id = ws.student_id
        LEFT JOIN assigned_workouts aw ON aw.id = ws.assigned_workout_id
        WHERE ws.trainer_id = v_trainer_id
          AND ws.status = 'completed'
          AND ws.completed_at >= v_today_start
        ORDER BY ws.completed_at DESC
    ) sub;

    RETURN v_result;
END;
$$;
