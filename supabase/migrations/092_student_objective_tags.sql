-- Add objective and management_tags columns to students table
-- These support the trainer dashboard improvements (Sprint 1):
--   - objective: displayed as a violet pill in the student header
--   - management_tags: displayed as gray pills for quick categorization

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS management_tags TEXT[] DEFAULT NULL;

-- Allow trainers to read/update these fields (covered by existing RLS policies on students table)
COMMENT ON COLUMN public.students.objective IS 'Student training objective, e.g. "Hipertrofia", "Emagrecimento"';
COMMENT ON COLUMN public.students.management_tags IS 'Trainer-defined tags for quick categorization, e.g. {"VIP", "Presencial 3x"}';
