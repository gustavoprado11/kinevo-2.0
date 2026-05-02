-- ============================================================================
-- Migration 114: Add volume_overrides to student_prescription_profiles
-- ============================================================================
-- Lets the trainer specify weekly set targets per primary muscle group from
-- the AI prescription form. The constraint engine treats each override as an
-- exact target (sets budget min == max == target), running last in the volume
-- pipeline so it wins over level defaults, frequency cuts, and the session
-- capacity cap.
--
-- Storage shape: JSONB object keyed by muscle group name (DB spelling),
-- values are positive integers (weekly sets target).
-- Example: { "Peito": 16, "Glúteo": 14 }
-- ============================================================================

ALTER TABLE public.student_prescription_profiles
    ADD COLUMN IF NOT EXISTS volume_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.student_prescription_profiles.volume_overrides IS
    'Trainer-specified weekly set targets per primary muscle group. Keys are muscle group names (DB spelling), values are positive integers. Empty object means no overrides — system uses computed budget. Applied last in the constraints pipeline so it overrides level/frequency/cap.';
