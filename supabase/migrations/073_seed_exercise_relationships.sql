-- ============================================================================
-- Kinevo — 073 Seed Exercise Relationships (Phase 1c)
-- ============================================================================
-- Populates exercise_relationships with substitute edges derived from the
-- existing get_smart_substitutes() trigram RPC (migration 023).
--
-- Strategy:
--   - Only seed from curated exercises (is_ai_curated = true)
--   - Only keep edges with similarity_score >= 0.3
--   - Mark source as 'algorithmic' (auto-generated, not hand-curated)
--   - Top 3 substitutes per exercise
-- ============================================================================

INSERT INTO exercise_relationships (
    source_exercise_id,
    target_exercise_id,
    relationship_type,
    weight,
    source
)
SELECT
    e.id AS source_exercise_id,
    sub.id AS target_exercise_id,
    'substitute',
    sub.similarity_score,
    'algorithmic'
FROM exercises e
CROSS JOIN LATERAL get_smart_substitutes(e.id, 3) sub
WHERE e.is_ai_curated = true
  AND sub.similarity_score >= 0.3
ON CONFLICT (source_exercise_id, target_exercise_id, relationship_type) DO NOTHING;

-- ============================================================================
-- Equipment alternative edges for curated exercises sharing the same
-- movement_pattern but different equipment
-- ============================================================================

INSERT INTO exercise_relationships (
    source_exercise_id,
    target_exercise_id,
    relationship_type,
    weight,
    source
)
SELECT DISTINCT
    e1.id,
    e2.id,
    'equipment_alternative',
    0.7,
    'algorithmic'
FROM exercises e1
JOIN exercises e2
    ON e1.id != e2.id
    AND e1.movement_pattern = e2.movement_pattern
    AND e1.movement_pattern IS NOT NULL
    AND e1.equipment != e2.equipment
    AND e1.equipment IS NOT NULL
    AND e2.equipment IS NOT NULL
-- Same primary muscle group
JOIN exercise_muscle_groups emg1 ON emg1.exercise_id = e1.id
JOIN exercise_muscle_groups emg2 ON emg2.exercise_id = e2.id
    AND emg1.muscle_group_id = emg2.muscle_group_id
WHERE e1.is_ai_curated = true
  AND e2.is_ai_curated = true
  -- Avoid duplicates: only insert where e1.id < e2.id (bidirectional)
  AND e1.id < e2.id
ON CONFLICT (source_exercise_id, target_exercise_id, relationship_type) DO NOTHING;

-- Insert the reverse direction for equipment alternatives
INSERT INTO exercise_relationships (
    source_exercise_id,
    target_exercise_id,
    relationship_type,
    weight,
    source
)
SELECT
    target_exercise_id,
    source_exercise_id,
    'equipment_alternative',
    weight,
    'algorithmic'
FROM exercise_relationships
WHERE relationship_type = 'equipment_alternative'
  AND source = 'algorithmic'
ON CONFLICT (source_exercise_id, target_exercise_id, relationship_type) DO NOTHING;
