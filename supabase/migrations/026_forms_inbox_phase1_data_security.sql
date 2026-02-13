-- ============================================================================
-- Kinevo — 026 Forms & Inbox Phase 1 (Data + Security)
-- ============================================================================
-- Implements phase 1 foundations for Forms & Inbox:
-- - Core tables (form templates, inbox items, submissions)
-- - Indexes and updated_at triggers
-- - RLS policies
-- - Private storage bucket for form image uploads
-- - Realtime publication for inbox updates
-- ============================================================================

-- ============================================================================
-- 1) TABLES
-- ============================================================================

-- 1.1 form_templates
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('anamnese', 'checkin', 'survey')),
    schema_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default_for_new_students BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),

    -- AI governance metadata (phase 1 scaffolding)
    created_source TEXT NOT NULL DEFAULT 'manual' CHECK (created_source IN ('manual', 'ai_assisted')),
    ai_generation_version TEXT,
    ai_confidence_score NUMERIC(4,3) CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 1)),
    ai_warnings JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_form_templates_schema_is_object CHECK (jsonb_typeof(schema_json) = 'object'),
    CONSTRAINT chk_form_templates_ai_warnings_is_array CHECK (ai_warnings IS NULL OR jsonb_typeof(ai_warnings) = 'array')
);

COMMENT ON TABLE form_templates IS 'Trainer-owned reusable form templates (anamnese/checkin/survey).';
COMMENT ON COLUMN form_templates.schema_json IS 'Dynamic JSON schema used to render form fields.';
COMMENT ON COLUMN form_templates.created_source IS 'manual or ai_assisted';

-- 1.2 student_inbox_items
CREATE TABLE IF NOT EXISTS student_inbox_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('form_request', 'feedback', 'system_alert', 'text_message')),
    status TEXT NOT NULL CHECK (status IN ('unread', 'pending_action', 'completed', 'archived')),
    title TEXT NOT NULL,
    subtitle TEXT,
    payload JSONB NOT NULL,
    due_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_student_inbox_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE student_inbox_items IS 'Central inbox for student-facing requests, feedback and alerts.';
COMMENT ON COLUMN student_inbox_items.payload IS 'Type-specific JSON payload. Include payload_version for evolution.';

-- 1.3 form_submissions
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
    form_template_version INTEGER NOT NULL CHECK (form_template_version > 0),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    inbox_item_id UUID NOT NULL UNIQUE REFERENCES student_inbox_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'reviewed')),
    schema_snapshot_json JSONB NOT NULL,
    answers_json JSONB,
    submitted_at TIMESTAMPTZ,
    trainer_feedback JSONB,
    feedback_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_form_submissions_schema_snapshot_is_object CHECK (jsonb_typeof(schema_snapshot_json) = 'object'),
    CONSTRAINT chk_form_submissions_answers_is_object CHECK (answers_json IS NULL OR jsonb_typeof(answers_json) = 'object'),
    CONSTRAINT chk_form_submissions_feedback_is_object CHECK (trainer_feedback IS NULL OR jsonb_typeof(trainer_feedback) = 'object')
);

COMMENT ON TABLE form_submissions IS 'Student responses for assigned forms + trainer feedback.';
COMMENT ON COLUMN form_submissions.schema_snapshot_json IS 'Immutable schema snapshot at assignment time.';

