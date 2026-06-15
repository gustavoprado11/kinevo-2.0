-- 202_assessment_mcp_trainer_id.sql
--
-- MCP escreve com service-role (sem JWT), então current_trainer_id() é NULL e
-- todos os RPCs de avaliação falham via MCP. Este migration adiciona OVERLOADS
-- com p_trainer_id como primeiro argumento, replicando a lógica trainer-scoped.
--
-- As funções originais (que current_trainer_id() resolve do JWT e, no caso de
-- get_assessment_session, também o acesso do aluno) ficam INTACTAS — backward
-- compatible. PostgREST resolve por nome dos parâmetros: chamadas sem
-- p_trainer_id continuam batendo na versão antiga; o núcleo do MCP chama a nova.
--
-- Convenção idêntica às migrations 200/201 (program templates / forms).

-- ----------------------------------------------------------------------------
-- create_assessment_session (overload com p_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_assessment_session(
    p_trainer_id uuid,
    p_student_id uuid,
    p_template_id uuid,
    p_scheduled_at timestamptz DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_template RECORD;
    v_session_id UUID;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = p_student_id AND s.coach_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this trainer';
    END IF;
    SELECT id, version, schema_json, category
    INTO v_template
    FROM form_templates
    WHERE id = p_template_id
      AND (trainer_id = v_trainer_id OR trainer_id IS NULL)
      AND category = 'assessment'
      AND is_active = true;
    IF v_template IS NULL THEN
        RAISE EXCEPTION 'Assessment template not found or not accessible';
    END IF;
    INSERT INTO assessment_sessions (
        trainer_id, student_id, template_id, template_version, template_snapshot,
        status, scheduled_at, notes
    ) VALUES (
        v_trainer_id, p_student_id, v_template.id, v_template.version, v_template.schema_json,
        CASE WHEN p_scheduled_at IS NULL THEN 'in_progress' ELSE 'scheduled' END,
        p_scheduled_at, p_notes
    )
    RETURNING id INTO v_session_id;
    RETURN v_session_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- save_assessment_measurements (overload com p_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_assessment_measurements(
    p_trainer_id uuid,
    p_session_id uuid,
    p_measurements jsonb
)
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
-- finalize_assessment_session (overload com p_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_assessment_session(
    p_trainer_id uuid,
    p_session_id uuid,
    p_computed_metrics jsonb,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_session RECORD;
    v_inbox_id UUID;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    SELECT id, student_id, status INTO v_session
    FROM assessment_sessions
    WHERE id = p_session_id AND trainer_id = v_trainer_id;
    IF v_session IS NULL THEN
        RAISE EXCEPTION 'Session not found';
    END IF;
    IF v_session.status = 'completed' THEN
        RAISE EXCEPTION 'Session already completed';
    END IF;
    INSERT INTO student_inbox_items (
        student_id, trainer_id, type, status, title, subtitle, payload, completed_at
    ) VALUES (
        v_session.student_id, v_trainer_id, 'system_alert', 'unread',
        'Avaliação concluída',
        'Seu treinador compartilhou os resultados da avaliação',
        jsonb_build_object('assessment_session_id', p_session_id),
        now()
    )
    RETURNING id INTO v_inbox_id;
    UPDATE assessment_sessions
    SET status = 'completed',
        completed_at = now(),
        computed_metrics = p_computed_metrics,
        notes = COALESCE(p_notes, notes),
        inbox_item_id = v_inbox_id
    WHERE id = p_session_id;
    RETURN jsonb_build_object(
        'session_id', p_session_id,
        'inbox_item_id', v_inbox_id,
        'completed_at', now()
    );
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_assessment_sessions (overload com p_trainer_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_assessment_sessions(
    p_trainer_id uuid,
    p_student_id uuid DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.scheduled_at DESC NULLS LAST)
        FROM (
            SELECT s.id, s.student_id, s.template_id, s.status,
                   s.scheduled_at, s.started_at, s.completed_at,
                   s.computed_metrics,
                   st.name AS student_name, st.avatar_url AS student_avatar,
                   ft.title AS template_title
            FROM assessment_sessions s
            JOIN students st ON st.id = s.student_id
            LEFT JOIN form_templates ft ON ft.id = s.template_id
            WHERE s.trainer_id = v_trainer_id
              AND (p_student_id IS NULL OR s.student_id = p_student_id)
              AND (p_status IS NULL OR s.status = p_status)
            ORDER BY s.scheduled_at DESC NULLS LAST
            LIMIT p_limit
        ) sub
    ), '[]'::jsonb);
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_assessment_session (overload com p_trainer_id) — acesso só do treinador
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_assessment_session(
    p_trainer_id uuid,
    p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_result JSONB;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'trainer_id is required';
    END IF;
    SELECT jsonb_build_object(
        'session', row_to_json(s)::jsonb,
        'student', row_to_json(st)::jsonb,
        'template', row_to_json(ft)::jsonb,
        'measurements', COALESCE((
            SELECT jsonb_agg(row_to_json(m)::jsonb ORDER BY m.measured_at)
            FROM assessment_measurements m
            WHERE m.session_id = p_session_id
        ), '[]'::jsonb)
    )
    INTO v_result
    FROM assessment_sessions s
    JOIN students st ON st.id = s.student_id
    LEFT JOIN form_templates ft ON ft.id = s.template_id
    WHERE s.id = p_session_id
      AND s.trainer_id = v_trainer_id;
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Session not found or access denied';
    END IF;
    RETURN v_result;
END;
$function$;
