-- Add modality column to students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'online'
CHECK (modality IN ('online', 'presential'));

-- Comment on column
COMMENT ON COLUMN public.students.modality IS 'Student training modality: online or presential';
