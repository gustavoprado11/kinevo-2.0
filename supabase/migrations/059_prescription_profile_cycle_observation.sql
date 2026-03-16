-- ============================================================================
-- Migration 059: Add cycle_observation to student_prescription_profiles
-- ============================================================================
-- Free-text field for the trainer to provide qualitative context about
-- the current training cycle. Sent to the Claude agent with high priority.
-- ============================================================================

ALTER TABLE public.student_prescription_profiles
    ADD COLUMN IF NOT EXISTS cycle_observation TEXT;

COMMENT ON COLUMN public.student_prescription_profiles.cycle_observation IS 'Trainer observation for the current cycle — sent to the AI agent with high priority';
