# Exercise Knowledge Graph — Architecture & Migration Plan

> **Status:** Design phase — no code changes yet
> **Date:** 2026-03-09
> **Prerequisite:** EXERCISE_SYSTEM_ANALYSIS.md (completed audit)

---

## 1. Current System Summary

### What exists today

Kinevo has a **strong implicit exercise knowledge graph** distributed across 8+ modules.
The knowledge is real, curated, and battle-tested — but it is not centralized.

#### Duplicated synergy maps (identical data in 2 files)

`rules-engine.ts` line 625 and `program-builder.ts` line 607 both define:

```typescript
'Quadríceps':        [{ group: 'Glúteo', weight: 1.0 }]
'Posterior de Coxa': [{ group: 'Glúteo', weight: 1.0 }]
'Peito':             [{ group: 'Ombros', weight: 0.5 }, { group: 'Tríceps', weight: 0.5 }]
'Costas':            [{ group: 'Bíceps', weight: 0.5 }]
'Ombros':            [{ group: 'Tríceps', weight: 0.5 }]
```

#### Condition knowledge (not fully enforced)

`condition-mappings.ts` defines `contraindicated_patterns` for 10 clinical conditions,
but only `acl_post_op` actually has a non-empty array (`['lunge']`). The remaining 9
conditions have `contraindicated_patterns: []` — the restriction rules exist only as
free-text `prescription_rules` passed to the AI prompt, not as programmatic filters.

#### Exercise substitution (database-level, not type-safe)

`get_smart_substitutes()` in migration 023 uses trigram similarity on cleaned exercise
names + shared muscle groups. It works but has no concept of:
- Movement pattern compatibility
- Equipment alternatives
- Difficulty progression
- Condition safety

#### Exercise scoring (application-level, single module)

`exercise-selector.ts` scores exercises on 4 dimensions (safety 35%, novelty 25%,
difficulty 20%, preference 20%) but cannot query relationships like
"find the beginner regression of this exercise" or "find the dumbbell variant."

#### Trainer preferences (learned, not reusable)

`trainer-patterns.ts` detects A→B replacement patterns from edit history,
but these patterns are stored as `TrainerPatterns` JSONB on the trainer row,
not as reusable graph edges.

### What's missing

| Capability | Status |
|---|---|
| Exercise → Substitute at library level | Only on workout items, not exercise nodes |
| Exercise → Progression/Regression chains | Not modeled |
| Exercise → Variation families | Not modeled |
| Condition → Contraindicated exercises (enforced) | Patterns defined but not filtered in selector |
| Equipment → Alternative exercise variants | Implicit in name similarity only |
| Secondary synergy map | Duplicated in 2 files, hard-coded |
| Centralized graph query API | Does not exist |

---

## 2. Proposed Graph Architecture

### Design principle: Relational edges, not a graph database

Kinevo runs on PostgreSQL (Supabase). The knowledge graph should use a **normalized
relational edge table** — not a graph database. This gives us:

- Zero new infrastructure
- Standard SQL joins and indexes
- RLS compatibility
- Supabase dashboard visibility
- Trivial backup/restore

### Architecture diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXERCISE KNOWLEDGE GRAPH                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    exercise_relationships                        │  │
│  │  source_exercise_id ──[type, weight, metadata]──▶ target_id     │  │
│  │                                                                  │  │
│  │  Types: substitute, progression, regression, variation,          │  │
│  │         same_pattern, equipment_alternative                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    exercise_synergies                            │  │
│  │  primary_group ──[secondary_group, weight]                      │  │
│  │  (replaces hard-coded SECONDARY_MUSCLE_GROUPS maps)             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              exercise_condition_constraints                      │  │
│  │  exercise_id ──[condition_id, constraint_type, metadata]        │  │
│  │  (promotes condition-mappings.ts to enforced DB constraints)     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  exercise-graph.ts                               │  │
│  │  Centralized graph service consumed by:                         │  │
│  │    • exercise-selector.ts (scored candidates)                   │  │
│  │    • program-builder.ts (substitutes, synergies)                │  │
│  │    • rules-engine.ts (volume accounting, validation)            │  │
│  │    • AI generation pipeline (graph-enriched exercise pool)      │  │
│  │    • swap UI (smart substitutes)                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Existing tables (unchanged):                                          │
│    exercises, muscle_groups, exercise_muscle_groups                    │
│    (node properties remain on these tables)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### What stays as node properties (NOT separate tables)

