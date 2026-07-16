-- ============================================================================
-- 262: Estúdios — varredura de consistência (auditoria 16/jul, 4 frentes)
-- ============================================================================
-- Fixes de banco da auditoria "telas condizentes com estúdios":
--
-- 1. PRIVACIDADE: drop de messages_org_select (252). Mensagens são PESSOAIS do
--    treinador (decisão de produto); a web já filtra por coach_id, mas a policy
--    deixava o MOBILE ler a conversa do colega com o aluno compartilhado
--    (useTrainerChatRoom busca por student_id puro). O INSERT nunca teve policy
--    org — a assimetria (ler sim, enviar não) confirma que a policy era indevida.
--
-- 2. RPCs de fluxo de estúdio ainda coach-gated (patch in-place da definição
--    viva, com asserção — mesma técnica da 260):
--    • assign_program_from_template — atribuir template a aluno de colega
--    • assign_program_to_student (4 args, MCP) — idem
--    • create_assessment_session (×2 overloads) — nova avaliação p/ aluno de colega
--    • get_assessment_sessions (×2) — listar avaliações do aluno compartilhado
--    • get_assessment_session (×2) — abrir avaliação do colega
--    (save/finalize_assessment ficam do CRIADOR — avaliação em andamento é de
--    quem está conduzindo. A variante legada assign_program_to_student de 3
--    args referencia students.trainer_id, coluna renomeada — código morto,
--    não tocada.)
--
-- 3. UI de posse no mobile: get_trainer_students_list e get_student_profile_
--    detail passam a devolver coach_id, p/ o app esconder CTAs pessoais
--    (mensagem/agenda) em aluno de colega.
-- ============================================================================

-- 1) Mensagens são pessoais — remove a leitura cross-coach.
drop policy if exists messages_org_select on public.messages;

-- 2) Patches in-place (falham alto se o predicado tiver driftado).
DO $patch$
DECLARE
    r record;
    v_def text;
    v_new text;
    v_n int;
BEGIN
    -- assign_program_from_template: gate do aluno vira org-aware.
    FOR r IN
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'assign_program_from_template'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 's.coach_id = p_trainer_id', ''))) / length('s.coach_id = p_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'assign_program_from_template: predicado %x (esperado 1)', v_n; END IF;
        v_new := replace(v_def, 's.coach_id = p_trainer_id',
            '(s.coach_id = p_trainer_id OR public.can_access_org_student(s.id))');
        EXECUTE v_new;
    END LOOP;

    -- assign_program_to_student (variante VIVA de 4 args; a de 3 é legada/morta).
    FOR r IN
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'assign_program_to_student'
          AND pg_get_functiondef(p.oid) LIKE '%coach_id = v_trainer_id%'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 'AND coach_id = v_trainer_id', ''))) / length('AND coach_id = v_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'assign_program_to_student: predicado %x (esperado 1)', v_n; END IF;
        v_new := replace(v_def, 'AND coach_id = v_trainer_id',
            'AND (coach_id = v_trainer_id OR public.can_access_org_student(p_student_id))');
        EXECUTE v_new;
    END LOOP;

    -- create_assessment_session (ambos os overloads).
    FOR r IN
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'create_assessment_session'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 'AND s.coach_id = v_trainer_id', ''))) / length('AND s.coach_id = v_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'create_assessment_session: predicado %x (esperado 1)', v_n; END IF;
        v_new := replace(v_def, 'AND s.coach_id = v_trainer_id',
            'AND (s.coach_id = v_trainer_id OR public.can_access_org_student(s.id))');
        EXECUTE v_new;
    END LOOP;

    -- get_assessment_sessions (ambos): lista por acesso ao aluno.
    FOR r IN
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_assessment_sessions'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 'WHERE s.trainer_id = v_trainer_id', ''))) / length('WHERE s.trainer_id = v_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'get_assessment_sessions: predicado %x (esperado 1)', v_n; END IF;
        v_new := replace(v_def, 'WHERE s.trainer_id = v_trainer_id',
            'WHERE (s.trainer_id = v_trainer_id OR public.can_access_org_student(s.student_id))');
        EXECUTE v_new;
    END LOOP;

    -- get_assessment_session (ambos): abrir avaliação de colega do estúdio.
    FOR r IN
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_assessment_session'
    LOOP
        v_def := pg_get_functiondef(r.oid);
        v_n := (length(v_def) - length(replace(v_def, 's.trainer_id = v_trainer_id', ''))) / length('s.trainer_id = v_trainer_id');
        IF v_n <> 1 THEN RAISE EXCEPTION 'get_assessment_session: predicado %x (esperado 1)', v_n; END IF;
        v_new := replace(v_def, 's.trainer_id = v_trainer_id',
            's.trainer_id = v_trainer_id OR public.can_access_org_student(s.student_id)');
        EXECUTE v_new;
    END LOOP;

    -- get_trainer_students_list: devolve coach_id (UI de posse no app).
    v_def := pg_get_functiondef('public.get_trainer_students_list()'::regprocedure);
    IF position('s.coach_id,' in v_def) = 0 THEN
        IF position('s.is_private,' in v_def) = 0 THEN
            RAISE EXCEPTION 'get_trainer_students_list: âncora s.is_private não encontrada';
        END IF;
        EXECUTE replace(v_def, 's.is_private,', 's.is_private,
               s.coach_id,');
    END IF;

    -- get_student_profile_detail: coach_id no jsonb do aluno.
    v_def := pg_get_functiondef('public.get_student_profile_detail(uuid)'::regprocedure);
    IF position('''coach_id'', s.coach_id' in v_def) = 0 THEN
        IF position('''is_trainer_profile'', s.is_trainer_profile,' in v_def) = 0 THEN
            RAISE EXCEPTION 'get_student_profile_detail: âncora is_trainer_profile não encontrada';
        END IF;
        EXECUTE replace(v_def, '''is_trainer_profile'', s.is_trainer_profile,',
            '''is_trainer_profile'', s.is_trainer_profile,
        ''coach_id'', s.coach_id,');
    END IF;
END $patch$;
