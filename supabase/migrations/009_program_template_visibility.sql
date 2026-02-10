-- ============================================================================
-- Migration: Program Template Visibility
-- ============================================================================
-- Adds is_template flag to differentiate reusable templates from 
-- student-exclusive programs.
-- ============================================================================

-- Add is_template column (default true for backwards compatibility)
ALTER TABLE program_templates 
    ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT true;

-- Index for filtering templates in library
CREATE INDEX IF NOT EXISTS idx_program_templates_is_template 
    ON program_templates(trainer_id, is_template) 
    WHERE is_template = true;

-- Comment for documentation
COMMENT ON COLUMN program_templates.is_template IS 
    'true = reusable template visible in library, false = student-exclusive program';
