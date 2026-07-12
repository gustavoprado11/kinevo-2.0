-- T2+T4 (auditoria 11/jul, decisão do Gustavo): finish da Sala de Treino web
-- vira TRANSACIONAL e REATA a sessão do aluno.
--
-- T2: antes a action inseria workout_sessions 'completed' e DEPOIS os set_logs
-- em chamadas separadas — falha no meio deixava sessão-fantasma (0 séries) e o
-- retry criava uma SEGUNDA sessão (mitigado por compensação client-side em
-- 7ee16d1; isto fecha de vez: tudo num só commit).
--
-- T4: antes a Sala SEMPRE inseria sessão nova — se o aluno estava rodando o
-- mesmo treino no celular (sessão in_progress com séries já logadas), o
-- histórico duplicava e a sessão do aluno ficava órfã. Agora o finish reata a
-- sessão in_progress RECENTE (<12h; mais velha que isso é abandono — fica para
-- o cron da migração 243) e faz upsert das séries: as que o aluno já logou são
-- preservadas; colisão de set_number = a Sala (treinador) vence.
--
-- Execução: SÓ service role (a Server Action valida a sessão do treinador e
-- chama com supabaseAdmin). Posse revalidada dentro (defesa em profundidade).
CREATE OR REPLACE FUNCTION public.finish_training_room_session(
    p_trainer_id uuid,
    p_student_id uuid,
    p_assigned_workout_id uuid,
    p_assigned_program_id uuid,
    p_started_at timestamptz,
    p_rpe integer,
    p_feedback text,
    p_pre_submission_id uuid,
    p_post_submission_id uuid,
    p_scheduled_date date,
    p_program_week integer,
    p_set_logs jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_session_id uuid;
    v_existing_id uuid;
    v_existing_started timestamptz;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM students WHERE id = p_student_id AND coach_id = p_trainer_id
    ) THEN
        RAISE EXCEPTION 'student does not belong to trainer';
    END IF;

    -- T4: sessão in_progress RECENTE do aluno para o mesmo treino.
    -- FOR UPDATE serializa contra o finish simultâneo vindo do app do aluno.
    SELECT id, started_at INTO v_existing_id, v_existing_started
    FROM workout_sessions
    WHERE student_id = p_student_id
      AND assigned_workout_id = p_assigned_workout_id
      AND status = 'in_progress'
      AND started_at > now() - INTERVAL '12 hours'
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
        UPDATE workout_sessions SET
            status = 'completed',
            completed_at = now(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - v_existing_started)))::int,
            sync_status = 'synced',
            rpe = COALESCE(p_rpe, rpe),
            feedback = COALESCE(p_feedback, feedback),
            pre_workout_submission_id = COALESCE(p_pre_submission_id, pre_workout_submission_id),
            post_workout_submission_id = COALESCE(p_post_submission_id, post_workout_submission_id),
            scheduled_date = COALESCE(p_scheduled_date, scheduled_date),
            program_week = COALESCE(p_program_week, program_week),
            assigned_program_id = COALESCE(assigned_program_id, p_assigned_program_id)
        WHERE id = v_existing_id;
        v_session_id := v_existing_id;
    ELSE
        INSERT INTO workout_sessions (
            student_id, trainer_id, assigned_workout_id, assigned_program_id,
            status, started_at, completed_at, duration_seconds, sync_status,
            rpe, feedback, pre_workout_submission_id, post_workout_submission_id,
            scheduled_date, program_week
        ) VALUES (
            p_student_id, p_trainer_id, p_assigned_workout_id, p_assigned_program_id,
            'completed', p_started_at, now(),
            GREATEST(0, EXTRACT(EPOCH FROM (now() - p_started_at)))::int, 'synced',
            p_rpe, p_feedback, p_pre_submission_id, p_post_submission_id,
            p_scheduled_date, p_program_week
        ) RETURNING id INTO v_session_id;
    END IF;

    -- T2: séries na MESMA transação. Upsert idempotente pela unique
    -- (workout_session_id, assigned_workout_item_id, set_number) — no reattach
    -- preserva séries que só o aluno logou; nas colididas a Sala vence.
    INSERT INTO set_logs (
        workout_session_id, assigned_workout_item_id, planned_exercise_id,
        executed_exercise_id, swap_source, exercise_id, set_number, weight,
        reps_completed, is_completed, completed_at, weight_unit, notes
    )
    SELECT
        v_session_id,
        (sl->>'assigned_workout_item_id')::uuid,
        (sl->>'planned_exercise_id')::uuid,
        (sl->>'executed_exercise_id')::uuid,
        COALESCE(sl->>'swap_source', 'none'),
        (sl->>'exercise_id')::uuid,
        (sl->>'set_number')::int,
        COALESCE((sl->>'weight')::numeric, 0),
        COALESCE((sl->>'reps_completed')::int, 0),
        COALESCE((sl->>'is_completed')::boolean, true),
        COALESCE((sl->>'completed_at')::timestamptz, now()),
        COALESCE(sl->>'weight_unit', 'kg'),
        sl->>'notes'
    FROM jsonb_array_elements(COALESCE(p_set_logs, '[]'::jsonb)) AS sl
    ON CONFLICT (workout_session_id, assigned_workout_item_id, set_number)
    DO UPDATE SET
        weight = EXCLUDED.weight,
        reps_completed = EXCLUDED.reps_completed,
        is_completed = EXCLUDED.is_completed,
        completed_at = EXCLUDED.completed_at,
        weight_unit = EXCLUDED.weight_unit,
        notes = EXCLUDED.notes,
        planned_exercise_id = EXCLUDED.planned_exercise_id,
        executed_exercise_id = EXCLUDED.executed_exercise_id,
        swap_source = EXCLUDED.swap_source,
        exercise_id = EXCLUDED.exercise_id;

    RETURN v_session_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finish_training_room_session(uuid, uuid, uuid, uuid, timestamptz, integer, text, uuid, uuid, date, integer, jsonb) FROM authenticated;
