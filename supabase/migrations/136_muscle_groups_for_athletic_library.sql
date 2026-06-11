-- ============================================================================
-- Migration 136: Add "Agilidade/Drill" muscle_group
-- ============================================================================
-- Adds one new muscle_group needed to classify sprint mechanics drills
-- (e.g., wall drills) from the Lucas Damiani video library.
--
-- Pliometria, Posterior de Coxa and Potência already exist in the catalog.
-- ============================================================================

-- muscle_groups doesn't have a unique constraint on name, so we use NOT EXISTS
-- instead of ON CONFLICT for idempotency.
INSERT INTO public.muscle_groups (name)
SELECT 'Agilidade/Drill'
WHERE NOT EXISTS (
  SELECT 1 FROM public.muscle_groups WHERE name = 'Agilidade/Drill'
);