These are attributes of the exercise node — not relationships between nodes.
They should remain as columns on the `exercises` table:

| Property | Column | Reason |
|---|---|---|
| Equipment | `exercises.equipment` | 1:1 attribute, not an edge |
| Difficulty | `exercises.difficulty_level` | Scalar enum, not a relationship |
| Session position | `exercises.session_position` | Scalar enum |
| Movement pattern | `exercises.movement_pattern` | Scalar enum (could become FK in future) |
| Movement pattern family | `exercises.movement_pattern_family` | Groups related patterns (e.g., squat+lunge = "knee_dominant"). Enables variation queries across patterns. **NEW** |
| Fatigue class | `exercises.fatigue_class` | Systemic fatigue impact (high/moderate/low). Used for session ordering and recovery planning. **NEW** |
| AI curation flag | `exercises.is_ai_curated` | Boolean flag |
| Prescription notes | `exercises.prescription_notes` | Free text |

### What becomes a first-class table

| Concept | Current location | New table |
|---|---|---|
| Exercise-to-exercise relationships | UUID[] on workout items + trigram RPC | `exercise_relationships` |
| Secondary muscle synergies | Hard-coded TS maps (2 copies) | `exercise_synergies` |
| Condition-based constraints | TS condition-mappings (partially enforced) | `exercise_condition_constraints` |

### What stays as-is (not moved to graph)

| Concept | Reason to keep |
|---|---|
| `exercise_muscle_groups` junction table | Already normalized. IS the primary graph edge. |
| Trainer patterns (`TrainerPatterns` JSONB) | Learned per-trainer, not library knowledge. Can feed graph edges in future. |
| Volume budgets, split templates | Constraint logic, not exercise relationships |
| Scoring weights in exercise-selector | Algorithm parameters, not graph data |

---

## 3. Relationship Taxonomy

### 3.1 Exercise-to-Exercise relationships (`exercise_relationships`)

| `relationship_type` | Direction | Meaning | Example |
|---|---|---|---|
| `substitute` | Bidirectional | Same muscle group, similar function, interchangeable | Supino Reto Barra ↔ Supino Reto Halter |
| `progression` | Directed | Harder/more complex version | Agachamento Goblet → Agachamento Livre |
| `regression` | Directed | Easier/safer version | Agachamento Livre → Leg Press 45 |
| `variation` | Bidirectional | Same base movement, different angle/grip/stance | Supino Reto → Supino Inclinado |
| `equipment_alternative` | Bidirectional | Same movement, different equipment | Remada Barra → Remada Máquina |

**Relationship provenance (`source` column):**

Every edge records HOW it was created, enabling quality filtering and trust scoring:

| `source` | Meaning | Trust level |
|---|---|---|
| `curated` | Hand-curated by Kinevo team | Highest — always trusted |
| `algorithmic` | Auto-generated by trigram RPC or seeding scripts | High — validated at seed time |
| `trainer_pattern` | Promoted from recurring trainer A→B swap patterns | Medium — requires review |
| `imported` | Bulk-imported from external exercise dataset | Medium — requires validation |
| `inferred` | Graph analysis (e.g., transitive closure) | Low — future, experimental |

Queries can filter by `source` when trust matters (e.g., `WHERE source IN ('curated', 'algorithmic')`).

**Directionality rule:** `substitute`, `variation`, and `equipment_alternative` are
bidirectional (if A→B exists, B→A is implied). `progression` and `regression` are
directed (A→B does NOT imply B→A; B→A would be the inverse relationship type).

