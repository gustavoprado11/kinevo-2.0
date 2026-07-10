-- ============================================================================
-- Kinevo — 238 Forms validation: multi_choice + single_choice string options
-- ============================================================================
-- Corrige o CONTRATO de validação de respostas (auditoria 10/jul/2026, H2/H7 +
-- resíduo do C1) em duas RPCs que compartilham a mesma lógica:
--   - submit_form_submission (027)  — envio pelo app do aluno (inbox)
--   - submit_inline_form     (078)  — check-in pré/pós-treino
--
-- Dois ajustes, ambos BACKWARD-COMPATIBLE (só tornam a validação mais correta;
-- nenhuma submissão válida existente passa a falhar):
--
--   1) multi_choice — a resposta vem em `values` (array), não em `value`. Antes
--      caía no fallback genérico (exigia `value`) e um multi_choice OBRIGATÓRIO
--      preenchido pelo aluno era rejeitado como "campo vazio". Agora valida
--      `values` como array não-vazio.
--
--   2) single_choice com opções em STRING — templates de sistema antigos guardam
--      `options` como string pura (["Nenhum","1",...]). A checagem de pertinência
--      `opt->>'value' = answer->>'value'` dá NULL para string e rejeitava uma
--      resposta válida ("Invalid option"). Agora a pertinência só é exigida
--      quando as opções são OBJETOS {value,label}; para string, aceita o valor
--      não-vazio (já garantido).
--
-- Reproduz o corpo atual das funções (pg_get_functiondef) 1:1, mudando apenas o
-- trecho de validação. Idempotente (CREATE OR REPLACE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) submit_form_submission (app do aluno / inbox)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_form_submission(p_submission_id uuid, p_answers_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_student_id UUID := current_student_id();
    v_submission RECORD;
    v_answers JSONB;
    v_question JSONB;
    v_question_id TEXT;
    v_question_type TEXT;
    v_required BOOLEAN;
    v_answer JSONB;
    v_value_text TEXT;
    v_scale_value NUMERIC;
    v_min_scale INTEGER;
    v_max_scale INTEGER;
BEGIN
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Only students can submit form answers';
    END IF;

    IF p_submission_id IS NULL THEN
        RAISE EXCEPTION 'p_submission_id is required';
    END IF;

    IF p_answers_json IS NULL OR jsonb_typeof(p_answers_json) <> 'object' THEN
        RAISE EXCEPTION 'p_answers_json must be a JSON object';
    END IF;

    v_answers := p_answers_json -> 'answers';
    IF v_answers IS NULL OR jsonb_typeof(v_answers) <> 'object' THEN
        RAISE EXCEPTION 'answers_json.answers must be a JSON object';
    END IF;

    SELECT
        fs.id,
        fs.student_id,
        fs.inbox_item_id,
        fs.status,
        fs.schema_snapshot_json
    INTO v_submission
    FROM form_submissions fs
    WHERE fs.id = p_submission_id
      AND fs.student_id = v_student_id;

    IF v_submission.id IS NULL THEN
        RAISE EXCEPTION 'Submission not found for current student';
    END IF;

    IF v_submission.status <> 'draft' THEN
        RAISE EXCEPTION 'Submission is not in draft status';
    END IF;

    FOR v_question IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_submission.schema_snapshot_json -> 'questions', '[]'::jsonb))
    LOOP
        v_question_id := COALESCE(v_question ->> 'id', '');
        IF v_question_id = '' THEN
            CONTINUE;
        END IF;

        v_required := COALESCE((v_question ->> 'required')::BOOLEAN, false);
        IF NOT v_required THEN
            CONTINUE;
        END IF;

        v_answer := v_answers -> v_question_id;
        IF v_answer IS NULL OR v_answer = 'null'::jsonb THEN
            RAISE EXCEPTION 'Required field missing: %', v_question_id;
        END IF;

        v_question_type := COALESCE(v_question ->> 'type', '');

        IF v_question_type IN ('short_text', 'long_text', 'single_choice') THEN
            v_value_text := btrim(COALESCE(v_answer ->> 'value', ''));
            IF v_value_text = '' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;

            -- Pertinência só quando as opções são OBJETOS {value,label}. Opções em
            -- string (templates de sistema) não têm ->>'value' → não rejeita.
            IF v_question_type = 'single_choice'
               AND jsonb_typeof(v_question -> 'options') = 'array'
               AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(v_question -> 'options') AS o
                   WHERE jsonb_typeof(o) = 'object'
               ) THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(v_question -> 'options') AS opt
                    WHERE opt ->> 'value' = v_answer ->> 'value'
                ) THEN
                    RAISE EXCEPTION 'Invalid option for field: %', v_question_id;
                END IF;
            END IF;

        ELSIF v_question_type = 'multi_choice' THEN
            -- Múltipla escolha responde em `values` (array), não em `value`.
            -- IS DISTINCT FROM trata `values` ausente/não-array como vazio (evita
            -- o buraco de NULL e jsonb_array_length sobre escalar).
            IF jsonb_typeof(v_answer -> 'values') IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            ELSIF jsonb_array_length(v_answer -> 'values') = 0 THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;

        ELSIF v_question_type = 'scale' THEN
            IF NOT (v_answer ? 'value') THEN
                RAISE EXCEPTION 'Required scale value missing: %', v_question_id;
            END IF;

            BEGIN
                v_scale_value := (v_answer ->> 'value')::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid scale value for field: %', v_question_id;
            END;

            v_min_scale := COALESCE((v_question -> 'scale' ->> 'min')::INTEGER, 1);
            v_max_scale := COALESCE((v_question -> 'scale' ->> 'max')::INTEGER, 5);

            IF v_scale_value < v_min_scale OR v_scale_value > v_max_scale THEN
                RAISE EXCEPTION 'Scale value out of range for field: %', v_question_id;
            END IF;

        ELSIF v_question_type = 'photo' THEN
            IF jsonb_typeof(v_answer -> 'files') <> 'array'
               OR jsonb_array_length(v_answer -> 'files') = 0 THEN
                RAISE EXCEPTION 'Required photo missing for field: %', v_question_id;
            END IF;

        ELSE
            -- Generic fallback for unknown required types.
            v_value_text := btrim(COALESCE(v_answer ->> 'value', ''));
            IF v_value_text = '' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;
        END IF;
    END LOOP;

    UPDATE form_submissions
    SET answers_json = p_answers_json,
        status = 'submitted',
        submitted_at = now()
    WHERE id = p_submission_id;

    UPDATE student_inbox_items
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        read_at = COALESCE(read_at, now())
    WHERE id = v_submission.inbox_item_id
      AND student_id = v_student_id;

    RETURN jsonb_build_object(
        'ok', true,
        'submission_id', p_submission_id
    );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2) submit_inline_form (check-in pré/pós-treino)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_inline_form(p_form_template_id uuid, p_student_id uuid, p_trainer_id uuid, p_answers_json jsonb, p_trigger_context text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_trainer_id UUID := current_trainer_id();
    v_caller_student_id UUID := current_student_id();
    v_template RECORD;
    v_submission_id UUID;
    v_answers JSONB;
    v_question JSONB;
    v_question_id TEXT;
    v_question_type TEXT;
    v_required BOOLEAN;
    v_answer JSONB;
    v_value_text TEXT;
    v_scale_value NUMERIC;
    v_min_scale INTEGER;
    v_max_scale INTEGER;
BEGIN
    -- Auth: must be either the trainer or the student
    IF v_caller_trainer_id IS NULL AND v_caller_student_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Validate trigger_context
    IF p_trigger_context IS NULL OR p_trigger_context NOT IN ('pre_workout', 'post_workout') THEN
        RAISE EXCEPTION 'p_trigger_context must be pre_workout or post_workout';
    END IF;

    IF p_form_template_id IS NULL THEN
        RAISE EXCEPTION 'p_form_template_id is required';
    END IF;

    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'p_student_id is required';
    END IF;

    IF p_trainer_id IS NULL THEN
        RAISE EXCEPTION 'p_trainer_id is required';
    END IF;

    IF p_answers_json IS NULL OR jsonb_typeof(p_answers_json) <> 'object' THEN
        RAISE EXCEPTION 'p_answers_json must be a JSON object';
    END IF;

    v_answers := p_answers_json -> 'answers';
    IF v_answers IS NULL OR jsonb_typeof(v_answers) <> 'object' THEN
        RAISE EXCEPTION 'p_answers_json.answers must be a JSON object';
    END IF;

    -- Ownership guard: caller must be the trainer or the student specified
    IF v_caller_trainer_id IS NOT NULL AND v_caller_trainer_id <> p_trainer_id THEN
        RAISE EXCEPTION 'Trainer ID mismatch';
    END IF;

    IF v_caller_student_id IS NOT NULL AND v_caller_student_id <> p_student_id THEN
        RAISE EXCEPTION 'Student ID mismatch';
    END IF;

    -- Verify student belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = p_student_id AND s.coach_id = p_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student does not belong to this trainer';
    END IF;

    -- Fetch template
    SELECT
        ft.id,
        ft.version,
        ft.schema_json,
        ft.is_active
    INTO v_template
    FROM form_templates ft
    WHERE ft.id = p_form_template_id
      AND (ft.trainer_id = p_trainer_id OR ft.trainer_id IS NULL);

    IF v_template.id IS NULL THEN
        RAISE EXCEPTION 'Form template not found';
    END IF;

    IF NOT v_template.is_active THEN
        RAISE EXCEPTION 'Form template is inactive';
    END IF;

    -- ========================================================================
    -- Validate answers against schema (same logic as submit_form_submission)
    -- ========================================================================
    FOR v_question IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_template.schema_json -> 'questions', '[]'::jsonb))
    LOOP
        v_question_id := COALESCE(v_question ->> 'id', '');
        IF v_question_id = '' THEN
            CONTINUE;
        END IF;

        v_required := COALESCE((v_question ->> 'required')::BOOLEAN, false);
        IF NOT v_required THEN
            CONTINUE;
        END IF;

        v_answer := v_answers -> v_question_id;
        IF v_answer IS NULL OR v_answer = 'null'::jsonb THEN
            RAISE EXCEPTION 'Required field missing: %', v_question_id;
        END IF;

        v_question_type := COALESCE(v_question ->> 'type', '');

        IF v_question_type IN ('short_text', 'long_text', 'single_choice') THEN
            v_value_text := btrim(COALESCE(v_answer ->> 'value', ''));
            IF v_value_text = '' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;

            -- Pertinência só quando as opções são OBJETOS {value,label}. Opções em
            -- string (templates de sistema) não têm ->>'value' → não rejeita.
            IF v_question_type = 'single_choice'
               AND jsonb_typeof(v_question -> 'options') = 'array'
               AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(v_question -> 'options') AS o
                   WHERE jsonb_typeof(o) = 'object'
               ) THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(v_question -> 'options') AS opt
                    WHERE opt ->> 'value' = v_answer ->> 'value'
                ) THEN
                    RAISE EXCEPTION 'Invalid option for field: %', v_question_id;
                END IF;
            END IF;

        ELSIF v_question_type = 'multi_choice' THEN
            -- Múltipla escolha responde em `values` (array), não em `value`.
            -- IS DISTINCT FROM trata `values` ausente/não-array como vazio (evita
            -- o buraco de NULL e jsonb_array_length sobre escalar).
            IF jsonb_typeof(v_answer -> 'values') IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            ELSIF jsonb_array_length(v_answer -> 'values') = 0 THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;

        ELSIF v_question_type = 'scale' THEN
            IF NOT (v_answer ? 'value') THEN
                RAISE EXCEPTION 'Required scale value missing: %', v_question_id;
            END IF;

            BEGIN
                v_scale_value := (v_answer ->> 'value')::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid scale value for field: %', v_question_id;
            END;

            v_min_scale := COALESCE((v_question -> 'scale' ->> 'min')::INTEGER, 1);
            v_max_scale := COALESCE((v_question -> 'scale' ->> 'max')::INTEGER, 5);

            IF v_scale_value < v_min_scale OR v_scale_value > v_max_scale THEN
                RAISE EXCEPTION 'Scale value out of range for field: %', v_question_id;
            END IF;

        ELSIF v_question_type = 'photo' THEN
            IF jsonb_typeof(v_answer -> 'files') <> 'array'
               OR jsonb_array_length(v_answer -> 'files') = 0 THEN
                RAISE EXCEPTION 'Required photo missing for field: %', v_question_id;
            END IF;

        ELSE
            v_value_text := btrim(COALESCE(v_answer ->> 'value', ''));
            IF v_value_text = '' THEN
                RAISE EXCEPTION 'Required field empty: %', v_question_id;
            END IF;
        END IF;
    END LOOP;

    -- ========================================================================
    -- Create the submission (no inbox_item)
    -- ========================================================================
    INSERT INTO form_submissions (
        form_template_id,
        form_template_version,
        trainer_id,
        student_id,
        inbox_item_id,
        status,
        schema_snapshot_json,
        answers_json,
        submitted_at,
        trigger_context
    ) VALUES (
        v_template.id,
        v_template.version,
        p_trainer_id,
        p_student_id,
        NULL,
        'submitted',
        v_template.schema_json,
        p_answers_json,
        now(),
        p_trigger_context
    )
    RETURNING id INTO v_submission_id;

    RETURN jsonb_build_object(
        'ok', true,
        'submission_id', v_submission_id
    );
END;
$function$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
