-- ============================================================================
-- Kinevo — 027 Forms & Inbox Phase 2 (Backend RPCs)
-- ============================================================================
-- Implements secure RPCs for core workflow:
-- - assign_form_to_students
-- - submit_form_submission (required validation against schema snapshot)
-- - send_submission_feedback
-- ============================================================================

-- ============================================================================
-- 1) RPC: assign_form_to_students
-- ============================================================================
-- Creates inbox items + draft submissions in one server-side transaction.
-- Only the current trainer can assign templates to their own students.
-- Returns assignment summary counts.

CREATE OR REPLACE FUNCTION assign_form_to_students(
    p_form_template_id UUID,
    p_student_ids UUID[],
    p_due_at TIMESTAMPTZ DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
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

    SELECT
        ft.id,
        ft.title,
        ft.category,
        ft.version,
        ft.schema_json
    INTO v_template
    FROM form_templates ft
    WHERE ft.id = p_form_template_id
      AND ft.trainer_id = v_trainer_id
      AND ft.is_active = true;

    IF v_template.id IS NULL THEN
        RAISE EXCEPTION 'Form template not found or inactive for current trainer';
    END IF;

    FOR v_student_id IN
        SELECT DISTINCT student_id
        FROM unnest(p_student_ids) AS student_id
    LOOP
        -- Ownership guard: trainer can only assign to their own students.
        IF NOT EXISTS (
            SELECT 1
            FROM students s
            WHERE s.id = v_student_id
              AND s.coach_id = v_trainer_id
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Skip duplicates if there is already a pending/unread request
        -- for this student+template pair.
        IF EXISTS (
            SELECT 1
            FROM student_inbox_items si
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
            student_id,
            trainer_id,
            type,
            status,
            title,
            subtitle,
            payload,
            due_at
        ) VALUES (
            v_student_id,
            v_trainer_id,
            'form_request',
            'pending_action',
            v_template.title,
            CASE
                WHEN p_message IS NULL OR btrim(p_message) = '' THEN 'Novo formulário'
                ELSE btrim(p_message)
            END,
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
            form_template_id,
            form_template_version,
            trainer_id,
            student_id,
            inbox_item_id,
            status,
            schema_snapshot_json
        ) VALUES (
            v_template.id,
            v_template.version,
            v_trainer_id,
            v_student_id,
            v_inbox_id,
            'draft',
            v_template.schema_json
        )
        RETURNING id INTO v_submission_id;

        -- Backfill submission_id into inbox payload.
        UPDATE student_inbox_items
        SET payload = payload || jsonb_build_object('submission_id', v_submission_id)
        WHERE id = v_inbox_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'assigned_count', v_assigned_count,
        'skipped_count', v_skipped_count
    );
END;
$$;

-- ============================================================================
-- 2) RPC: submit_form_submission
-- ============================================================================
-- Validates required answers server-side against schema_snapshot_json.
-- If validation fails, raises exception and aborts transaction.

CREATE OR REPLACE FUNCTION submit_form_submission(
    p_submission_id UUID,
    p_answers_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

            IF v_question_type = 'single_choice' AND jsonb_typeof(v_question -> 'options') = 'array' THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(v_question -> 'options') AS opt
                    WHERE opt ->> 'value' = v_answer ->> 'value'
                ) THEN
                    RAISE EXCEPTION 'Invalid option for field: %', v_question_id;
                END IF;
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
$$;

-- ============================================================================
-- 3) RPC: send_submission_feedback
-- ============================================================================
-- Stores feedback and creates a new inbox item for the student.

CREATE OR REPLACE FUNCTION send_submission_feedback(
    p_submission_id UUID,
    p_feedback JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    RETURN jsonb_build_object(
        'ok', true,
        'feedback_inbox_item_id', v_feedback_item_id
    );
END;
$$;

-- ============================================================================
-- 4) GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION assign_form_to_students(UUID, UUID[], TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_form_to_students(UUID, UUID[], TIMESTAMPTZ, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION submit_form_submission(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_form_submission(UUID, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION send_submission_feedback(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION send_submission_feedback(UUID, JSONB) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