### 3.2 Secondary muscle synergies (`exercise_synergies`)

| `primary_group` | `secondary_group` | `weight` | Meaning |
|---|---|---|---|
| Quadríceps | Glúteo | 1.0 | Quad compounds fully activate glutes |
| Posterior de Coxa | Glúteo | 1.0 | Hinge compounds fully activate glutes |
| Peito | Ombros | 0.5 | Press compounds half-activate shoulders |
| Peito | Tríceps | 0.5 | Press compounds half-activate triceps |
| Costas | Bíceps | 0.5 | Pull compounds half-activate biceps |
| Ombros | Tríceps | 0.5 | Overhead press half-activates triceps |

This is the exact data currently duplicated in `rules-engine.ts:625` and
`program-builder.ts:607`. Moving it to a table eliminates the duplication
and makes it editable without code changes.

### 3.3 Condition-based exercise constraints (`exercise_condition_constraints`)

| `constraint_type` | Meaning | Example |
|---|---|---|
| `contraindicated` | Exercise MUST NOT be prescribed for this condition | Lunge exercises for ACL post-op |
| `cautious` | Exercise CAN be prescribed with modified parameters | Deep squat for meniscus (limit ROM) |
| `recommended` | Exercise is specifically GOOD for this condition | Glute med work for patellofemoral pain |

This promotes `condition-mappings.ts` from prompt-only text to **enforceable
constraints** in the exercise selection pipeline.

---

## 4. Database Schema

### 4.1 `exercise_relationships`

```sql
CREATE TABLE exercise_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    target_exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'substitute', 'progression', 'regression', 'variation', 'equipment_alternative'
    )),
    -- Confidence/strength weight (0.0-1.0). Higher = stronger relationship.
    -- For substitutes: similarity score. For progressions: difficulty delta.
    weight REAL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    -- Provenance: how this edge was created
    source TEXT NOT NULL DEFAULT 'curated' CHECK (source IN (
        'curated',           -- Hand-curated by Kinevo team
        'algorithmic',       -- Generated by trigram RPC or automated seeding
        'trainer_pattern',   -- Promoted from trainer edit patterns
        'imported',          -- Bulk-imported from external dataset
        'inferred'           -- Inferred by graph analysis (future)
    )),
    -- Optional structured metadata (e.g., equipment context, difficulty delta)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate edges
    UNIQUE(source_exercise_id, target_exercise_id, relationship_type),
    -- Prevent self-referencing
    CHECK (source_exercise_id != target_exercise_id)
);

-- Query pattern 1: "Get all substitutes for exercise X"
CREATE INDEX idx_exercise_rel_source_type
    ON exercise_relationships(source_exercise_id, relationship_type);

-- Query pattern 2: "Get all exercises that regress TO exercise X"
CREATE INDEX idx_exercise_rel_target_type
    ON exercise_relationships(target_exercise_id, relationship_type);

-- Query pattern 3: "Get all relationships of type X" (for bulk analysis)
CREATE INDEX idx_exercise_rel_type
    ON exercise_relationships(relationship_type);

-- RLS: read-only for authenticated users (relationships are library-level)
ALTER TABLE exercise_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_relationships_select ON exercise_relationships
    FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_relationships_service ON exercise_relationships
    FOR ALL TO service_role USING (true);
```

### 4.2 `exercise_synergies`

```sql
CREATE TABLE exercise_synergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    secondary_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    -- Volume attribution weight (e.g., 1.0 = full, 0.5 = half)
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
```

### 4.3 `exercise_condition_constraints`

