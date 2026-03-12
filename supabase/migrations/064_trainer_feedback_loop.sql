-- ============================================================================
-- Migration 064: Trainer Feedback Loop
-- ============================================================================
-- Adds structured diff capture and pattern analysis for the prescription
-- feedback loop. Layer 1: diff at approval time. Layer 2: pattern analysis.

-- Structured diff of trainer edits (original AI output vs final approved version)
ALTER TABLE public.prescription_generations
ADD COLUMN IF NOT EXISTS trainer_edits_diff JSONB DEFAULT NULL;

-- Cached pattern analysis derived from multiple diffs
ALTER TABLE public.trainers
ADD COLUMN IF NOT EXISTS prescription_patterns JSONB DEFAULT NULL;

-- Index for efficient pattern analysis: fetch last N approved generations with diffs
CREATE INDEX IF NOT EXISTS idx_prescriptions_feedback
    ON public.prescription_generations(trainer_id, approved_at DESC)
    WHERE status = 'approved' AND trainer_edits_diff IS NOT NULL;
