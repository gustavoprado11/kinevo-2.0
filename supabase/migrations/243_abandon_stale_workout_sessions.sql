-- T1 (auditoria 11/jul): sessões de treino in_progress abandonadas ficavam
-- travadas PARA SEMPRE — a única limpeza rodava no boot do app iOS do próprio
-- aluno (cleanupStaleSessions dentro do WatchBridge, iOS-only). Android, aluno
-- que sumiu ou trocou de aparelho = órfã eterna (12 em prod desde maio).
--
-- Limpeza server-side: sessões in_progress iniciadas há mais de 48h viram
-- 'abandoned' (nenhum treino legítimo dura 48h). Os set_logs são PRESERVADOS.
--
-- Convivência com o finish offline durável do celular (fila mobile): o drain
-- do finish foi ajustado no app para completar sessões in_progress OU
-- abandoned — finalizar offline e reconectar dias depois RECUPERA a sessão
-- que este cron marcou como abandonada (abandoned→completed é recuperação
-- legítima; completed nunca é tocado). A primeira execução varre as órfãs
-- históricas existentes.
CREATE OR REPLACE FUNCTION public.abandon_stale_workout_sessions()
RETURNS TABLE(session_id uuid, student_id uuid, started_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    abandoned_count INTEGER := 0;
BEGIN
    RETURN QUERY
    UPDATE workout_sessions ws
    SET status = 'abandoned'
    WHERE ws.status = 'in_progress'
      AND ws.started_at < now() - INTERVAL '48 hours'
    RETURNING ws.id, ws.student_id, ws.started_at;

    GET DIAGNOSTICS abandoned_count = ROW_COUNT;
    RAISE NOTICE '[abandon_stale_workout_sessions] abandoned % sessions', abandoned_count;
END;
$function$;

-- Sem execução via clientes: só o cron (service role) chama.
REVOKE EXECUTE ON FUNCTION public.abandon_stale_workout_sessions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.abandon_stale_workout_sessions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.abandon_stale_workout_sessions() FROM authenticated;

SELECT cron.schedule(
    'abandon-stale-workout-sessions-daily',
    '30 6 * * *',
    $$SELECT public.abandon_stale_workout_sessions();$$
);