```sql
CREATE TABLE exercise_condition_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    -- Condition ID from condition-mappings.ts (e.g., 'patellofemoral_pain')
    condition_id TEXT NOT NULL,
    constraint_type TEXT NOT NULL CHECK (constraint_type IN (
        'contraindicated', 'cautious', 'recommended'
    )),
    -- Optional: specific notes (e.g., "limit ROM to 80°")
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(exercise_id, condition_id, constraint_type)
);

CREATE INDEX idx_exercise_condition_exercise
    ON exercise_condition_constraints(exercise_id);
CREATE INDEX idx_exercise_condition_condition
    ON exercise_condition_constraints(condition_id);

ALTER TABLE exercise_condition_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_condition_constraints_select ON exercise_condition_constraints
    FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_condition_constraints_service ON exercise_condition_constraints
    FOR ALL TO service_role USING (true);
```

### Query strategy

| Query | Index used | Expected rows |
|---|---|---|
| `WHERE source_exercise_id = X AND relationship_type = 'substitute'` | `idx_exercise_rel_source_type` | 2-5 |
| `WHERE target_exercise_id = X AND relationship_type = 'regression'` | `idx_exercise_rel_target_type` | 1-3 |
| `WHERE condition_id = 'lumbar_disc' AND constraint_type = 'contraindicated'` | `idx_exercise_condition_condition` | 5-20 |
| `WHERE primary_group_id = X` on synergies | Primary key scan (small table) | 1-3 |

All queries hit indexed lookups. The `exercise_relationships` table will have
~500-2000 rows at maturity. `exercise_synergies` will have ~6 rows.
`exercise_condition_constraints` will have ~50-100 rows. Performance is not a concern.

---

## 5. Graph Service Design

### File: `web/src/lib/prescription/exercise-graph.ts`

This is the **single entry point** for all graph queries. Every module that currently
has hard-coded relationship logic will import from this service instead.

### API surface

```typescript
// ============================================================================
// Exercise-to-Exercise Relationships
// ============================================================================

/** Get substitute exercises (same function, interchangeable) */
getSubstitutes(exerciseId: string): Promise<GraphExerciseEdge[]>

/** Get progression chain (harder versions) */
getProgressions(exerciseId: string): Promise<GraphExerciseEdge[]>

/** Get regression chain (easier/safer versions) */
getRegressions(exerciseId: string): Promise<GraphExerciseEdge[]>

/** Get all variations (different angle/grip/stance) */
getVariations(exerciseId: string): Promise<GraphExerciseEdge[]>

/** Get equipment alternatives (same movement, different equipment) */
getEquipmentAlternatives(exerciseId: string): Promise<GraphExerciseEdge[]>

/** Get all relationships of any type for an exercise */
getRelationships(exerciseId: string, type?: RelationshipType): Promise<GraphExerciseEdge[]>

// ============================================================================
// Condition Safety
// ============================================================================

/** Get exercises contraindicated for a condition */
getContraindicatedExercises(conditionId: string): Promise<string[]>

/** Get exercises recommended for a condition */
getRecommendedExercises(conditionId: string): Promise<GraphConditionEdge[]>

/** Check if an exercise is safe for a set of conditions */
isExerciseSafe(exerciseId: string, conditionIds: string[]): Promise<SafetyResult>

/** Filter an exercise pool by condition safety */
filterBySafety(
    exerciseIds: string[],
    conditionIds: string[],
): Promise<{ safe: string[]; cautious: string[]; contraindicated: string[] }>

// ============================================================================
// Synergies (Secondary Muscle Activation)
// ============================================================================

/** Get secondary muscle activations for a primary group */
getSynergies(primaryGroupId: string): Promise<SynergyEdge[]>

/** Get the full synergy map (all groups) — replaces hard-coded maps */
getAllSynergies(): Promise<Map<string, SynergyEdge[]>>

// ============================================================================
// Composite Queries (used by prescription pipeline)
// ============================================================================

/**
 * Get a condition-safe, equipment-filtered, scored candidate pool.
 * This replaces the current flow of: fetch all → filter equipment →
 * score in selector → hope the AI respects conditions.
 */
getCandidatePool(params: {
    equipmentTypes: string[]
    conditionIds: string[]
    excludeExerciseIds: string[]
    favoriteExerciseIds: string[]
}): Promise<GraphScoredExercise[]>

/**
 * For a stalled exercise, find the best variation or progression.
 * Uses the graph to traverse: stalled → variation/progression →
 * filter by equipment + safety → return ranked alternatives.
 */
findVariationForStalled(
    stalledExerciseId: string,
    equipmentTypes: string[],
    conditionIds: string[],
): Promise<GraphExerciseEdge[]>
```

