-- ============================================================================
-- Migration 137: Hierarchy for muscle_groups
-- ============================================================================
-- Adds parent_id to muscle_groups so we can model "Mobilidade Geral" as a
-- parent with specific subgroups (Torácica, Ombro, Tornozelo, Quadril, ...).
-- Filtering by a parent should include all descendants (handled at the
-- application layer for now).
-- ============================================================================

-- 1. Schema change
ALTER TABLE public.muscle_groups
  ADD COLUMN IF NOT EXISTS parent_id UUID
    REFERENCES public.muscle_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_muscle_groups_parent_id
  ON public.muscle_groups(parent_id) WHERE parent_id IS NOT NULL;

COMMENT ON COLUMN public.muscle_groups.parent_id IS
  'Optional parent group. When set, this group is a sub-category (e.g. "Mobilidade Quadril" under "Mobilidade"). Application filters on the parent should include all descendants.';

-- 2. Seed the 4 initial subgroups of Mobilidade (idempotent — only inserts if
-- 'Mobilidade' parent exists and the child name doesn't already exist).
INSERT INTO public.muscle_groups (name, owner_id, parent_id)
SELECT v.n, NULL, mob.id
FROM (VALUES
  ('Mobilidade Torácica'),
  ('Mobilidade Ombro'),
  ('Mobilidade Tornozelo'),
  ('Mobilidade Quadril')
) AS v(n)
CROSS JOIN (SELECT id FROM public.muscle_groups WHERE name = 'Mobilidade' AND owner_id IS NULL LIMIT 1) mob
WHERE NOT EXISTS (
  SELECT 1 FROM public.muscle_groups WHERE name = v.n
);
