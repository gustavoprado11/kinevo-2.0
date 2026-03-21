-- ============================================================================
-- Migration 083: Program Reports
-- ============================================================================
-- Creates the program_reports table for storing generated training program
-- reports (metrics snapshot + trainer notes). One report per assigned program.
--
-- Related spec: docs/program-report-spec.md (Phase 1)
-- ============================================================================

-- ============================================================================
-- 1) TABLE: program_reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_program_id UUID NOT NULL REFERENCES assigned_programs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,

    -- Report status
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),

    -- Program snapshot (frozen at generation time)
    program_name TEXT NOT NULL,
    program_duration_weeks INTEGER,
    program_started_at TIMESTAMPTZ,
    program_completed_at TIMESTAMPTZ,

    -- Computed metrics snapshot (immutable after generation)
    metrics_json JSONB NOT NULL DEFAULT '{}',

    -- Trainer observations
    trainer_notes TEXT,

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure metrics_json is a JSON object
    CONSTRAINT chk_program_reports_metrics_is_object
        CHECK (jsonb_typeof(metrics_json) = 'object')
);

COMMENT ON TABLE program_reports IS 'Training program reports with frozen metric snapshots. One report per assigned program.';
COMMENT ON COLUMN program_reports.metrics_json IS 'Immutable JSON snapshot of computed metrics (frequency, volume, RPE, progression, checkins).';

-- ============================================================================
-- 2) INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_program_reports_student ON program_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_program_reports_trainer ON program_reports(trainer_id);

-- Max 1 report per assigned program
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_reports_unique_program
    ON program_reports(assigned_program_id);

-- ============================================================================
-- 3) TRIGGER: updated_at
-- ============================================================================

-- Reuses public.update_updated_at() from migration 001.
DROP TRIGGER IF EXISTS set_updated_at ON program_reports;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON program_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4) RLS + POLICIES
-- ============================================================================

ALTER TABLE program_reports ENABLE ROW LEVEL SECURITY;

-- Trainer manages own reports (CRUD)
CREATE POLICY program_reports_trainer_all ON program_reports
    FOR ALL USING (trainer_id = current_trainer_id());

-- Student views only published reports for their programs
CREATE POLICY program_reports_student_select ON program_reports
    FOR SELECT USING (
        status = 'published'
        AND student_id = current_student_id()
    );

-- ============================================================================
-- 5) GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON program_reports TO authenticated;
GRANT ALL ON program_reports TO service_role;
