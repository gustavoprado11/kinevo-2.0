-- ============================================================================
-- Kinevo — Exercise Swap schema support
-- ============================================================================

-- 1) Manual substitutes on template and assigned workout items
ALTER TABLE workout_item_templates
ADD COLUMN IF NOT EXISTS substitute_exercise_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE assigned_workout_items
ADD COLUMN IF NOT EXISTS substitute_exercise_ids UUID[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workout_item_templates_substitutes_exercise_only_chk'
    ) THEN
        ALTER TABLE workout_item_templates
        ADD CONSTRAINT workout_item_templates_substitutes_exercise_only_chk
        CHECK (item_type = 'exercise' OR cardinality(substitute_exercise_ids) = 0);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assigned_workout_items_substitutes_exercise_only_chk'
    ) THEN
        ALTER TABLE assigned_workout_items
        ADD CONSTRAINT assigned_workout_items_substitutes_exercise_only_chk
        CHECK (item_type = 'exercise' OR cardinality(substitute_exercise_ids) = 0);
    END IF;
END
$$;

-- 2) Planned vs executed tracking in set logs
ALTER TABLE set_logs
ADD COLUMN IF NOT EXISTS planned_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE set_logs
ADD COLUMN IF NOT EXISTS executed_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE set_logs
ADD COLUMN IF NOT EXISTS swap_source TEXT NOT NULL DEFAULT 'none';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'set_logs_swap_source_chk'
    ) THEN
        ALTER TABLE set_logs
        ADD CONSTRAINT set_logs_swap_source_chk
        CHECK (swap_source IN ('none', 'manual', 'auto'));
    END IF;
END
$$;

-- Backfill for existing logs
UPDATE set_logs sl
SET planned_exercise_id = awi.exercise_id
FROM assigned_workout_items awi
WHERE sl.assigned_workout_item_id = awi.id
  AND sl.planned_exercise_id IS NULL;

UPDATE set_logs
SET executed_exercise_id = exercise_id
WHERE executed_exercise_id IS NULL
  AND exercise_id IS NOT NULL;

UPDATE set_logs
SET swap_source = 'none'
WHERE swap_source IS NULL
   OR swap_source NOT IN ('none', 'manual', 'auto');

-- Helpful indexes for analytics and history lookups
CREATE INDEX IF NOT EXISTS idx_set_logs_planned_exercise_history
ON set_logs(planned_exercise_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_set_logs_executed_exercise_history
ON set_logs(executed_exercise_id, completed_at DESC);

-- 3) RPC: last metrics for one student+exercise
CREATE OR REPLACE FUNCTION get_last_exercise_metrics(
    p_student_id UUID,
    p_exercise_id UUID
)
RETURNS TABLE (
    workout_session_id UUID,
    completed_at TIMESTAMPTZ,
    max_weight NUMERIC,
    avg_weight NUMERIC,
    avg_reps NUMERIC,
    sets_count INTEGER
)
LANGUAGE sql
STABLE
AS $$
    WITH latest_session AS (
        SELECT ws.id, ws.completed_at
        FROM workout_sessions ws
        JOIN set_logs sl
            ON sl.workout_session_id = ws.id
        WHERE ws.student_id = p_student_id
          AND ws.status = 'completed'
          AND sl.is_completed = true
          AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
        ORDER BY ws.completed_at DESC NULLS LAST
        LIMIT 1
    )
    SELECT
        ls.id AS workout_session_id,
        ls.completed_at,
        MAX(sl.weight) AS max_weight,
        AVG(sl.weight) AS avg_weight,
        AVG(sl.reps_completed::NUMERIC) AS avg_reps,
        COUNT(*)::INTEGER AS sets_count
    FROM latest_session ls
    JOIN set_logs sl
        ON sl.workout_session_id = ls.id
    WHERE sl.is_completed = true
      AND COALESCE(sl.executed_exercise_id, sl.exercise_id) = p_exercise_id
    GROUP BY ls.id, ls.completed_at;
$$;

GRANT EXECUTE ON FUNCTION get_last_exercise_metrics(UUID, UUID) TO authenticated;

