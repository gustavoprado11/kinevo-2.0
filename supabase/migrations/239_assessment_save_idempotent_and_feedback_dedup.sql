-- ============================================================================
-- Kinevo — 239 Assessment save idempotent + feedback dedup
-- ============================================================================
-- Auditoria 10/jul/2026:
--   C2 — save_assessment_measurements (122 e 202) é INSERT-only; web reenvia o
--        array inteiro (subject_sex/age em toda sessão; retry duplica tudo) e
--        mobile re-mede deixando linhas órfãs. Passa a fazer DELETE-then-INSERT
--        por SLOT (session_id, metric_key, side, attempt_number), com side
--        NULL-safe. Multi-tentativa preservada (attempt_number distingue).
--   M3 — send_submission_feedback sempre INSERE um novo inbox item; reenviar
--        feedback empilhava itens + pushes. Passa a REAPROVEITAR o item de
--        feedback existente da submissão (update-or-insert).
--
-- Reproduz os corpos atuais (pg_get_functiondef) 1:1, mudando só o essencial.
-- Backward-compatible, idempotente. assessment_measurements tem 0 linhas em prod.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- C2.1 — save_assessment_measurements (in-app, current_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_assessment_measurements(p_session_id uuid, p_measurements jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_session RECORD;
    v_count INT := 0;
    v_m JSONB;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can save measurements';
    END IF;
    SELECT id, status INTO v_session
    FROM assessment_sessions
    WHERE id = p_session_id AND trainer_id = v_trainer_id;
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;
    IF v_session.status NOT IN ('scheduled', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot save measurements on a % session', v_session.status;
    END IF;
    UPDATE assessment_sessions
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now())
    WHERE id = p_session_id AND status = 'scheduled';
    FOR v_m IN SELECT * FROM jsonb_array_elements(p_measurements)
    LOOP
        -- Idempotência: remove o MESMO slot antes de inserir (re-save/retry/re-
        -- medição não duplicam). side NULL-safe; attempt_number preserva multi-tentativa.
        DELETE FROM assessment_measurements am
        WHERE am.session_id = p_session_id
          AND am.metric_key = v_m->>'metric_key'
          AND am.side IS NOT DISTINCT FROM (v_m->>'side')
          AND am.attempt_number = COALESCE((v_m->>'attempt_number')::INT, 1);

        INSERT INTO assessment_measurements (
            session_id, metric_key, value_numeric, value_text, value_unit,
            side, attempt_number, is_selected, raw_input
        ) VALUES (
            p_session_id,
            v_m->>'metric_key',
            (v_m->>'value_numeric')::NUMERIC,
            v_m->>'value_text',
            v_m->>'value_unit',
            v_m->>'side',
            COALESCE((v_m->>'attempt_number')::INT, 1),
            COALESCE((v_m->>'is_selected')::BOOLEAN, true),
            v_m->'raw_input'
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$function$;

-- ----------------------------------------------------------------------------
-- C2.2 — save_assessment_measurements (MCP, p_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_assessment_measurements(p_trainer_id uuid, p_session_id uuid, p_measurements jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_session RECORD;
    v_count INT := 0;
    v_m JSONB;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    SELECT id, status INTO v_session
    FROM assessment_sessions
    WHERE id = p_session_id AND trainer_id = v_trainer_id;
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;
    IF v_session.status NOT IN ('scheduled', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot save measurements on a % session', v_session.status;
    END IF;
    UPDATE assessment_sessions
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now())
    WHERE id = p_session_id AND status = 'scheduled';
    FOR v_m IN SELECT * FROM jsonb_array_elements(p_measurements)
    LOOP
        DELETE FROM assessment_measurements am
        WHERE am.session_id = p_session_id
          AND am.metric_key = v_m->>'metric_key'
          AND am.side IS NOT DISTINCT FROM (v_m->>'side')
          AND am.attempt_number = COALESCE((v_m->>'attempt_number')::INT, 1);

        INSERT INTO assessment_measurements (
            session_id, metric_key, value_numeric, value_text, value_unit,
            side, attempt_number, is_selected, raw_input
        ) VALUES (
            p_session_id,
            v_m->>'metric_key',
            (v_m->>'value_numeric')::NUMERIC,
            v_m->>'value_text',
            v_m->>'value_unit',
            v_m->>'side',
            COALESCE((v_m->>'attempt_number')::INT, 1),
            COALESCE((v_m->>'is_selected')::BOOLEAN, true),
            v_m->'raw_input'
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$function$;

-- ----------------------------------------------------------------------------
-- M3 — send_submission_feedback (reaproveita o inbox item de feedback)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_submission_feedback(p_submission_id uuid, p_feedback jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_submission RECORD;
    v_feedback_item_id UUID;
    v_preview TEXT;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can send feedback';
    END IF;

    IF p_submission_id IS NULL THEN
        RAISE EXCEPTION 'p_submission_id is required';
    END IF;

    IF p_feedback IS NULL OR jsonb_typeof(p_feedback) <> 'object' THEN
        RAISE EXCEPTION 'p_feedback must be a JSON object';
    END IF;

    SELECT
        fs.id,
        fs.student_id,
        fs.inbox_item_id,
        fs.status,
        ft.title AS form_title
    INTO v_submission
    FROM form_submissions fs
    LEFT JOIN form_templates ft ON ft.id = fs.form_template_id
    WHERE fs.id = p_submission_id
      AND fs.trainer_id = v_trainer_id;

    IF v_submission.id IS NULL THEN
        RAISE EXCEPTION 'Submission not found for current trainer';
    END IF;

    IF v_submission.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot send feedback for draft submission';
    END IF;

    v_preview := LEFT(
        COALESCE(
            NULLIF(btrim(p_feedback ->> 'message'), ''),
            NULLIF(btrim(p_feedback ->> 'text'), ''),
            'Você recebeu um novo feedback.'
        ),
        160
    );

    UPDATE form_submissions
    SET trainer_feedback = p_feedback,
        feedback_sent_at = now(),
        status = 'reviewed'
    WHERE id = p_submission_id;

    -- Reaproveita o item de feedback já existente desta submissão (reenvio não
    -- deve empilhar itens/pushes). Só cria um novo na primeira vez.
    SELECT id INTO v_feedback_item_id
    FROM student_inbox_items
    WHERE trainer_id = v_trainer_id
      AND student_id = v_submission.student_id
      AND type = 'feedback'
      AND payload ->> 'submission_id' = p_submission_id::TEXT
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_feedback_item_id IS NULL THEN
        INSERT INTO student_inbox_items (
            student_id,
            trainer_id,
            type,
            status,
            title,
            subtitle,
            payload
        ) VALUES (
            v_submission.student_id,
            v_trainer_id,
            'feedback',
            'unread',
            'Novo feedback do treinador',
            COALESCE(v_submission.form_title, 'Formulário respondido'),
            jsonb_build_object(
                'payload_version', 1,
                'submission_id', p_submission_id,
                'origin_inbox_item_id', v_submission.inbox_item_id,
                'feedback_preview', v_preview
            )
        )
        RETURNING id INTO v_feedback_item_id;
    ELSE
        -- Feedback atualizado: volta a aparecer como não-lido para o aluno.
        UPDATE student_inbox_items
        SET status = 'unread',
            read_at = NULL,
            completed_at = NULL,
            subtitle = COALESCE(v_submission.form_title, 'Formulário respondido'),
            payload = payload || jsonb_build_object('feedback_preview', v_preview)
        WHERE id = v_feedback_item_id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'feedback_inbox_item_id', v_feedback_item_id
    );
END;
$function$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
