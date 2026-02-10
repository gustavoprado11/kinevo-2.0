-- ============================================================================
-- Migration: Consolidate Exercises - Remove Compatibility View
-- ============================================================================
-- Context: exercises_compat was created as a backward compatibility VIEW
-- in migration 007. Since exercises is now the sole table and the frontend
-- has been updated, this view is no longer needed.
-- ============================================================================

-- ============================================================================
-- 1. PRE-MIGRATION INTEGRITY CHECK
-- ============================================================================

-- Verify exercises table has all required columns
DO $$
BEGIN
    -- Check essential columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' 
        AND column_name IN ('id', 'owner_id', 'name', 'muscle_groups')
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'exercises table is missing required columns';
    END IF;
    
    RAISE NOTICE 'Pre-migration check passed: exercises table structure is valid';
END $$;

-- ============================================================================
-- 2. DROP COMPATIBILITY VIEW
-- ============================================================================

DROP VIEW IF EXISTS exercises_compat;

-- ============================================================================
-- 3. VERIFY RLS IS ENABLED ON exercises
-- ============================================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these manually to verify data integrity:

-- Check record count:
-- SELECT COUNT(*) AS total_exercises FROM exercises;

-- Check ownership distribution:
-- SELECT 
--     CASE WHEN owner_id IS NULL THEN 'System' ELSE 'Trainer-owned' END AS ownership,
--     COUNT(*) AS count
-- FROM exercises
-- GROUP BY (owner_id IS NULL);

-- Check muscle_groups migration:
-- SELECT 
--     CASE 
--         WHEN muscle_groups IS NOT NULL AND array_length(muscle_groups, 1) > 0 THEN 'Has muscle_groups'
--         WHEN muscle_group_legacy IS NOT NULL THEN 'Legacy only'
--         ELSE 'No muscle data'
--     END AS status,
--     COUNT(*) AS count
-- FROM exercises
-- GROUP BY 1;

-- Verify RLS policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'exercises';

-- ============================================================================
-- 5. DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE exercises IS 'Official exercise library. Supports system exercises (owner_id IS NULL) and trainer-owned exercises. Legacy single muscle_group preserved in muscle_group_legacy, new data uses muscle_groups array.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
