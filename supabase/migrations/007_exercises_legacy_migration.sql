-- ============================================================================
-- Migration: Exercises Table for Legacy Data Compatibility
-- ============================================================================
-- This migration updates the exercises table to support:
-- 1. Legacy data format with owner_id instead of trainer_id
-- 2. System exercises (owner_id IS NULL)
-- 3. Bulk insert without triggers
-- 4. New columns: muscle_groups (array), image_url, original_system_id, studio_id
-- ============================================================================

-- ============================================================================
-- 1. ALTER TABLE: Rename trainer_id to owner_id and add new columns
-- ============================================================================

-- Rename trainer_id to owner_id
ALTER TABLE exercises RENAME COLUMN trainer_id TO owner_id;

-- Make owner_id nullable (for system exercises)
ALTER TABLE exercises ALTER COLUMN owner_id DROP NOT NULL;

-- Rename muscle_group (singular) to keep old data, then add new array column
ALTER TABLE exercises RENAME COLUMN muscle_group TO muscle_group_legacy;

-- Add new columns
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS muscle_groups TEXT[];
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS original_system_id UUID;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS studio_id UUID;

-- Migrate data from muscle_group_legacy to muscle_groups array
UPDATE exercises 
SET muscle_groups = ARRAY[muscle_group_legacy]
WHERE muscle_group_legacy IS NOT NULL AND muscle_groups IS NULL;

-- Drop the legacy column (optional - can keep for safety)
-- ALTER TABLE exercises DROP COLUMN muscle_group_legacy;

-- ============================================================================
-- 2. UPDATE INDEXES
-- ============================================================================

-- Drop old index
DROP INDEX IF EXISTS idx_exercises_trainer_id;
DROP INDEX IF EXISTS idx_exercises_muscle_group;
DROP INDEX IF EXISTS idx_exercises_name_search;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_exercises_owner_id ON exercises(owner_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_groups ON exercises USING GIN (muscle_groups);
CREATE INDEX IF NOT EXISTS idx_exercises_name_search ON exercises(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_exercises_studio ON exercises(studio_id) WHERE studio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_system ON exercises(id) WHERE owner_id IS NULL;

-- ============================================================================
-- 3. UPDATE RLS POLICIES
-- ============================================================================

-- Drop all existing exercise policies
DROP POLICY IF EXISTS exercises_trainer_all ON exercises;
DROP POLICY IF EXISTS exercises_student_select ON exercises;

-- New policies for exercises

-- SELECT: Trainer can see their own exercises + system exercises
CREATE POLICY exercises_owner_select ON exercises
    FOR SELECT USING (
        owner_id = current_trainer_id() 
        OR owner_id IS NULL
    );

-- INSERT: Trainer can insert exercises they own
CREATE POLICY exercises_owner_insert ON exercises
    FOR INSERT 
    WITH CHECK (
        owner_id = current_trainer_id()
        OR (owner_id IS NULL AND is_trainer()) -- Allow system inserts from trainer for now
    );

-- UPDATE: Trainer can only update their own exercises (not system)
CREATE POLICY exercises_owner_update ON exercises
    FOR UPDATE USING (
        owner_id = current_trainer_id()
        AND owner_id IS NOT NULL
    );

-- DELETE: Trainer can only delete their own exercises (not system)
CREATE POLICY exercises_owner_delete ON exercises
    FOR DELETE USING (
        owner_id = current_trainer_id()
        AND owner_id IS NOT NULL
    );

-- Students can view exercises from their trainer + system exercises
CREATE POLICY exercises_student_select ON exercises
    FOR SELECT USING (
        owner_id IN (
            SELECT trainer_id FROM students WHERE auth_user_id = auth.uid()
        )
        OR owner_id IS NULL
    );

-- ============================================================================
-- 4. CREATE VIEW FOR BACKWARD COMPATIBILITY (optional)
-- ============================================================================

-- Create a view that provides trainer_id as an alias for owner_id
-- This allows existing queries using trainer_id to continue working
CREATE OR REPLACE VIEW exercises_compat AS
SELECT 
    id,
    owner_id AS trainer_id,  -- Alias for backward compatibility
    owner_id,
    name,
    muscle_groups,
    muscle_group_legacy AS muscle_group,  -- Legacy single value
    equipment,
    video_url,
    image_url,
    thumbnail_url,
    instructions,
    original_system_id,
    studio_id,
    is_archived,
    created_at,
    updated_at
FROM exercises;

-- ============================================================================
-- 5. DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN exercises.owner_id IS 'UUID of the trainer who owns this exercise. NULL for system/global exercises.';
COMMENT ON COLUMN exercises.muscle_groups IS 'Array of muscle groups targeted by this exercise.';
COMMENT ON COLUMN exercises.original_system_id IS 'UUID from the legacy system for migration tracking.';
COMMENT ON COLUMN exercises.studio_id IS 'Studio/gym association if applicable.';
COMMENT ON COLUMN exercises.image_url IS 'Static image URL for the exercise.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