-- ============================================================================
-- 2) INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_form_templates_trainer_id ON form_templates(trainer_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(trainer_id, category);
CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(trainer_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_form_templates_schema_gin ON form_templates USING gin (schema_json);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_templates_default_anamnese_per_trainer
    ON form_templates(trainer_id)
    WHERE is_default_for_new_students = true AND category = 'anamnese';

CREATE INDEX IF NOT EXISTS idx_inbox_student_status_created ON student_inbox_items(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_student_type_created ON student_inbox_items(student_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_trainer_created ON student_inbox_items(trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_payload_gin ON student_inbox_items USING gin (payload);
CREATE INDEX IF NOT EXISTS idx_inbox_unread_student ON student_inbox_items(student_id, created_at DESC) WHERE status = 'unread';

CREATE INDEX IF NOT EXISTS idx_submissions_student_created ON form_submissions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_trainer_created ON form_submissions(trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_template_version ON form_submissions(form_template_id, form_template_version);
CREATE INDEX IF NOT EXISTS idx_submissions_status_submitted ON form_submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_answers_gin ON form_submissions USING gin (answers_json);

-- ============================================================================
-- 3) TRIGGERS (updated_at)
-- ============================================================================

-- Reuses public.update_updated_at() from migration 001.
DROP TRIGGER IF EXISTS set_updated_at_on_form_templates ON form_templates;
CREATE TRIGGER set_updated_at_on_form_templates
    BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_student_inbox_items ON student_inbox_items;
CREATE TRIGGER set_updated_at_on_student_inbox_items
    BEFORE UPDATE ON student_inbox_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_on_form_submissions ON form_submissions;
CREATE TRIGGER set_updated_at_on_form_submissions
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4) RLS + POLICIES
-- ============================================================================

ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- 4.1 form_templates (trainer-owned)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_templates' AND policyname = 'form_templates_trainer_select'
    ) THEN
        CREATE POLICY form_templates_trainer_select
        ON form_templates FOR SELECT
        USING (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_templates' AND policyname = 'form_templates_trainer_insert'
    ) THEN
        CREATE POLICY form_templates_trainer_insert
        ON form_templates FOR INSERT
        WITH CHECK (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_templates' AND policyname = 'form_templates_trainer_update'
    ) THEN
        CREATE POLICY form_templates_trainer_update
        ON form_templates FOR UPDATE
        USING (trainer_id = current_trainer_id())
        WITH CHECK (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_templates' AND policyname = 'form_templates_trainer_delete'
    ) THEN
        CREATE POLICY form_templates_trainer_delete
        ON form_templates FOR DELETE
        USING (trainer_id = current_trainer_id());
    END IF;
END $$;

-- 4.2 student_inbox_items (trainer + student visibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_trainer_select'
    ) THEN
        CREATE POLICY student_inbox_items_trainer_select
        ON student_inbox_items FOR SELECT
        USING (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_trainer_insert'
    ) THEN
        CREATE POLICY student_inbox_items_trainer_insert
        ON student_inbox_items FOR INSERT
        WITH CHECK (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_trainer_update'
    ) THEN
        CREATE POLICY student_inbox_items_trainer_update
        ON student_inbox_items FOR UPDATE
        USING (trainer_id = current_trainer_id())
        WITH CHECK (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_trainer_delete'
    ) THEN
        CREATE POLICY student_inbox_items_trainer_delete
        ON student_inbox_items FOR DELETE
        USING (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_student_select'
    ) THEN
        CREATE POLICY student_inbox_items_student_select
        ON student_inbox_items FOR SELECT
        USING (student_id = current_student_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'student_inbox_items' AND policyname = 'student_inbox_items_student_update_status'
    ) THEN
        CREATE POLICY student_inbox_items_student_update_status
        ON student_inbox_items FOR UPDATE
        USING (student_id = current_student_id())
        WITH CHECK (student_id = current_student_id());
    END IF;
END $$;

-- 4.3 form_submissions (trainer + student read at phase 1)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_submissions' AND policyname = 'form_submissions_trainer_select'
    ) THEN
        CREATE POLICY form_submissions_trainer_select
        ON form_submissions FOR SELECT
        USING (trainer_id = current_trainer_id());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'form_submissions' AND policyname = 'form_submissions_student_select'
    ) THEN
        CREATE POLICY form_submissions_student_select
        ON form_submissions FOR SELECT
        USING (student_id = current_student_id());
    END IF;
END $$;

-- ============================================================================
-- 5) GRANTS
-- ============================================================================

-- form_templates
GRANT SELECT, INSERT, UPDATE, DELETE ON form_templates TO authenticated;
GRANT ALL ON form_templates TO service_role;

-- student_inbox_items
GRANT SELECT, INSERT ON student_inbox_items TO authenticated;
GRANT UPDATE (status, read_at, completed_at, archived_at, updated_at) ON student_inbox_items TO authenticated;
GRANT ALL ON student_inbox_items TO service_role;

-- form_submissions
GRANT SELECT ON form_submissions TO authenticated;
GRANT ALL ON form_submissions TO service_role;

-- ============================================================================
-- 6) STORAGE (PRIVATE BUCKET + POLICIES)
-- ============================================================================

-- Private bucket for form file uploads (anamnese/check-ins/surveys).
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Expected path: students/{student_auth_uid}/submissions/{submission_id}/{file_name}

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Students can upload own form files'
    ) THEN
        CREATE POLICY "Students can upload own form files"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'form-uploads'
            AND (storage.foldername(name))[1] = 'students'
            AND (storage.foldername(name))[2] = auth.uid()::text
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Students can read own form files'
    ) THEN
        CREATE POLICY "Students can read own form files"
        ON storage.objects FOR SELECT TO authenticated
        USING (
            bucket_id = 'form-uploads'
            AND (storage.foldername(name))[1] = 'students'
            AND (storage.foldername(name))[2] = auth.uid()::text
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Students can update own form files'
    ) THEN
        CREATE POLICY "Students can update own form files"
        ON storage.objects FOR UPDATE TO authenticated
        USING (
            bucket_id = 'form-uploads'
            AND (storage.foldername(name))[1] = 'students'
            AND (storage.foldername(name))[2] = auth.uid()::text
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Students can delete own form files'
    ) THEN
        CREATE POLICY "Students can delete own form files"
        ON storage.objects FOR DELETE TO authenticated
        USING (
            bucket_id = 'form-uploads'
            AND (storage.foldername(name))[1] = 'students'
            AND (storage.foldername(name))[2] = auth.uid()::text
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Trainers can read linked students form files'
    ) THEN
        CREATE POLICY "Trainers can read linked students form files"
        ON storage.objects FOR SELECT TO authenticated
        USING (
            bucket_id = 'form-uploads'
            AND (storage.foldername(name))[1] = 'students'
            AND EXISTS (
                SELECT 1
                FROM students s
                WHERE s.auth_user_id::text = (storage.foldername(name))[2]
                  AND s.coach_id = current_trainer_id()
            )
        );
    END IF;
END
$$;

-- ============================================================================
-- 7) REALTIME (Inbox updates)
-- ============================================================================

ALTER TABLE student_inbox_items REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'student_inbox_items'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.student_inbox_items;
        END IF;
    END IF;
END
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
