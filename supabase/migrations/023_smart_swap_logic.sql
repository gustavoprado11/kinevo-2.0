-- ============================================================================
-- Kinevo — Smart Exercise Swap logic (trigram similarity)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Extensions for similarity matching
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ----------------------------------------------------------------------------
-- 2) Smart substitutes RPC (same muscle group + trigram on cleaned names)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_smart_substitutes(
    target_exercise_id UUID,
    match_limit INTEGER DEFAULT 2
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    image_url TEXT,
    similarity_score REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH target_context AS (
        SELECT
            e.id,
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(UNACCENT(COALESCE(e.name, ''))),
                        '(\mbarra\M|\mhalter\M|\mhalteres\M|\mmaquina\M|\mpolia\M|\mcabo\M|\msmith\M|\mbanco\M|\msentado\M|\mem\s+pe\M|\mdeitado\M|\minclinado\M|\mdeclinado\M|\marticulado\M)',
                        ' ',
                        'g'
                    ),
                    '\s+',
                    ' ',
                    'g'
                )
            ) AS original_clean_name
        FROM exercises e
        WHERE e.id = target_exercise_id
        LIMIT 1
    ),
    target_muscles AS (
        SELECT emg.muscle_group_id
        FROM exercise_muscle_groups emg
        WHERE emg.exercise_id = target_exercise_id
    ),
    candidate_exercises AS (
        SELECT
            e.id,
            e.name,
            e.image_url,
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        LOWER(UNACCENT(COALESCE(e.name, ''))),
                        '(\mbarra\M|\mhalter\M|\mhalteres\M|\mmaquina\M|\mpolia\M|\mcabo\M|\msmith\M|\mbanco\M|\msentado\M|\mem\s+pe\M|\mdeitado\M|\minclinado\M|\mdeclinado\M|\marticulado\M)',
                        ' ',
                        'g'
                    ),
                    '\s+',
                    ' ',
                    'g'
                )
            ) AS candidate_clean_name
        FROM exercises e
        WHERE e.id <> target_exercise_id
          AND EXISTS (
              SELECT 1
              FROM exercise_muscle_groups emg
              JOIN target_muscles tm
                ON tm.muscle_group_id = emg.muscle_group_id
              WHERE emg.exercise_id = e.id
          )
    )
    SELECT
        c.id,
        c.name,
        c.image_url,
        SIMILARITY(t.original_clean_name, c.candidate_clean_name)::REAL AS similarity_score
    FROM candidate_exercises c
    CROSS JOIN target_context t
    ORDER BY similarity_score DESC, c.name ASC
    LIMIT GREATEST(1, COALESCE(match_limit, 2));
END;
$$;

-- Example test in Supabase SQL editor:
-- SELECT * FROM get_smart_substitutes('ID_DO_SUPINO_BARRA', 5);

-- ----------------------------------------------------------------------------
-- 3) Performance indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_exercise_muscle_groups_muscle_group_exercise
ON exercise_muscle_groups(muscle_group_id, exercise_id);

DO $$
BEGIN
    BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exercises_name_unaccent_trgm ON exercises USING gin (LOWER(UNACCENT(name)) gin_trgm_ops)';
    EXCEPTION
        WHEN OTHERS THEN
            -- Fallback when UNACCENT expression is not indexable.
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exercises_name_lower_trgm ON exercises USING gin (LOWER(name) gin_trgm_ops)';
    END;
END
$$;

GRANT EXECUTE ON FUNCTION get_smart_substitutes(UUID, INTEGER) TO authenticated;

