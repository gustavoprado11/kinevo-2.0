-- ============================================================================
-- Migration 078: Form Triggers & Schedules
-- ============================================================================
-- Adds support for automatic form triggers (pre/post workout) tied to program
-- templates, and recurring form schedules tied to individual students.
--
-- New tables:
--   program_form_triggers  — links form_templates to program_templates as pre/post workout
--   form_schedules         — recurring form delivery schedules per student
--
-- Altered tables:
--   workout_sessions       — adds pre/post_workout_submission_id references
--   form_submissions       — inbox_item_id becomes nullable, adds trigger_context
-- ============================================================================

-- ============================================================================
-- 1) TABLE: program_form_triggers
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_form_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('pre_workout', 'post_workout')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Max 1 pre_workout + 1 post_workout per program
    UNIQUE (program_template_id, trigger_type)
);

CREATE INDEX IF NOT EXISTS idx_program_form_triggers_program ON program_form_triggers(program_template_id);
CREATE INDEX IF NOT EXISTS idx_program_form_triggers_trainer ON program_form_triggers(trainer_id);

-- updated_at auto-trigger
DROP TRIGGER IF EXISTS set_updated_at_on_program_form_triggers ON program_form_triggers;
CREATE TRIGGER set_updated_at_on_program_form_triggers
    BEFORE UPDATE ON program_form_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE program_form_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_form_triggers_trainer_select
    ON program_form_triggers FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY program_form_triggers_trainer_insert
    ON program_form_triggers FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY program_form_triggers_trainer_update
    ON program_form_triggers FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY program_form_triggers_trainer_delete
    ON program_form_triggers FOR DELETE
    USING (trainer_id = current_trainer_id());

-- ============================================================================
-- 2) TABLE: form_schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    next_due_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate schedule for same student + template + frequency
    UNIQUE (student_id, form_template_id, frequency)
);

CREATE INDEX IF NOT EXISTS idx_form_schedules_next_due ON form_schedules(next_due_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_form_schedules_trainer ON form_schedules(trainer_id);
CREATE INDEX IF NOT EXISTS idx_form_schedules_student ON form_schedules(student_id);

-- updated_at auto-trigger
DROP TRIGGER IF EXISTS set_updated_at_on_form_schedules ON form_schedules;
CREATE TRIGGER set_updated_at_on_form_schedules
    BEFORE UPDATE ON form_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE form_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_schedules_trainer_select
    ON form_schedules FOR SELECT
    USING (trainer_id = current_trainer_id());

CREATE POLICY form_schedules_trainer_insert
    ON form_schedules FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY form_schedules_trainer_update
    ON form_schedules FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

CREATE POLICY form_schedules_trainer_delete
    ON form_schedules FOR DELETE
    USING (trainer_id = current_trainer_id());

CREATE POLICY form_schedules_student_select
    ON form_schedules FOR SELECT
    USING (student_id = current_student_id());

-- ============================================================================
-- 3) ALTER: workout_sessions — add submission references
-- ============================================================================

ALTER TABLE workout_sessions
    ADD COLUMN pre_workout_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
    ADD COLUMN post_workout_submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL;

-- ============================================================================
-- 4) ALTER: form_submissions — nullable inbox_item_id + trigger_context
-- ============================================================================

-- 4a) Drop the existing UNIQUE constraint on inbox_item_id
--     PostgreSQL auto-generated name: form_submissions_inbox_item_id_key
ALTER TABLE form_submissions
    DROP CONSTRAINT form_submissions_inbox_item_id_key;

-- 4b) Make inbox_item_id nullable (was NOT NULL)
ALTER TABLE form_submissions
    ALTER COLUMN inbox_item_id DROP NOT NULL;

-- 4c) Recreate as partial unique index (only for non-null values)
--     Existing rows all have non-null inbox_item_id, so no conflict.
CREATE UNIQUE INDEX idx_form_submissions_inbox_item_unique
    ON form_submissions(inbox_item_id)
    WHERE inbox_item_id IS NOT NULL;

