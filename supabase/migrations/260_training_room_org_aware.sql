-- ============================================================================
-- 260: Estúdios v1 — Sala de Treino do MOBILE org-aware (coach substituto)
-- ============================================================================
-- Caso de uso central do estúdio: um coach conduz o treino do aluno de um
-- colega. A web já é org-aware (persist-session → getStudentScope); os 3 RPCs
-- que servem a sala do MOBILE ainda travavam por coach_id:
--   • get_training_room_students        — picker só listava os próprios
--   • get_student_today_workout_for_trainer — recusava aluno de colega
--   • trainer_finish_workout_session    — recusava gravar a sessão
--
-- Patch IN-PLACE: reescreve a definição VIVA (pg_get_functiondef) trocando só
-- o predicado de posse por "posse OU can_access_org_student(...)" (o mesmo
-- primitivo do RLS 252 e dos RPCs da 259). Robusto a drift: cada replace é
-- verificado (1 ocorrência exata) e a migração FALHA se o texto não bater.
--
-- Solo: can_access_org_student devolve false p/ quem não tem org → idêntico.
-- Atribuição: a sessão gravada continua com trainer_id = ator (o coach que
-- conduziu), que é o correto para o histórico e os KPIs por coach do gestor.
-- Mensagens/conversas NÃO mudam (conversa é pessoal do treinador, web = mobile).
-- ============================================================================

DO $patch$
DECLARE
    v_def text;
    v_new text;
BEGIN
    -- 1) get_training_room_students: picker lista alunos do estúdio; o programa
    --    ativo vem de QUALQUER coach (ap.trainer_id sai do predicado).
    v_def := pg_get_functiondef('public.get_training_room_students()'::regprocedure);

    IF (length(v_def) - length(replace(v_def, 's.coach_id = v_trainer_id', ''))) / length('s.coach_id = v_trainer_id') <> 1 THEN
        RAISE EXCEPTION 'get_training_room_students: predicado de posse não encontrado exatamente 1x — revisar manualmente';
    END IF;
    IF (length(v_def) - length(replace(v_def, 'AND ap.trainer_id = v_trainer_id', ''))) / length('AND ap.trainer_id = v_trainer_id') <> 1 THEN
        RAISE EXCEPTION 'get_training_room_students: filtro ap.trainer_id não encontrado exatamente 1x — revisar manualmente';
    END IF;

    v_new := replace(v_def,
        's.coach_id = v_trainer_id',
        '(s.coach_id = v_trainer_id OR public.can_access_org_student(s.id))');
    v_new := replace(v_new, 'AND ap.trainer_id = v_trainer_id', '');
    EXECUTE v_new;

    -- 2) get_student_today_workout_for_trainer: aceita aluno do estúdio.
    v_def := pg_get_functiondef('public.get_student_today_workout_for_trainer(uuid, uuid)'::regprocedure);

    IF (length(v_def) - length(replace(v_def, 'AND coach_id = v_trainer_id', ''))) / length('AND coach_id = v_trainer_id') <> 1 THEN
        RAISE EXCEPTION 'get_student_today_workout_for_trainer: predicado de posse não encontrado exatamente 1x — revisar manualmente';
    END IF;

    v_new := replace(v_def,
        'AND coach_id = v_trainer_id',
        'AND (coach_id = v_trainer_id OR public.can_access_org_student(p_student_id))');
    EXECUTE v_new;

    -- 3) trainer_finish_workout_session: grava a sessão conduzida por coach do
    --    estúdio (trainer_id da sessão = ator, atribuição correta).
    v_def := pg_get_functiondef('public.trainer_finish_workout_session(uuid, uuid, uuid, jsonb, timestamptz, integer, smallint, text)'::regprocedure);

    IF (length(v_def) - length(replace(v_def, 'AND coach_id = v_trainer_id', ''))) / length('AND coach_id = v_trainer_id') <> 1 THEN
        RAISE EXCEPTION 'trainer_finish_workout_session: predicado de posse não encontrado exatamente 1x — revisar manualmente';
    END IF;

    v_new := replace(v_def,
        'AND coach_id = v_trainer_id',
        'AND (coach_id = v_trainer_id OR public.can_access_org_student(p_student_id))');
    EXECUTE v_new;
END $patch$;