### How each existing module would use the graph service

| Module | Current approach | Graph approach |
|---|---|---|
| **exercise-selector.ts** | Scores all exercises with 4 factors | Receives pre-filtered candidate pool from `getCandidatePool()`. Safety score uses `isExerciseSafe()` instead of just checking `prohibited_exercise_ids`. |
| **rules-engine.ts** | Hard-coded `SECONDARY_MUSCLE_GROUPS` map for volume computation | Calls `getAllSynergies()` once, caches for the validation pass. Same logic, single source of truth. |
| **program-builder.ts** | Duplicated `BUILDER_SECONDARY_MAP` for overflow capping | Same: calls `getAllSynergies()`. Eliminates the duplicate map. |
| **AI generation pipeline** | Sends full exercise pool to LLM, hopes it respects conditions | Sends `getCandidatePool()` result — smaller pool, already condition-safe, with graph-derived substitutes pre-attached. |
| **Swap UI** | Calls `get_smart_substitutes()` RPC (trigram only) | Calls `getSubstitutes()` first (graph edges). Falls back to trigram RPC for exercises without curated edges. |
| **context-enricher.ts** | Detects stalled exercises but can't suggest alternatives | Calls `findVariationForStalled()` to suggest graph-backed variations. |

---

## 6. Migration Plan

### Phase 0 — Schema only (zero logic changes)

**Goal:** Create the 3 new tables. No existing code changes. No feature flags needed.

**Migration file:** `070_exercise_knowledge_graph.sql`

Actions:
1. Create `exercise_relationships` table with indexes, RLS, and `source` provenance column
2. Create `exercise_synergies` table with RLS
3. Create `exercise_condition_constraints` table with indexes and RLS
4. Add `movement_pattern_family` column to `exercises` table
5. Add `fatigue_class` column to `exercises` table

**Risk:** None. Empty tables and nullable columns have no effect on the system.

**Validation:** Tables exist, RLS policies work, indexes created.

---

### Phase 1 — Seed from existing knowledge

**Goal:** Populate graph edges from existing hard-coded data. No code changes yet.

**Migration/seed files:** `071_seed_exercise_synergies.sql`, `072_seed_condition_constraints.sql`

#### 1a. Seed `exercise_synergies` from the hard-coded maps

```sql
-- Exact data from rules-engine.ts:625 and program-builder.ts:607
INSERT INTO exercise_synergies (primary_group_id, secondary_group_id, weight)
SELECT pg.id, sg.id, synergy.weight
FROM (VALUES
    ('Quadríceps', 'Glúteo', 1.0),
    ('Posterior de Coxa', 'Glúteo', 1.0),
    ('Peito', 'Ombros', 0.5),
    ('Peito', 'Tríceps', 0.5),
    ('Costas', 'Bíceps', 0.5),
    ('Ombros', 'Tríceps', 0.5)
) AS synergy(primary_name, secondary_name, weight)
JOIN muscle_groups pg ON pg.name = synergy.primary_name
JOIN muscle_groups sg ON sg.name = synergy.secondary_name
ON CONFLICT DO NOTHING;
```

#### 1b. Seed `exercise_condition_constraints` from condition-mappings.ts

For each condition with `contraindicated_patterns`, find matching exercises:

```sql
-- ACL post-op: lunge pattern exercises are contraindicated
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT e.id, 'acl_post_op', 'contraindicated', 'Padrão lunge contraindicado pós-LCA'
FROM exercises e
WHERE e.movement_pattern = 'lunge'
ON CONFLICT DO NOTHING;
```

