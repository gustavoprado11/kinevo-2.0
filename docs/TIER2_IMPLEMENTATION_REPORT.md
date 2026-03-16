# Tier 2 — Slot-Based Builder Implementation Report

> **Date:** 2026-03-09
> **Status:** Implemented, not deployed
> **TypeScript compilation:** Zero errors (`tsc --noEmit` passed)
> **Feature flag:** `ENABLE_SLOT_BASED_BUILDER` (default: `true`, set `false` to revert)
> **Branch:** feature/mobile-trainer-mode
> **Depends on:** Tier 1 (compact exercise pool), Exercise Knowledge Graph (migrations 070-073)

---

## Changes Summary

### 1. New File: `slot-templates.ts`

**File:** `web/src/lib/prescription/slot-templates.ts`

Defines the `WorkoutSlot` type and slot templates for all split types.

**WorkoutSlot interface:**
```typescript
interface WorkoutSlot {
    movement_pattern: string | string[]  // Required pattern(s)
    target_group: string                 // Volume attribution group
    function: 'main' | 'accessory'       // Exercise role
    min_sets: number                     // Slot minimum
    max_sets: number                     // Slot maximum
    priority: number                     // Fill order (lower = first)
    optional: boolean                    // Can skip if no candidates
    prefer_compound: boolean             // Prefer compounds for this slot
}
```

**Slot template coverage:**

| Split Type | Workouts | Slots per Workout |
|---|---|---|
| full_body | Full Body A, B, C | 6 each |
| upper_lower | Upper A, Lower A, Upper B, Lower B | 6 each |
| ppl_plus | Push, Pull, Legs A, Upper, Legs B | 5-6 each |
| ppl_complete | Push A, Pull A, Legs A, Push B, Pull B, Legs B | 5-6 each |

**Helper functions:**
- `matchesSlotPattern()` — exact match → family fallback matching
- `getSlotLabels()` — ordered labels for a split type
- `PATTERN_TO_FAMILY` — maps movement patterns to families

### 2. Rewritten: `program-builder.ts`

**File:** `web/src/lib/prescription/program-builder.ts`

Two builders coexist in the same file:

| Builder | Function | Signature | When Used |
|---|---|---|---|
| Legacy | `buildHeuristicProgram()` | sync, (profile, exercises) | Feature flag off, or fallback |
| Slot-based | `buildSlotBasedProgram()` | async, (profile, exercises, constraints, context) | Feature flag on, agent path |

The slot-based builder includes all 7 architectural improvements:

#### Improvement 1: Movement Pattern Family Matching
- `matchesSlotPattern()` tries exact `movement_pattern` match first
- Falls back to `movement_pattern_family` (broader family from migration 070)
- Enables exercises without exact pattern data to fill matching slots

#### Improvement 2: Fatigue Management
- Tracks `highFatigueUsedInWorkout` boolean in scoring context
- When a high-fatigue compound is already in the workout, subsequent high-fatigue candidates get -20 score penalty
- Prevents two CNS-heavy compounds in the same session (e.g., Agachamento + Terra)

#### Improvement 3: Controlled Variety
- After scoring all candidates, collects those within 5 points of the best score
- Randomly picks from this top tier instead of always picking the #1
- Produces different programs across generations while maintaining quality

#### Improvement 4: Exercise Diversity Protection
- Tracks `usedPatternsInWorkout` as `Set<"pattern:group">` keys
- -15 score penalty when the same movement pattern + target group combo already exists in the workout
- Prevents e.g., two horizontal push chest exercises in the same Push workout

#### Improvement 5: Graph-Aware Stall Replacement
- Reads `enrichedContext.load_progression` for stalled exercises
- Calls `findVariationForStalled()` from exercise-graph.ts
- Pre-builds a `stallReplacements` map (stalledId → replacement exercise)
- During slot filling, transparently swaps stalled exercises for graph variations

#### Improvement 6: Graph-Based Substitute Generation
- After building all workouts, calls `getSubstitutesForBatch()` (new batch function)
- Attaches top 2 in-pool substitutes to each exercise item
- Replaces the always-empty `substitute_exercise_ids: []`

#### Improvement 7: Constraint-Driven Volume Distribution
- Uses `constraints.volume_budget` (min/max per group) from constraints engine
- `distributeSetsForSlot()` computes: `remaining = budget.max - currentVolume`, distributes across occurrences
- Clamps to slot min/max bounds
- Tracks secondary contributions via `BUILDER_SECONDARY_MAP`

### 3. New Batch Query: `exercise-graph.ts`

**File:** `web/src/lib/prescription/exercise-graph.ts`

Added `getSubstitutesForBatch()` — fetches substitute edges for multiple exercises in 2-3 DB queries instead of N individual queries.

**Approach:**
1. Check cache first, collect uncached IDs
2. Batch query outgoing + incoming substitute edges
3. Batch fetch exercise names
4. Group, sort by weight, cache each result
5. Returns `Map<exerciseId, GraphExerciseEdge[]>`

**Performance:** 2-3 queries total vs N×3 queries (where N = ~25-35 exercises).

### 4. Extended Type: `PrescriptionExerciseRef`

**File:** `shared/types/prescription.ts`

