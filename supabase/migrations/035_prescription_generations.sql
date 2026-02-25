-- Migration 035: Prescription Generations (Audit Trail)
-- Description: Creates the prescription_generations table to track every AI-generated
-- program. Stores input/output snapshots for debugging, quality metrics, and approval status.

-- ============================================================================
-- TABLE: prescription_generations
-- ============================================================================

CREATE TABLE public.prescription_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    trainer_id UUID NOT NULL
        REFERENCES public.trainers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL
        REFERENCES public.students(id) ON DELETE CASCADE,

    -- Link to the generated program (set after assigned_program is created)
    assigned_program_id UUID
        REFERENCES public.assigned_programs(id) ON DELETE SET NULL,

    -- AI mode and model used
    ai_mode_used TEXT NOT NULL
        CHECK (ai_mode_used IN ('auto', 'copilot', 'assistant')),
    ai_model TEXT NOT NULL,
    ai_source TEXT NOT NULL DEFAULT 'llm'
        CHECK (ai_source IN ('llm', 'heuristic')),

    -- Input/Output snapshots for debugging and replay
    input_snapshot JSONB NOT NULL,
    output_snapshot JSONB,
    rules_violations JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(rules_violations) = 'array'),

    -- Approval workflow
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'approved', 'rejected', 'expired')),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Quality metrics (PRD §6.3)
    trainer_edits_count INTEGER NOT NULL DEFAULT 0,
    generation_time_ms INTEGER,
    confidence_score NUMERIC(4,3)
        CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),

    -- TTL for snapshot cleanup
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_prescriptions_trainer
    ON public.prescription_generations(trainer_id);

CREATE INDEX idx_prescriptions_student
    ON public.prescription_generations(student_id);

-- Fast lookup for pending reviews dashboard
CREATE INDEX idx_prescriptions_pending
    ON public.prescription_generations(trainer_id, created_at DESC)
    WHERE status = 'pending_review';

-- Link back to assigned program
CREATE INDEX idx_prescriptions_program
    ON public.prescription_generations(assigned_program_id)
    WHERE assigned_program_id IS NOT NULL;

-- Future cleanup job: find expired snapshots
CREATE INDEX idx_prescriptions_expires
    ON public.prescription_generations(expires_at)
    WHERE status IN ('approved', 'rejected', 'expired');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.prescription_generations ENABLE ROW LEVEL SECURITY;

-- Trainer manages their own prescription generations
CREATE POLICY "Trainer manages own prescription generations"
    ON public.prescription_generations FOR ALL
    USING (trainer_id = public.current_trainer_id())
    WITH CHECK (trainer_id = public.current_trainer_id());

-- ============================================================================
-- TRIGGER: auto-update updated_at
-- ============================================================================

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.prescription_generations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
