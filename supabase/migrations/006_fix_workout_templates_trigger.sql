-- ============================================================================
-- Fix: Remove incorrect trigger from workout_templates
-- ============================================================================
-- Problem: workout_templates doesn't have a trainer_id column, but the 
-- set_trainer_id trigger was incorrectly applied to it.
-- Solution: Drop the trigger on workout_templates.
-- ============================================================================

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS set_trainer_id_on_workout_templates ON workout_templates;