For conditions with `cautious_muscle_groups`, find exercises targeting those groups:

```sql
-- Patellofemoral: quad exercises require caution
INSERT INTO exercise_condition_constraints (exercise_id, condition_id, constraint_type, notes)
SELECT DISTINCT e.id, 'patellofemoral_pain', 'cautious',
    'Limitar flexão de joelho a 80°. Preferir cadeia fechada.'
FROM exercises e
JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id
JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
WHERE mg.name = 'Quadríceps'
ON CONFLICT DO NOTHING;
```

#### 1c. Seed `exercise_relationships` from smart swap RPC

Run `get_smart_substitutes()` for each curated exercise and insert high-confidence
results as `substitute` edges:

```sql
-- Populate substitute edges from existing trigram-based smart swap logic
INSERT INTO exercise_relationships (source_exercise_id, target_exercise_id, relationship_type, weight)
SELECT
    e.id AS source_exercise_id,
    sub.id AS target_exercise_id,
    'substitute',
    sub.similarity_score
FROM exercises e
CROSS JOIN LATERAL get_smart_substitutes(e.id, 3) sub
WHERE e.is_ai_curated = true
  AND sub.similarity_score >= 0.3
ON CONFLICT DO NOTHING;
```

**Risk:** Low. Seed data is derived from existing knowledge. Tables are read-only
for the application at this phase.

**Validation:** Spot-check 10 exercises and verify substitute edges make sense.

---

### Phase 2 — Graph service (read-only, alongside existing logic)

**Goal:** Create `exercise-graph.ts` with all query functions. Existing modules
do NOT consume it yet. Add integration tests.

Actions:
1. Create `exercise-graph.ts` with full API surface
2. Write integration tests that query the graph and verify results
3. Add a diagnostic endpoint or script to compare graph results against
   current hard-coded behavior

**Risk:** None. New code, not wired to production.

**Validation:** Tests pass. Diagnostic shows graph output matches hard-coded maps.

---

### Phase 3 — Gradual module migration

**Goal:** Replace hard-coded logic with graph queries, one module at a time.
Each replacement is individually deployable and revertable.

#### 3a. Replace synergy maps (lowest risk)

Modify `rules-engine.ts` and `program-builder.ts` to call `getAllSynergies()`
instead of using hard-coded `SECONDARY_MUSCLE_GROUPS` / `BUILDER_SECONDARY_MAP`.

```
Before: const secondaries = SECONDARY_MUSCLE_GROUPS[group] || []
After:  const secondaries = synergyMap.get(group) || []
        // where synergyMap = await getAllSynergies() at function entry
```

**Revert strategy:** Restore the hard-coded maps (git revert).

#### 3b. Add condition safety to exercise selector

Modify `exercise-selector.ts` to call `filterBySafety()` before scoring.
This enforces `contraindicated_patterns` that are currently defined but not filtered.

```
Before: Filter only by prohibited_exercise_ids + disliked_exercise_ids
After:  Also filter by graph contraindications for the student's conditions
```

**Revert strategy:** Remove the filterBySafety call.

#### 3c. Upgrade smart swap UI

Modify the swap action to query `getSubstitutes()` first, then fall back to
the existing `get_smart_substitutes()` RPC for exercises without curated edges.

**Revert strategy:** Skip graph lookup, always use RPC.

#### 3d. Feed graph-derived pool to AI pipeline

Modify `generate-program.ts` to use `getCandidatePool()` instead of the
current fetch-all-then-filter approach. The LLM receives a smaller, safer,
pre-scored exercise pool.

**Revert strategy:** Restore the original fetch logic.

---

### Phase 4 — Advanced graph features (future)

These require manual curation and are not automated:

1. **Progression/regression chains**: Curate 20-30 core exercise families
   with explicit difficulty ladders (e.g., Goblet Squat → Front Squat → Back Squat)
2. **Equipment alternative families**: Link barbell/dumbbell/machine/cable variants
   of the same movement
