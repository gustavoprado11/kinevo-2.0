-- ============================================================================
-- Migration 041: Fix temporal architecture for workout_sessions
--
-- Problems fixed:
-- 1. Trigger overwrites valid client-provided duration_seconds
-- 2. No safety cap on absurd durations (e.g., 64h44m from stale started_at)
-- 3. No indexes on completed_at (now the canonical timestamp for metrics)
-- 4. No constraint preventing multiple in_progress sessions per workout
-- 5. Corrupted historical data from trigger overwrite bug
-- ============================================================================

-- 1. Fix trigger: respect client-provided duration, add safety cap
CREATE OR REPLACE FUNCTION public.calculate_session_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only auto-calculate if client did NOT provide a valid duration
    IF NEW.status = 'completed'
       AND NEW.completed_at IS NOT NULL
       AND NEW.started_at IS NOT NULL
       AND (NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0)
    THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;

    -- Safety cap: no workout should exceed 6 hours (21600 seconds)
    IF NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds > 21600 THEN
        NEW.duration_seconds = NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Indexes for queries switching to completed_at
CREATE INDEX IF NOT EXISTS idx_ws_student_completed
    ON workout_sessions(student_id, completed_at DESC)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_ws_trainer_completed
    ON workout_sessions(trainer_id, completed_at DESC)
    WHERE status = 'completed';

-- 3. Backfill: null out corrupted durations (>6h)
-- Do NOT alter started_at — preserve historical data as-is
UPDATE workout_sessions
SET duration_seconds = NULL
WHERE duration_seconds > 21600
  AND status = 'completed';

-- 4. Prevent multiple in_progress sessions for the same workout
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_single_in_progress
    ON workout_sessions(student_id, assigned_workout_id)
    WHERE status = 'in_progress';

-- 5. Cleanup function for orphaned in_progress sessions (>24h old)
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected INTEGER;
BEGIN
    UPDATE workout_sessions
    SET status = 'abandoned', updated_at = now()
    WHERE status = 'in_progress'
      AND started_at < now() - INTERVAL '24 hours';

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;
