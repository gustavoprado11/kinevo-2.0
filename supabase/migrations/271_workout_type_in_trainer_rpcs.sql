-- ============================================================================
-- 271: workout_type nos RPCs do treinador mobile
--
-- Dual-day força+aeróbio: o app do treinador não distinguia sessões aeróbias
-- porque get_student_profile_detail (aba Programas do aluno) e
-- get_training_room_students (picker da sala de treino) não devolviam
-- assigned_workouts.workout_type. Backward-compat: só ADICIONA um campo ao
-- JSON — clientes antigos ignoram.
--
-- Mesmo padrão de patch das migrations 260/262: pega a definição VIVA via
-- pg_get_functiondef e substitui o fragmento com guarda de exatamente-1
-- ocorrência (as funções foram evoluindo por patches; reescrever o corpo
-- inteiro aqui arriscaria regredir os patches de org-awareness).
-- ============================================================================

DO $$
DECLARE
    v_def  TEXT;
    v_frag TEXT := $frag$'scheduled_days', COALESCE(to_jsonb(aw.scheduled_days), '[]'::jsonb)$frag$;
    v_repl TEXT := $repl$'scheduled_days', COALESCE(to_jsonb(aw.scheduled_days), '[]'::jsonb),
                'workout_type', aw.workout_type$repl$;
BEGIN
    -- 1) get_student_profile_detail: workouts do programa ativo ganham o tipo.
    v_def := pg_get_functiondef('public.get_student_profile_detail(uuid)'::regprocedure);
    IF (length(v_def) - length(replace(v_def, v_frag, ''))) / length(v_frag) <> 1 THEN
        RAISE EXCEPTION 'get_student_profile_detail: fragmento scheduled_days não encontrado exatamente 1x — revisar manualmente';
    END IF;
    IF v_def LIKE '%workout_type%' THEN
        RAISE NOTICE 'get_student_profile_detail já tem workout_type — pulando';
    ELSE
        EXECUTE replace(v_def, v_frag, v_repl);
    END IF;

    -- 2) get_training_room_students: opções de treino do picker ganham o tipo.
    v_def := pg_get_functiondef('public.get_training_room_students()'::regprocedure);
    IF (length(v_def) - length(replace(v_def, v_frag, ''))) / length(v_frag) <> 1 THEN
        RAISE EXCEPTION 'get_training_room_students: fragmento scheduled_days não encontrado exatamente 1x — revisar manualmente';
    END IF;
    IF v_def LIKE '%workout_type%' THEN
        RAISE NOTICE 'get_training_room_students já tem workout_type — pulando';
    ELSE
        EXECUTE replace(v_def, v_frag, v_repl);
    END IF;
END $$;