3. **Trainer pattern → graph edges**: When trainer-patterns detects a recurring
   A→B swap with high confidence, offer to promote it to a library-level
   `substitute` edge
4. **Graph-informed LLM prompts**: Instead of sending the full Decision Framework,
   send the graph-derived relationships relevant to this specific student

---

## 7. Integration with AI Prescription Engine

### How the graph improves each AI pipeline stage

#### Exercise selection (before LLM call)

**Current:** `selectSmartExercises()` scores all curated exercises. The pool sent
to the LLM may include exercises that are contraindicated for the student's condition.
The AI must figure out what's safe from prompt text alone.

**With graph:** `getCandidatePool()` pre-filters by condition safety, equipment
compatibility, and difficulty. The LLM receives only exercises that are already
verified safe. This:
- Reduces the exercise pool size (fewer input tokens)
- Eliminates the risk of AI selecting unsafe exercises
- Reduces the burden on rules-engine post-validation

#### Substitution quality

**Current:** The LLM picks `substitute_exercise_ids` based on prompt instructions
(DF-9 rules). No guarantee substitutes are biomechanically equivalent.

**With graph:** `getSubstitutes()` provides graph-backed substitutes. The LLM
can reference these pre-validated options instead of guessing. Or the backend
can attach substitutes after generation (in output-enricher.ts).

#### Stalled exercise variation

**Current:** `context-enricher.ts` detects stalled exercises and passes IDs to
the LLM. The AI must invent a suitable alternative from the full pool.

**With graph:** `findVariationForStalled()` provides graph-backed alternatives.
The prompt can say "Exercise X is stalled. Graph-recommended alternatives:
[Y, Z]." The AI makes a better-informed choice.

#### Condition safety reasoning

**Current:** `buildConditionInstructions()` injects free-text rules into the prompt.
The AI must interpret and comply. No programmatic enforcement.

**With graph:** Condition constraints are enforced at the pool level (Phase 3b).
The AI literally cannot select a contraindicated exercise because it's not in
the pool. The prompt still includes condition-specific technique notes, but
safety is guaranteed regardless of AI compliance.

#### Token reduction (v2 engine synergy)

The graph directly supports the v2 prescription engine's goal of reducing
input tokens:
- Smaller exercise pool = fewer tokens in the user message
- Pre-attached substitutes = the LLM doesn't need to search the pool again
- Condition safety enforced upstream = less safety text needed in the prompt

---

## 8. Risks and Mitigations

### Risk 1: Overcomplicating the system (HIGH)

**Description:** Adding a graph layer on top of an already-complex prescription
engine could make the system harder to debug and maintain.

**Mitigation:**
- The graph service is a **read-only query layer**. It doesn't change how
  exercises are stored or how programs are built.
- Phase 3 replaces existing code with graph calls line-by-line. Net code
  complexity should decrease (removing duplicated maps).
- The graph service has a clean, self-documenting API surface.
- Start with synergy maps (6 rows, simplest) before tackling relationships.

### Risk 2: Empty or incorrect graph data (MEDIUM)

**Description:** If the graph has missing or wrong edges, the prescription
engine could produce worse results than the current hard-coded approach.

**Mitigation:**
- Phase 1 seeds from EXISTING data (synergy maps, smart swap RPC, condition
  mappings). No new knowledge is invented.
- Phase 2 includes diagnostic comparison against current hard-coded behavior.
- Phase 3 migrations are individually revertable.
- The graph is additive — missing edges degrade gracefully to the trigram
  RPC fallback, not to a crash.

### Risk 3: Query performance (LOW)

**Description:** Graph queries could slow down the prescription pipeline.

**Mitigation:**
- All queries hit indexed lookups on small tables (<2000 rows).
- `getAllSynergies()` returns 6 rows — can be cached in memory for the
  entire request lifetime.
- `getCandidatePool()` is a single query with JOINs, not N+1.
- The current pipeline already makes 3-5 Supabase queries; adding 1-2
  graph queries is negligible.

