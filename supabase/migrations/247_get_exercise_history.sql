-- Histórico de execução de um exercício (últimas N sessões concluídas).
--
-- Alimenta o sheet "Histórico do exercício" da Sala de Treino e da tela de
-- execução do aluno. Até aqui as duas telas só sabiam da ÚLTIMA sessão
-- (get_previous_exercise_sets, que este RPC generaliza).
--
-- Chave do histórico = exercício EXECUTADO (coalesce(executed_exercise_id,
-- exercise_id)), não o item do treino: trocar o programa ou substituir o
-- exercício na hora não zera o histórico. Mesma regra do RPC de uma sessão.
--
-- SECURITY INVOKER (default): a RLS decide quem vê o quê — o aluno enxerga as
-- próprias sessões (workout_sessions.student_id) e o treinador as dos seus
-- alunos (workout_sessions.trainer_id). Nenhum papel novo, nenhum bypass.

CREATE OR REPLACE FUNCTION public.get_exercise_history(
    p_student_id uuid,
    p_exercise_id uuid,
    p_limit integer DEFAULT 5
)
RETURNS TABLE(
    session_id uuid,
    completed_at timestamptz,
    workout_name text,
    set_number integer,
    weight numeric,
    reps integer
)
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
    WITH sessions AS (
        SELECT ws.id, ws.completed_at, aw.name AS workout_name
        FROM workout_sessions ws
        JOIN set_logs sl
            ON sl.workout_session_id = ws.id
        LEFT JOIN assigned_workouts aw
            ON aw.id = ws.assigned_workout_id
        WHERE ws.student_id = p_student_id
          AND ws.status = 'completed'
          AND sl.is_completed = true
          AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
        GROUP BY ws.id, ws.completed_at, aw.name
        ORDER BY ws.completed_at DESC NULLS LAST
        -- Teto de 20: a tela pede 5; o limite existe pra um cliente novo não
        -- conseguir puxar o histórico inteiro numa chamada.
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20))
    )
    SELECT
        s.id AS session_id,
        s.completed_at,
        s.workout_name,
        sl.set_number,
        sl.weight,
        sl.reps_completed AS reps
    FROM sessions s
    JOIN set_logs sl
        ON sl.workout_session_id = s.id
    WHERE sl.is_completed = true
      AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
    ORDER BY s.completed_at DESC NULLS LAST, sl.set_number;
$function$;

GRANT EXECUTE ON FUNCTION public.get_exercise_history(uuid, uuid, integer) TO authenticated;
