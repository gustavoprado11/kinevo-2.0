-- ============================================================================
-- 201_assign_form_trainer_param.sql
-- ============================================================================
-- Permite enviar formulário/check-in via MCP (service-role, sem JWT).
--
-- assign_form_to_students(uuid, uuid[], timestamptz, text) derivava o trainer de
-- current_trainer_id() e levantava 'Only trainers can assign forms' quando NULL.
-- Via MCP (service-role, auth.uid() NULL) isso falharia — mesmo padrão já
-- corrigido para templates (migration 200) e appointments.
--
-- Solução (backward-compatible, single source of truth):
--   • Nova versão de 5 args recebe p_trainer_id explicitamente (vindo do token
--     OAuth já validado pelo MCP) e contém todo o corpo.
--   • A versão de 4 args (usada pela UI via JWT) vira um wrapper fino que resolve
--     current_trainer_id() e delega à de 5 args.
-- ============================================================================

-- Versão com trainer explícito (MCP-friendly) — corpo completo.
CREATE OR REPLACE FUNCTION public.assign_form_to_students(
    p_trainer_id uuid,
    p_form_template_id uuid,
    p_student_ids uuid[],
    p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_message text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := p_trainer_id;
    v_template RECORD;
    v_student_id UUID;
    v_inbox_id UUID;
    v_submission_id UUID;
    v_assigned_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can assign forms';
    END IF;

    IF p_form_template_id IS NULL THEN
        RAISE EXCEPTION 'p_form_template_id is required';
    END IF;

    IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'p_student_ids must contain at least one student';
    END IF;

    -- Aceita templates do treinador OU templates de sistema (trainer_id IS NULL)
    SELECT ft.id, ft.title, ft.category, ft.version, ft.schema_json
    INTO v_template
    FROM form_templates ft
    WHERE ft.id = p_form_template_id
      AND (ft.trainer_id = v_trainer_id OR ft.trainer_id IS NULL)
      AND ft.is_active = true;

    IF v_template.id IS NULL THEN
        RAISE EXCEPTION 'Form template not found or inactive for current trainer';
    END IF;

    FOR v_student_id IN
        SELECT DISTINCT student_id FROM unnest(p_student_ids) AS student_id
    LOOP
        -- Ownership guard: só atribui aos próprios alunos.
        IF NOT EXISTS (
            SELECT 1 FROM students s WHERE s.id = v_student_id AND s.coach_id = v_trainer_id
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Pula duplicata se já há request pendente/não-lido para student+template.
        IF EXISTS (
            SELECT 1 FROM student_inbox_items si
            WHERE si.student_id = v_student_id
              AND si.trainer_id = v_trainer_id
              AND si.type = 'form_request'
              AND si.status IN ('unread', 'pending_action')
              AND si.payload ->> 'form_template_id' = p_form_template_id::TEXT
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        INSERT INTO student_inbox_items (
            student_id, trainer_id, type, status, title, subtitle, payload, due_at
        ) VALUES (
            v_student_id, v_trainer_id, 'form_request', 'pending_action',
            v_template.title,
            CASE WHEN p_message IS NULL OR btrim(p_message) = '' THEN 'Novo formulário' ELSE btrim(p_message) END,
            jsonb_build_object(
                'payload_version', 1,
                'form_template_id', v_template.id,
                'form_template_version', v_template.version,
                'category', v_template.category,
                'request_message', NULLIF(btrim(COALESCE(p_message, '')), '')
            ),
            p_due_at
        )
        RETURNING id INTO v_inbox_id;

        INSERT INTO form_submissions (
            form_template_id, form_template_version, trainer_id, student_id,
            inbox_item_id, status, schema_snapshot_json
        ) VALUES (
            v_template.id, v_template.version, v_trainer_id, v_student_id,
            v_inbox_id, 'draft', v_template.schema_json
        )
        RETURNING id INTO v_submission_id;

        UPDATE student_inbox_items
        SET payload = payload || jsonb_build_object('submission_id', v_submission_id)
        WHERE id = v_inbox_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    RETURN jsonb_build_object('assigned_count', v_assigned_count, 'skipped_count', v_skipped_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_form_to_students(uuid, uuid, uuid[], timestamp with time zone, text) TO authenticated;

-- Versão de 4 args (UI, via JWT) agora delega à de 5 args.
CREATE OR REPLACE FUNCTION public.assign_form_to_students(
    p_form_template_id uuid,
    p_student_ids uuid[],
    p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_message text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trainer_id UUID := current_trainer_id();
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can assign forms';
    END IF;
    RETURN public.assign_form_to_students(v_trainer_id, p_form_template_id, p_student_ids, p_due_at, p_message);
END;
$function$;