**Caching strategy (in-memory Map with TTL):**

The graph service uses the same pattern as `program-cache.ts` — a module-level
`Map<string, CacheEntry>` with TTL expiration. Graph data changes rarely (only
when exercises are curated or relationships are edited), so a generous TTL is safe.

| Cache key | TTL | Invalidation |
|---|---|---|
| `synergies:all` | 1 hour | `clearGraphCache()` on synergy table edit |
| `relationships:{exerciseId}:{type}` | 30 minutes | `clearGraphCache()` on relationship edit |
| `conditions:{conditionId}` | 1 hour | `clearGraphCache()` on constraint edit |
| `safety:{exerciseId}:{conditionHash}` | 30 minutes | Same as conditions |

Cache is per-process (not shared across serverless instances). Conservative TTLs
ensure eventual consistency without requiring explicit invalidation infrastructure.
`clearGraphCache()` is exposed for admin operations (e.g., after bulk import).

### Risk 4: Duplicated logic during transition (MEDIUM)

**Description:** During Phase 3, some modules use graph queries while others
still use hard-coded maps, creating inconsistency.

**Mitigation:**
- Phase 3a (synergy maps) is the highest-priority migration because it
  eliminates the most obvious duplication.
- Each sub-phase (3a, 3b, 3c, 3d) is independently deployable.
- The graph service returns the SAME data as the hard-coded maps (verified
  in Phase 2 diagnostics).
- Full transition can complete within 2-3 sprints.

### Risk 5: Graph fallback safety (CRITICAL — design constraint)

**Description:** If the graph service fails (empty tables, query error, missing edges),
the prescription engine must continue to produce valid programs.

**Guarantee:** Every graph query function has a documented fallback:

| Graph function | Fallback if empty/error |
|---|---|
| `getAllSynergies()` | Returns hard-coded `SECONDARY_MUSCLE_GROUPS` map |
| `filterBySafety()` | Returns all exercises as "safe" (current behavior) |
| `getSubstitutes()` | Falls back to `get_smart_substitutes()` trigram RPC |
| `getProgressions()` / `getRegressions()` | Returns empty array (no progression data = no change) |
| `getCandidatePool()` | Falls back to current `selectSmartExercises()` flow |
| `isExerciseSafe()` | Returns `{ safe: true }` (current behavior — AI decides) |

**Implementation rule:** Every `exercise-graph.ts` function wraps its Supabase query
in a try/catch that returns the documented fallback value. The graph is **additive** —
removing it always restores the pre-graph behavior, never crashes.

### Risk 6: Migration data conflicts (LOW)

**Description:** Seeding relationships from the trigram RPC could create
incorrect substitute edges (false positives from name similarity).

**Mitigation:**
- Only seed from curated exercises (`is_ai_curated = true`).
- Only seed edges with `similarity_score >= 0.3` (high confidence).
- Manual review of seeded edges before Phase 3.
- Edges can be deleted without side effects.

---

## 9. Implementation Order Summary

| Phase | Scope | Dependencies | Risk | Effort |
|---|---|---|---|---|
| **0** | Create 3 empty tables | None | None | Small |
| **1** | Seed synergies + conditions + substitutes | Phase 0 | Low | Small |
| **2** | Create exercise-graph.ts + tests | Phase 1 | None | Medium |
| **3a** | Replace synergy maps in rules/builder | Phase 2 | Low | Small |
| **3b** | Add condition safety to selector | Phase 2 | Medium | Small |
| **3c** | Upgrade swap UI | Phase 2 | Low | Small |
| **3d** | Feed graph pool to AI pipeline | Phase 2 + v2 engine | Medium | Medium |
| **4** | Progression chains, equipment families | Phase 3 | Low | Large (curation) |

**Recommended start:** Phase 0 + Phase 1 in a single PR (schema + seed data).
Then Phase 2 as a separate PR. Then Phase 3a as the first integration PR.