-- 4d) Add trigger_context column
--     Default 'manual' so all existing rows get the correct value.
ALTER TABLE form_submissions
    ADD COLUMN trigger_context TEXT NOT NULL DEFAULT 'manual'
        CHECK (trigger_context IN ('manual', 'pre_workout', 'post_workout', 'recurring'));

-- ============================================================================
-- 5) RPC: get_program_form_triggers
-- ============================================================================
-- Returns active triggers for a program template, with form template details.

CREATE OR REPLACE FUNCTION get_program_form_triggers(
    p_program_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_result JSONB;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can view form triggers';
    END IF;

    IF p_program_template_id IS NULL THEN
        RAISE EXCEPTION 'p_program_template_id is required';
    END IF;

    -- Verify the program belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM program_templates
        WHERE id = p_program_template_id
          AND trainer_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Program template not found for current trainer';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT
            pft.id,
            pft.trigger_type,
            pft.form_template_id,
            pft.is_active,
            ft.title AS form_title,
            ft.category AS form_category,
            ft.version AS form_version
        FROM program_form_triggers pft
        JOIN form_templates ft ON ft.id = pft.form_template_id
        WHERE pft.program_template_id = p_program_template_id
          AND pft.trainer_id = v_trainer_id
          AND pft.is_active = true
        ORDER BY pft.trigger_type
    ) t;

    RETURN jsonb_build_object('ok', true, 'triggers', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION get_program_form_triggers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_program_form_triggers(UUID) TO service_role;

-- ============================================================================
-- 6) RPC: get_active_workout_triggers
-- ============================================================================
-- Given an assigned_program_id, resolves the source template and returns
-- active form triggers with full schema_json for rendering.
-- Callable by both trainers (Training Room) and students (mobile app).

CREATE OR REPLACE FUNCTION get_active_workout_triggers(
    p_assigned_program_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_student_id UUID := current_student_id();
    v_program RECORD;
    v_result JSONB;
BEGIN
    -- Must be either a trainer or a student
    IF v_trainer_id IS NULL AND v_student_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_assigned_program_id IS NULL THEN
        RAISE EXCEPTION 'p_assigned_program_id is required';
    END IF;

    -- Fetch the assigned program with ownership check
    SELECT
        ap.id,
        ap.source_template_id,
        ap.trainer_id,
        ap.student_id
    INTO v_program
    FROM assigned_programs ap
    WHERE ap.id = p_assigned_program_id
      AND (
          (v_trainer_id IS NOT NULL AND ap.trainer_id = v_trainer_id)
          OR
          (v_student_id IS NOT NULL AND ap.student_id = v_student_id)
      );

    IF v_program.id IS NULL THEN
        RAISE EXCEPTION 'Assigned program not found or access denied';
    END IF;

    -- If the program has no source template, there are no triggers
    IF v_program.source_template_id IS NULL THEN
        RETURN jsonb_build_object('ok', true, 'triggers', '[]'::jsonb);
    END IF;

    -- Fetch active triggers from the source program template
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT
            pft.id AS trigger_id,
            pft.trigger_type,
            pft.form_template_id,
            ft.title AS form_title,
            ft.category AS form_category,
            ft.version AS form_version,
            ft.schema_json
        FROM program_form_triggers pft
        JOIN form_templates ft ON ft.id = pft.form_template_id AND ft.is_active = true
        WHERE pft.program_template_id = v_program.source_template_id
          AND pft.is_active = true
        ORDER BY pft.trigger_type
    ) t;

    RETURN jsonb_build_object('ok', true, 'triggers', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_workout_triggers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_workout_triggers(UUID) TO service_role;

-- ============================================================================
-- 7) RPC: submit_inline_form
-- ============================================================================
-- Creates a form_submission without an inbox_item (for pre/post workout forms).
-- Validates answers against the template's schema_json.
-- Returns the created submission_id.

CREATE OR REPLACE FUNCTION submit_inline_form(
    p_form_template_id UUID,
    p_student_id UUID,
    p_trainer_id UUID,
    p_answers_json JSONB,
    p_trigger_context TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION submit_inline_form(UUID, UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_inline_form(UUID, UUID, UUID, JSONB, TEXT) TO service_role;
