-- ============================================================================
-- Kinevo — 070 Exercise Knowledge Graph (Phase 0: Schema)
-- ============================================================================
-- Creates 3 new tables for the exercise knowledge graph and adds 2 new
-- columns to the exercises table. No existing data or logic is modified.
-- All tables start empty — seeded in subsequent migrations (071-073).
-- ============================================================================

-- ============================================================================
-- 1) exercise_relationships — Exercise-to-exercise edges
-- ============================================================================

CREATE TABLE exercise_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    target_exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'substitute', 'progression', 'regression', 'variation', 'equipment_alternative'
    )),
    -- Confidence/strength weight (0.0-1.0)
    weight REAL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    -- Provenance: how this edge was created
    source TEXT NOT NULL DEFAULT 'curated' CHECK (source IN (
        'curated', 'algorithmic', 'trainer_pattern', 'imported', 'inferred'
    )),
    -- Optional structured metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate edges
    UNIQUE(source_exercise_id, target_exercise_id, relationship_type),
    -- Prevent self-referencing
    CHECK (source_exercise_id != target_exercise_id)
);

-- Query: "Get all substitutes for exercise X"
CREATE INDEX idx_exercise_rel_source_type
    ON exercise_relationships(source_exercise_id, relationship_type);

-- Query: "Get all exercises that regress TO exercise X"
CREATE INDEX idx_exercise_rel_target_type
    ON exercise_relationships(target_exercise_id, relationship_type);

-- Query: "Get all relationships of type X"
CREATE INDEX idx_exercise_rel_type
    ON exercise_relationships(relationship_type);

-- Query: "Filter by provenance"
CREATE INDEX idx_exercise_rel_source_provenance
    ON exercise_relationships(source) WHERE source != 'curated';

ALTER TABLE exercise_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_relationships_select ON exercise_relationships
    FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_relationships_service ON exercise_relationships
    FOR ALL TO service_role USING (true);

COMMENT ON TABLE exercise_relationships IS
    'Exercise knowledge graph edges: substitute, progression, regression, variation, equipment_alternative';
COMMENT ON COLUMN exercise_relationships.source IS
    'Provenance of how this edge was created (curated, algorithmic, trainer_pattern, imported, inferred)';

-- ============================================================================
-- 2) exercise_synergies — Secondary muscle activation weights
-- ============================================================================

CREATE TABLE exercise_synergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    secondary_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    -- Volume attribution weight (1.0 = full, 0.5 = half)
    weight REAL NOT NULL CHECK (weight > 0 AND weight <= 1),
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(primary_group_id, secondary_group_id),
    CHECK (primary_group_id != secondary_group_id)
);

ALTER TABLE exercise_synergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_synergies_select ON exercise_synergies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_synergies_service ON exercise_synergies
    FOR ALL TO service_role USING (true);

COMMENT ON TABLE exercise_synergies IS
    'Secondary muscle activation weights. Replaces hard-coded SECONDARY_MUSCLE_GROUPS maps.';

-- ============================================================================
-- 3) exercise_condition_constraints — Condition-based exercise safety
-- ============================================================================

CREATE TABLE exercise_condition_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    -- Condition ID from condition-mappings.ts (e.g., 'patellofemoral_pain')
    condition_id TEXT NOT NULL,
    constraint_type TEXT NOT NULL CHECK (constraint_type IN (
        'contraindicated', 'cautious', 'recommended'
    )),
    -- Specific notes (e.g., "limit ROM to 80°")
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(exercise_id, condition_id, constraint_type)
);

CREATE INDEX idx_exercise_condition_exercise
    ON exercise_condition_constraints(exercise_id);
CREATE INDEX idx_exercise_condition_condition
    ON exercise_condition_constraints(condition_id);
CREATE INDEX idx_exercise_condition_type
    ON exercise_condition_constraints(condition_id, constraint_type);

ALTER TABLE exercise_condition_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_condition_constraints_select ON exercise_condition_constraints
    FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_condition_constraints_service ON exercise_condition_constraints
    FOR ALL TO service_role USING (true);

COMMENT ON TABLE exercise_condition_constraints IS
    'Condition-based exercise safety constraints. Promotes condition-mappings.ts to enforced DB constraints.';

-- ============================================================================
-- 4) New columns on exercises table
-- ============================================================================

-- Movement pattern family: groups related patterns for variation queries
-- e.g., squat + lunge = knee_dominant; hinge = hip_dominant
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern_family TEXT
    CHECK (movement_pattern_family IN (
        'knee_dominant',   -- squat, lunge, leg press
        'hip_dominant',    -- hinge, hip thrust, glute bridge
        'horizontal_push', -- bench press, push-up, chest fly
        'vertical_push',   -- overhead press, lateral raise
        'horizontal_pull', -- row variants
        'vertical_pull',   -- pulldown, pull-up, chin-up
        'isolation_upper', -- curls, extensions, raises
        'isolation_lower', -- leg curl, leg extension, calf raise
        'core_stability',  -- plank, pallof, anti-rotation
        'core_flexion'     -- crunch, sit-up, leg raise
    ));

-- Fatigue class: systemic fatigue impact for session ordering and recovery
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS fatigue_class TEXT
    DEFAULT 'moderate' CHECK (fatigue_class IN (
        'high',     -- Heavy compounds (squat, deadlift, bench) — high CNS demand
        'moderate', -- Medium compounds and machines — moderate demand
        'low'       -- Isolation and bodyweight — minimal systemic fatigue
    ));

CREATE INDEX IF NOT EXISTS idx_exercises_pattern_family
    ON exercises(movement_pattern_family) WHERE movement_pattern_family IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_fatigue_class
    ON exercises(fatigue_class) WHERE fatigue_class IS NOT NULL;

COMMENT ON COLUMN exercises.movement_pattern_family IS
    'Groups related movement patterns for cross-pattern variation queries';
COMMENT ON COLUMN exercises.fatigue_class IS
    'Systemic fatigue impact (high/moderate/low) for session ordering and recovery planning';
