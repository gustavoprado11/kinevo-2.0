-- Migration 036: AI Prescription Feature Flag + assigned_programs extension
-- Description:
--   1. Adds feature flag column to trainers table
--   2. Extends assigned_programs status CHECK to include 'draft' for AI-generated programs
--   3. Adds AI metadata columns to assigned_programs
--
-- IMPORTANT: The 'draft' status is critical for the AI prescription flow.
-- Mobile app (useActiveProgram.ts) only queries status='active', so programs
-- with status='draft' are invisible to students until the trainer approves.

-- ============================================================================
-- 1. FEATURE FLAG: trainers.ai_prescriptions_enabled
-- ============================================================================

ALTER TABLE public.trainers
    ADD COLUMN ai_prescriptions_enabled BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. EXTEND assigned_programs.status CHECK to include 'draft'
-- ============================================================================

-- Drop the existing constraint (created in migration 015)
ALTER TABLE public.assigned_programs
    DROP CONSTRAINT assigned_programs_status_check;

-- Re-create with 'draft' added
ALTER TABLE public.assigned_programs
    ADD CONSTRAINT assigned_programs_status_check
    CHECK (status IN ('draft', 'active', 'scheduled', 'completed', 'paused'));

-- ============================================================================
-- 3. AI METADATA on assigned_programs
-- ============================================================================

-- Flag to identify AI-generated programs
ALTER TABLE public.assigned_programs
    ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT false;

-- Back-reference to the prescription generation audit trail
ALTER TABLE public.assigned_programs
    ADD COLUMN prescription_generation_id UUID
        REFERENCES public.prescription_generations(id) ON DELETE SET NULL;

-- Index for looking up AI-generated programs
CREATE INDEX idx_assigned_programs_prescription
    ON public.assigned_programs(prescription_generation_id)
    WHERE prescription_generation_id IS NOT NULL;

-- Index for draft programs (trainer review dashboard)
CREATE INDEX idx_assigned_programs_draft
    ON public.assigned_programs(trainer_id, created_at DESC)
    WHERE status = 'draft';
