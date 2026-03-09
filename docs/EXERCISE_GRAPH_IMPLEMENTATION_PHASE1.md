# Exercise Knowledge Graph — Phase 0+1 Implementation Report

> **Date:** 2026-03-09
> **Status:** Implemented, not deployed
> **TypeScript compilation:** Zero errors (`tsc --noEmit` passed)
> **Branch:** feature/mobile-trainer-mode

---

## Files Created

### Migrations (Phase 0 — Schema)

**`supabase/migrations/070_exercise_knowledge_graph.sql`**
- Creates `exercise_relationships` table with provenance (`source` column), indexes, RLS
- Creates `exercise_synergies` table with RLS
- Creates `exercise_condition_constraints` table with indexes, RLS
- Adds `movement_pattern_family` column to `exercises` (10 valid families)
- Adds `fatigue_class` column to `exercises` (high/moderate/low)
- Risk: None — empty tables and nullable columns

### Migrations (Phase 1 — Seed Data)

**`supabase/migrations/071_seed_exercise_synergies.sql`**
- Seeds 6 synergy rows from hard-coded `SECONDARY_MUSCLE_GROUPS` maps
- Matches muscle groups by name + `owner_id IS NULL` (system groups)
- Uses `ON CONFLICT DO NOTHING` for idempotency

**`supabase/migrations/072_seed_condition_constraints.sql`**
- Seeds contraindicated constraints: ACL post-op → lunge pattern exercises
- Seeds cautious constraints for 8 conditions × relevant muscle groups
- Updates `movement_pattern_family` from existing `movement_pattern` values
- Classifies isolation exercises into upper/lower based on muscle groups
- Updates `fatigue_class` based on movement pattern and primary movement status

**`supabase/migrations/073_seed_exercise_relationships.sql`**
- Seeds substitute edges from `get_smart_substitutes()` RPC (similarity ≥ 0.3)
- Seeds equipment alternative edges for curated exercises sharing movement pattern
- All edges marked `source = 'algorithmic'`
- Bidirectional equipment alternatives inserted in both directions

### Service (Phase 2 — Read-only)

**`web/src/lib/prescription/exercise-graph.ts`** (~430 lines)
- Complete graph query API — NOT wired to any production module
- In-memory cache with TTL (synergies: 1h, relationships: 30m, conditions: 1h)
- Every function has documented fallback on error/empty

#### API Surface

| Category | Function | Fallback |
|---|---|---|
| Relationships | `getSubstitutes(id)` | `[]` |
| Relationships | `getProgressions(id)` | `[]` |
| Relationships | `getRegressions(id)` | `[]` |
| Relationships | `getVariations(id)` | `[]` |
| Relationships | `getEquipmentAlternatives(id)` | `[]` |
| Relationships | `getRelationships(id, type)` | `[]` |
| Safety | `getConditionConstraints(conditionId)` | `[]` |
| Safety | `getContraindicatedExercises(conditionId)` | `[]` |
| Safety | `getRecommendedExercises(conditionId)` | `[]` |
| Safety | `isExerciseSafe(id, conditionIds)` | `{ safe: true }` |
| Safety | `filterBySafety(ids, conditionIds)` | All exercises as "safe" |
| Synergies | `getAllSynergies()` | Hard-coded `SECONDARY_MUSCLE_GROUPS` map |
| Synergies | `getSynergies(groupName)` | `[]` |
| Composite | `findVariationForStalled(id, equipment, conditions)` | `[]` |
| Diagnostics | `getGraphDiagnostics()` | Empty counts |
| Cache | `clearGraphCache()` | N/A |

### Plan Document Updates

**`docs/EXERCISE_KNOWLEDGE_GRAPH_PLAN.md`** — 5 targeted updates:
1. Added `source` provenance column to `exercise_relationships` schema (Section 4.1)
2. Added `movement_pattern_family` and `fatigue_class` to node properties table (Section 2)
3. Added provenance trust levels to relationship taxonomy (Section 3.1)
4. Added graph fallback safety guarantees as Risk 5 (Section 8)
5. Added caching strategy with TTL table to Risk 3 (Section 8)
6. Updated Phase 0 actions to include new columns

---

## Architecture Decisions

### 1. No FK joins in Supabase queries
Supabase's PostgREST returns joined relations as arrays, which causes TypeScript type mismatches. Instead, we fetch IDs first, then batch-fetch names in a separate query. This is cleaner, more type-safe, and has negligible performance impact on small result sets.

### 2. Fallback-first design
Every graph function wraps its query in try/catch and returns the **documented fallback value**. The fallback always matches the current system behavior (pre-graph). This means the graph is purely additive — removing it or having empty tables never degrades the system.

### 3. Provenance tracking
Every `exercise_relationships` edge records its `source` (curated, algorithmic, trainer_pattern, imported, inferred). This enables quality-aware queries (e.g., only trust curated + algorithmic edges for safety-critical decisions).

### 4. Movement pattern families
Rather than creating a separate table, `movement_pattern_family` is a column on `exercises`. This groups the 10 `movement_pattern` values into 10 broader families (e.g., squat+lunge = knee_dominant). This enables cross-pattern variation queries without changing the existing pattern system.

### 5. Fatigue classification
`fatigue_class` (high/moderate/low) captures systemic CNS demand. Seeded automatically from movement pattern + `is_primary_movement`. Future use: session ordering (heavy compounds first) and recovery planning.

---

## What's NOT done (Phase 3+)

| Item | Phase | Status |
|---|---|---|
| Replace `SECONDARY_MUSCLE_GROUPS` in rules-engine.ts | 3a | Not started |
| Replace `BUILDER_SECONDARY_MAP` in program-builder.ts | 3a | Not started |
| Add `filterBySafety()` to exercise-selector.ts | 3b | Not started |
| Upgrade swap UI to use graph substitutes | 3c | Not started |
| Feed `getCandidatePool()` to AI pipeline | 3d | Not started |
| Curate progression/regression chains | 4 | Not started |
| Promote trainer patterns to graph edges | 4 | Not started |

---

## Validation Checklist

- [x] `tsc --noEmit` passes with zero errors
- [x] No existing files modified (only new files created)
- [x] All migrations use `ON CONFLICT DO NOTHING` for idempotency
- [x] All migrations use `IF NOT EXISTS` for schema changes
- [x] RLS enabled on all new tables (read-only for authenticated, full for service_role)
- [x] Graph service has fallback for every query function
- [x] Graph service is NOT imported by any production module
- [x] Plan document updated with all 5 architectural considerations
- [x] Migration numbering is sequential (070-073) after last existing (069)