Added two fields:
```typescript
movement_pattern_family: string | null  // Broader family (knee_dominant, hip_dominant, etc.)
fatigue_class: 'high' | 'moderate' | 'low'  // CNS demand classification
```

Updated exercise fetchers in:
- `generate-program.ts` — EXERCISE_SELECT_COLUMNS + mapExerciseRow
- `analyze-context.ts` — same pattern
- `get-prescription-data.ts` — same pattern
- `api/prescription/generate/route.ts` — same pattern

### 5. Feature Flag

**`ENABLE_SLOT_BASED_BUILDER`** (env var)

| Value | Behavior |
|---|---|
| `true` (default) | Slot-based builder for agent fallback path |
| `false` | Legacy 3-phase builder (exact previous behavior) |

Flag checked in `generate-program.ts` when the agent output fails validation and falls back to heuristic.

### 6. Builder Stats Logging

When slot builder runs, emits:
```
[SlotBuilder] Stats: 28 exercises, 98 total sets, 15 mains
[SlotBuilder] Stall replacements: 2
[SlotBuilder] Weekly volume: {"Peito":12,"Costas":14,...}
[SlotBuilder] Volume UNDER budget: Trapézio = 2 (min 4)
```

---

## Architectural Decisions

### Why Two Builders in One File?

The slot-based builder is async (graph queries) and requires `PrescriptionConstraints` + `EnrichedStudentContext`. The legacy builder is sync and only needs profile + exercises. Keeping both ensures:
- Legacy builder remains the universal fallback (no graph dependency)
- Slot builder falls back to legacy on any error (`try/catch` in `buildSlotBasedProgram`)
- No breaking changes to existing callers of `buildHeuristicProgram()`

### Why Not Replace the Legacy Builder?

The legacy builder is used in:
1. Non-agent generation path (OpenAI fallback)
2. Any path where constraints/enriched context aren't available
3. As the ultimate fallback if slot builder throws

Until the AI Optimizer (Phase C) replaces the agent path entirely, both builders must coexist.

### Slot Builder Error Safety

```
buildSlotBasedProgram()
  └── try: buildWithSlots() → complete program
  └── catch: buildLegacyProgram() → fallback
        └── always succeeds (sync, no external dependencies)
```

Every graph function returns a safe fallback on error. The slot builder never crashes — it degrades gracefully to the legacy builder.

---

## Files Modified

| File | Change |
|---|---|
| `shared/types/prescription.ts` | Added `movement_pattern_family`, `fatigue_class` to `PrescriptionExerciseRef` |
| `web/src/lib/prescription/slot-templates.ts` | **New file** — WorkoutSlot type + all templates |
| `web/src/lib/prescription/program-builder.ts` | **Rewritten** — slot-based builder + legacy preserved |
| `web/src/lib/prescription/exercise-graph.ts` | Added `getSubstitutesForBatch()` batch query |
| `web/src/actions/prescription/generate-program.ts` | Import slot builder, wire feature flag, add new columns to fetcher |
| `web/src/actions/prescription/analyze-context.ts` | Add new fields to exercise mapping |
| `web/src/actions/prescription/get-prescription-data.ts` | Add new fields to exercise mapping |
| `web/src/app/api/prescription/generate/route.ts` | Add new fields to exercise mapping |
| `web/src/lib/prescription/__tests__/generate-program-e2e.test.ts` | Add new fields to test helper |
| `web/src/lib/prescription/__tests__/rules-engine.test.ts` | Add new fields to test helper |
| `web/.env.example` | Added `ENABLE_SLOT_BASED_BUILDER=true` |

## Files NOT Modified

| File | Reason |
|---|---|
| `constraints-engine.ts` | Already produces all needed data (volume_budget, emphasized_groups) |
| `context-enricher.ts` | Already provides stall detection + history data |
| `rules-engine.ts` | Validates output identically regardless of builder |
| `exercise-selector.ts` | Still used for Tier 1 pool reduction |
| `prompt-builder.ts` | Unchanged — agent prompt path unaffected |
| `claude-agent.ts` | Unchanged — agent generation unaffected |

---

## Validation

- [x] `tsc --noEmit` passes with zero errors
- [x] Feature flag defaults to `true` (slot builder enabled)
- [x] Feature flag `false` restores exact legacy behavior
- [x] Legacy `buildHeuristicProgram()` signature unchanged (no breaking changes)
- [x] Slot builder falls back to legacy on any error
- [x] Graph functions return safe fallbacks (empty arrays) on error
- [x] All 7 improvements implemented and integrated
- [x] Builder stats logging follows `[SlotBuilder]` prefix convention
- [x] No changes to rules-engine.ts or constraints-engine.ts
- [x] Test helpers updated with new type fields

---

## Next Steps (Phase C — AI Optimizer)

The slot builder produces complete, valid programs. Phase C will add:
1. `ai-optimizer.ts` — lightweight LLM review of builder output
2. `buildOptimizerPrompt()` in prompt-builder.ts
3. New hybrid generation path: builder → optimizer → validate
4. Feature flag: `ENABLE_HYBRID_BUILDER`
5. A/B testing infrastructure (Phase D)

Estimated token budget for optimizer: ~2,500 input + ~800 output = ~3,300 total (vs ~8,350 current agent path).
