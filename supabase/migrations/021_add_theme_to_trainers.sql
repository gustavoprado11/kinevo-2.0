-- ============================================================================
-- Kinevo — Add theme preference to trainers
-- ============================================================================

ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system'
CHECK (theme IN ('light', 'dark', 'system'));
