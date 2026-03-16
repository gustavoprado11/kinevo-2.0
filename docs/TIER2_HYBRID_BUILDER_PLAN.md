# Tier 2 — Hybrid Builder Architecture Plan

> **Date:** 2026-03-09
> **Status:** Plan only — no code modifications
> **Depends on:** Tier 1 (ENABLE_COMPACT_EXERCISE_POOL), Exercise Knowledge Graph (Phase 0+1)
> **Target:** ~76% token reduction vs baseline, improved program quality

---

## 1. Architecture Overview

### Current Architecture (Post Tier 1)

```
Profile → Constraints → Smart Selector → ─── LLM ──── → Validate → Fix → Save
                                          (full program)
```

The LLM builds the entire program from scratch: selects exercises, assigns sets, orders them, writes notes, generates substitutes. Then the rules engine validates and patches.

### Proposed Hybrid Architecture

```
Profile → Constraints → Slot Builder → Graph Enricher → ─ AI Optimizer ─ → Validate → Save
                        (full program)  (subs + swaps)    (review + tune)
```

The Deterministic Builder produces a complete valid program. The AI Optimizer only reviews and adjusts. The rules engine validates as before, but should have nothing to fix.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC BUILDER                            │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  Constraints  │──▶│  Slot Planner │──▶│  Exercise Filler     │    │
│  │  Engine       │   │  (templates)  │   │  (graph-scored)      │    │
│  └──────────────┘   └──────────────┘   └──────────────────────┘    │
│                                                │                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────┴───────────────┐    │
│  │  Volume       │◀──│  Order &      │◀──│  Substitute          │    │
│  │  Balancer     │   │  Function     │   │  Attacher (graph)    │    │
│  └──────────────┘   └──────────────┘   └──────────────────────┘    │
│                           │                                         │
│                    ┌──────┴───────────────┐                         │
│                    │  Reasoning Generator  │                         │
│                    │  (template-based)     │                         │
│                    └──────────────────────┘                         │
│                                                                     │
│  OUTPUT: Complete valid program (passes validateOutput)             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI OPTIMIZER (optional)                        │
│                                                                     │
│  INPUT: Pre-built program + student context + candidate swaps       │
│                                                                     │
│  CAN:   Swap 1-3 exercises, adjust sets ±1, write notes, add flags │
│  CANNOT: Change split, violate budget, add exercises outside pool   │
│                                                                     │
│  FALLBACK: Skip entirely → use builder output as-is                 │
│  TOKEN BUDGET: ~2,500 input + ~800 output = ~3,300 total            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current Builder Analysis

### How program-builder.ts Works Today

**Exercise Selection:**
- Groups exercises by muscle group
- Phase 1: One compound per primary group (sorted by: favorites > is_primary_movement > primary group match > difficulty)
- Phase 2: One exercise per small group (respecting weekly limits)
- Phase 3: Fill remaining slots with primary group accessories
- Uses Fisher-Yates shuffle within priority tiers for variety

**Sets Assignment:**
- Compounds: `Math.min(4, maxSetsWithinBudget(pick, group, budget))`
- Budget per occurrence: `targetSetsPerGroup / groupFrequency`
- Small groups: flat 3 sets
- Phase 3 accessories: remaining budget capped at 3

**Ordering:**
- Final sort by `session_position` (first → middle → last)
- `exercise_function`: compound → `main`, isolation → `accessory`

**Substitutes:**
- Currently: `substitute_exercise_ids: []` — never populated

**Notes:**
- Currently: `notes: null` — never populated

### Builder Gaps to Address

| Gap | Impact | Solution |
|-----|--------|----------|
| No slot-based planning | Exercises picked per-group, not per-movement-pattern | Slot templates with pattern requirements |
| No graph integration | Ignores progression, regression, equipment alternatives | Graph-scored exercise selection |
| No stall detection | Repeats stalled exercises | Use `enrichedContext.load_progression` |
| No substitutes | Always `[]` | Graph `getSubstitutes()` |
| No notes | Always `null` | Template-based reasoning |
| Volume distribution is naive | `targetSetsPerGroup / occurrences` | Constraint-aware distribution from `volume_budget` |
| No adherence-based exercise count | Phase 3 fills to max | Respect `constraints.exercises_per_session` |
| No emphasis awareness | Uniform volume target | Use `constraints.emphasized_groups` |

---

## 3. Slot-Based Builder Design

### Concept

Instead of "pick exercises per muscle group", define **slot templates** that specify:
- Movement pattern required
- Muscle group(s) targeted
- Function (main/accessory)
- Minimum sets

Each slot is filled by the best-scoring exercise from the pool that matches the pattern + group.

### Slot Definition

```typescript
interface WorkoutSlot {
    movement_pattern: string | string[]  // Required movement pattern(s)
    target_group: string                 // Primary muscle group for volume attribution
    function: 'main' | 'accessory'      // Exercise function
    min_sets: number                     // Minimum sets for this slot
    max_sets: number                     // Maximum sets for this slot
    priority: number                     // Fill order (lower = earlier)
    optional: boolean                    // Can be skipped if no candidates
    prefer_compound: boolean             // Prefer compound over isolation
}
```

### Slot Templates

#### Push Workout

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | push_horizontal | Peito | main | 3-4 | 1 | No |
| 2 | push_vertical | Ombros | main | 3-4 | 2 | No |
| 3 | push_horizontal, isolation | Peito | accessory | 2-3 | 3 | No |
| 4 | isolation | Ombros | accessory | 2-3 | 4 | Yes |
| 5 | isolation | Tríceps | accessory | 2-3 | 5 | Yes |
| 6 | isolation | Tríceps | accessory | 2-3 | 6 | Yes |

#### Pull Workout

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | pull_vertical | Costas | main | 3-4 | 1 | No |
| 2 | pull_horizontal | Costas | main | 3-4 | 2 | No |
| 3 | pull_horizontal, pull_vertical | Costas | accessory | 2-3 | 3 | Yes |
| 4 | isolation | Bíceps | accessory | 2-3 | 4 | Yes |
| 5 | isolation | Trapézio | accessory | 2-3 | 5 | Yes |

#### Legs A (Squat-Dominant)

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | squat | Quadríceps | main | 3-4 | 1 | No |
| 2 | lunge | Quadríceps | main | 3-4 | 2 | No |
| 3 | hinge | Posterior de Coxa | main | 3-4 | 3 | No |
| 4 | isolation | Quadríceps | accessory | 2-3 | 4 | Yes |
| 5 | isolation | Glúteo | accessory | 2-3 | 5 | Yes |
| 6 | isolation | Panturrilha | accessory | 2-3 | 6 | Yes |

#### Legs B (Hinge-Dominant)

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | hinge | Posterior de Coxa | main | 3-4 | 1 | No |
| 2 | squat | Quadríceps | main | 3-4 | 2 | No |
| 3 | lunge | Quadríceps | main | 3-4 | 3 | Yes |
| 4 | isolation | Posterior de Coxa | accessory | 2-3 | 4 | Yes |
| 5 | isolation | Glúteo | accessory | 2-3 | 5 | Yes |
| 6 | isolation | Panturrilha | accessory | 2-3 | 6 | Yes |

#### Upper A / Upper B

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | push_horizontal | Peito | main | 3-4 | 1 | No |
| 2 | pull_horizontal | Costas | main | 3-4 | 2 | No |
| 3 | push_vertical | Ombros | main | 3-4 | 3 | No |
| 4 | pull_vertical | Costas | accessory | 2-3 | 4 | Yes |
| 5 | isolation | Bíceps | accessory | 2-3 | 5 | Yes |
| 6 | isolation | Tríceps | accessory | 2-3 | 6 | Yes |

#### Full Body

| Slot | Pattern | Group | Function | Sets | Priority | Optional |
|------|---------|-------|----------|------|----------|----------|
| 1 | squat, lunge | Quadríceps | main | 3-4 | 1 | No |
| 2 | push_horizontal | Peito | main | 3-4 | 2 | No |
| 3 | pull_horizontal, pull_vertical | Costas | main | 3-4 | 3 | No |
| 4 | hinge | Posterior de Coxa | accessory | 2-3 | 4 | Yes |
| 5 | push_vertical | Ombros | accessory | 2-3 | 5 | Yes |
| 6 | isolation | * | accessory | 2-3 | 6 | Yes |

### Slot Template Mapping

```typescript
const SLOT_TEMPLATES: Record<string, Record<string, WorkoutSlot[]>> = {
    full_body: {
        'Full Body A': [...],
        'Full Body B': [...],
        'Full Body C': [...],
    },
    upper_lower: {
        'Upper A': PUSH_PULL_MIXED_SLOTS,
        'Lower A': LEGS_A_SLOTS,
        'Upper B': PUSH_PULL_MIXED_SLOTS,
        'Lower B': LEGS_B_SLOTS,
    },
    ppl_plus: {
        'Push': PUSH_SLOTS,
        'Pull': PULL_SLOTS,
        'Legs A': LEGS_A_SLOTS,
        'Upper': PUSH_PULL_MIXED_SLOTS,
        'Legs B': LEGS_B_SLOTS,
    },
    ppl_complete: {
        'Push A': PUSH_SLOTS,
        'Pull A': PULL_SLOTS,
        'Legs A': LEGS_A_SLOTS,
        'Push B': PUSH_SLOTS,
        'Pull B': PULL_SLOTS,
        'Legs B': LEGS_B_SLOTS,
    },
}
```

### Slot-Filling Algorithm

```
for each workout in split:
    slots = SLOT_TEMPLATES[split_type][workout_label]

    // Trim optional slots if exercises_per_session would be exceeded
    active_slots = slots.filter(required)
        + slots.filter(optional).slice(0, exercises_per_session - required_count)

    // Sort by priority (main slots first)
    active_slots.sort(by priority)

    for each slot in active_slots:
        candidates = pool.filter(
            matches movement_pattern AND
            matches target_group AND
            not already used in this workout AND
            not stalled (unless no alternative)
        )

        scored_candidates = candidates.map(ex => ({
            exercise: ex,
            score: computeSlotScore(ex, slot, context)
        }))

        pick = scored_candidates.sort(by score desc)[0]

        if pick:
            sets = computeSetsForSlot(slot, volume_budget, group_frequency)
            add to workout
            track volume
```

### Slot Scoring Function

```typescript
function computeSlotScore(
    exercise: PrescriptionExerciseRef,
    slot: WorkoutSlot,
    context: {
        favoriteIds: Set<string>,
        stalledIds: Set<string>,
        previousIds: Set<string>,
        constraints: PrescriptionConstraints,
        level: TrainingLevel,
    },
): number {
    let score = 50 // base

    // Favorites bonus (+20)
    if (context.favoriteIds.has(exercise.id)) score += 20

    // Novelty bonus (+15 if not in previous program)
    if (!context.previousIds.has(exercise.id)) score += 15

    // Stall penalty (-30 if stalled)
    if (context.stalledIds.has(exercise.id)) score -= 30

    // Difficulty match (+10)
    const levelMap = { beginner: 0, intermediate: 1, advanced: 2 }
    if (levelMap[exercise.difficulty_level] === levelMap[context.level]) score += 10

    // Primary movement flag (+10)
    if (exercise.is_primary_movement) score += 10

    // Compound bonus for main slots (+5)
    if (slot.function === 'main' && exercise.is_compound) score += 5

    // Graph relationship bonus (future: if exercise has graph edges)
    // score += graphBonus(exercise.id)

    return Math.max(0, Math.min(100, score))
}
```

---

## 4. Exercise Knowledge Graph Integration

### Graph Usage Points

| Builder Step | Graph Function | Purpose |
|-------------|----------------|---------|
| Slot filling | `filterBySafety()` | Remove contraindicated exercises before scoring |
| Stall replacement | `findVariationForStalled()` | Find variation/progression for stalled exercises |
| Substitute attachment | `getSubstitutes()` | Top 2 substitutes per exercise (already in Tier 1) |
| Equipment fallback | `getEquipmentAlternatives()` | When slot can't be filled with available equipment |
| Pattern grouping | `movement_pattern_family` column | Group exercises by movement family for slot matching |

### Graph-Enhanced Slot Filling

```
for each slot:
    // 1. Safety filter (graph)
    safe_candidates = filterBySafety(candidates, conditionIds)

    // 2. Stall detection
    for each candidate in safe_candidates:
        if candidate.id in stalledIds:
            variation = findVariationForStalled(candidate.id, equipment, conditions)
            if variation.length > 0:
                replace candidate with variation[0] in pool

    // 3. Score and pick
    pick = score_and_select(safe_candidates)

    // 4. Attach substitutes (graph)
    subs = getSubstitutes(pick.id)
        .filter(in pool AND same function type)
        .slice(0, 2)

    // 5. Equipment fallback
    if no pick found:
        alternatives = getEquipmentAlternatives(any_exercise_matching_pattern)
        pick from alternatives
```

### Movement Pattern Family Mapping

The `movement_pattern_family` column (added in migration 070) groups exercises into families that map directly to slot patterns:

| Slot Pattern | movement_pattern_family | movement_pattern values |
|-------------|------------------------|------------------------|
| squat | knee_dominant | squat |
| hinge | hip_dominant | hinge |
| lunge | knee_dominant | lunge |
| push_horizontal | horizontal_push | push_horizontal |
| push_vertical | vertical_push | push_vertical |
| pull_horizontal | horizontal_pull | pull_horizontal |
| pull_vertical | vertical_pull | pull_vertical |
| isolation | isolation | isolation |

The builder should match on `movement_pattern` first (exact), then fall back to `movement_pattern_family` (broader).

### Graph Query Budget

Each generation will make these graph queries:

| Query | Count | Cached? | Latency |
|-------|-------|---------|---------|
| `filterBySafety()` | 1 (all pool IDs) | Yes (1h TTL) | ~50ms |
| `findVariationForStalled()` | 0-5 (per stalled exercise) | Yes (30m TTL) | ~50ms each |
| `getSubstitutes()` | 25-35 (per exercise) | Yes (30m TTL) | ~10ms each (cached after first) |
| `getEquipmentAlternatives()` | 0-3 (fallback only) | Yes (30m TTL) | ~50ms each |

**Total graph overhead:** ~300-500ms cold, ~50ms warm (cached). Acceptable for a generation that takes 5-15s total.

---

## 5. Volume Distribution Algorithm

### Current Problem

The builder uses `targetSetsPerGroup / groupFrequency` — a flat division that ignores the constraints engine's min/max budget. It doesn't use `constraints.volume_budget` at all.

### Proposed Algorithm

```typescript
function distributeSetsForSlot(
    slot: WorkoutSlot,
    group: string,
    volumeBudget: Record<string, { min: number; max: number }>,
    weeklyVolumeUsed: Record<string, number>,
    groupFrequency: Record<string, number>,
): number {
    const budget = volumeBudget[group]
    if (!budget) return slot.min_sets // No budget = use slot minimum

    const currentVolume = weeklyVolumeUsed[group] || 0
    const remaining = budget.max - currentVolume
    const occurrences = groupFrequency[group] || 1
    const perOccurrence = Math.ceil(remaining / occurrences)

    // Target: distribute remaining budget across remaining occurrences
    // Clamp to slot bounds
    const sets = Math.max(slot.min_sets, Math.min(slot.max_sets, perOccurrence))

    return sets
}
```

### Volume Tracking

The builder must track weekly volume including secondary contributions (reuse the `BUILDER_SECONDARY_MAP` / graph synergies):

```
After adding an exercise:
    weeklyVolume[targetGroup] += sets * frequency
    if exercise.is_compound:
        for each synergy of targetGroup:
            weeklyVolume[synergy.group] += sets * frequency * synergy.weight
```

---

## 6. AI Optimizer Design

### Role

The AI Optimizer is a **reviewer**, not a generator. It receives a complete, valid program and suggests targeted improvements based on student context that the deterministic builder cannot capture.

### What It CAN Do

| Action | Constraint |
|--------|-----------|
| Swap 1-3 exercises | Must use exercises from provided swap candidates (graph-backed) |
| Adjust sets ±1 | Must stay within volume_budget min/max |
| Write personalized notes | Max 15 words per note, only for key exercises |
| Generate attention_flags | Max 3 flags, 1 sentence each |
| Add exercise-specific warnings | Based on stall history or injury risk |

### What It CANNOT Do

| Prohibited Action | Reason |
|-------------------|--------|
| Change split structure | Determined by constraints engine |
| Add/remove workouts | Template-based, non-negotiable |
| Change muscle groups per workout | Split template defined |
| Exceed volume budget | Enforced by constraints |
| Use exercises outside pool | Pool already safety-filtered |
| Change rep ranges or rest | Goal-determined constants |
| Change exercise ordering | Rules engine enforces function ordering |

### Input Format (~2,500 tokens)

```json
{
    "role": "OPTIMIZER",
    "student": {
        "name": "João",
        "level": "intermediate",
        "goal": "hypertrophy",
        "adherence": 85,
        "stalled": ["Supino Reto com Barra", "Leg Press 45"],
        "observation": "Quer focar em costas este ciclo"
    },
    "program": {
        "split": "ppl_plus",
        "workouts": [
            {
                "name": "Push",
                "items": [
                    {"id": "uuid", "n": "Supino Reto", "mg": "Peito", "fn": "main", "s": 4, "r": "8-12"},
                    {"id": "uuid", "n": "Desenvolvimento", "mg": "Ombros", "fn": "main", "s": 3, "r": "8-12"},
                    ...
                ]
            }
        ]
    },
    "swaps": {
        "uuid-supino": [
            {"id": "uuid-inclinado", "n": "Supino Inclinado com Halteres"},
            {"id": "uuid-cross", "n": "Crossover"}
        ],
        ...
    },
    "budget": {
        "Peito": {"min": 10, "max": 16},
        ...
    }
}
```

### Output Format (~800 tokens)

```json
{
    "swaps": [
        {
            "workout": 0,
            "item_index": 0,
            "new_exercise_id": "uuid-inclinado",
            "reason": "Supino Reto estagnado há 4 semanas — Inclinado com Halteres varia ângulo e estímulo"
        }
    ],
    "set_adjustments": [
        {
            "workout": 1,
            "item_index": 2,
            "new_sets": 4,
            "reason": "Costas é ênfase — 1 série extra dentro do budget"
        }
    ],
    "notes": [
        {
            "workout": 0,
            "item_index": 0,
            "note": "Substitui Supino Reto estagnado — ângulo novo para estímulo"
        }
    ],
    "attention_flags": [
        "2 exercícios estagnados trocados — monitorar adaptação semana 2",
        "Volume de Costas no topo do budget por ênfase declarada"
    ],
    "confidence": 0.88
}
```

### Prompt Structure

```
# PAPEL
Você é o Otimizador de Prescrição Kinevo. Seu trabalho é revisar um programa
pré-construído e sugerir ajustes PONTUAIS baseados no contexto do aluno.

# REGRAS
1. Só sugira trocas se CLARAMENTE melhor para este aluno. Na dúvida, mantenha.
2. Trocas DEVEM usar exercícios da lista "swaps" — nunca invente.
3. Ajustes de séries: máximo ±1 série, respeitando o budget.
4. Notes: máximo 5 exercícios, 15 palavras cada. Foco no "por quê".
5. Flags: máximo 3, 1 frase cada. Formato: fato + ação.
6. Se o programa está bom: retorne {"swaps":[],"set_adjustments":[],"notes":[],...}

# CONTEXTO
[student context — ~300 tokens]

# PROGRAMA PRÉ-CONSTRUÍDO
[compact program — ~1,200 tokens]

# TROCAS DISPONÍVEIS
[swap candidates per exercise — ~800 tokens]

# BUDGET DE VOLUME
[volume budget — ~200 tokens]

Responda APENAS com JSON válido.
```

### Apply Optimizer Output

```typescript
function applyOptimizerOutput(
    program: PrescriptionOutputSnapshot,
    optimizerOutput: OptimizerOutput,
    exercisePool: Map<string, PrescriptionExerciseRef>,
    constraints: PrescriptionConstraints,
): PrescriptionOutputSnapshot {
    const result = structuredClone(program)

    // Apply swaps (validate each before applying)
    for (const swap of optimizerOutput.swaps) {
        const newEx = exercisePool.get(swap.new_exercise_id)
        if (!newEx) continue // Skip invalid swap
        const item = result.workouts[swap.workout]?.items[swap.item_index]
        if (!item) continue
        item.exercise_id = newEx.id
        item.exercise_name = newEx.name
        item.exercise_equipment = newEx.equipment
    }

    // Apply set adjustments (validate within budget)
    for (const adj of optimizerOutput.set_adjustments) {
        const item = result.workouts[adj.workout]?.items[adj.item_index]
        if (!item) continue
        const diff = adj.new_sets - item.sets
        if (Math.abs(diff) > 1) continue // Max ±1
        item.sets = adj.new_sets
    }

    // Apply notes
    for (const note of optimizerOutput.notes) {
        const item = result.workouts[note.workout]?.items[note.item_index]
        if (!item) continue
        item.notes = note.note
    }

    // Apply flags
    if (optimizerOutput.attention_flags?.length > 0) {
        result.reasoning.attention_flags = optimizerOutput.attention_flags.slice(0, 3)
    }

    result.reasoning.confidence_score = optimizerOutput.confidence ?? 0.85

    return result
}
```

---

## 7. Token Budget Analysis

### Current (Post Tier 1)

| Component | Tokens |
|-----------|--------|
| System prompt | ~2,000 |
| Conversation history | ~750 |
| Exercise list | ~3,200 |
| Legend + instructions | ~200 |
| Trainer answers | ~200 |
| **Total input** | **~6,350** |
| Output (full program) | ~2,000 |
| **Total** | **~8,350** |

### Tier 2 (AI Optimizer)

| Component | Tokens |
|-----------|--------|
| Optimizer system prompt | ~400 |
| Student context | ~300 |
| Pre-built program (compact) | ~1,200 |
| Swap candidates | ~800 |
| Volume budget | ~200 |
| **Total input** | **~2,900** |
| Output (swaps + notes + flags) | ~600 |
| **Total** | **~3,500** |

### Reduction Summary

| Stage | Total Tokens | vs Baseline | vs Tier 1 |
|-------|-------------|-------------|-----------|
| Baseline (pre-Tier 1) | ~13,500 | — | — |
| Tier 1 (compact pool) | ~8,350 | -38% | — |
| Tier 2 (hybrid builder) | ~3,500 | **-74%** | **-58%** |
| No LLM (builder only) | 0 | -100% | -100% |

### Cost Projection

| Model | Baseline | Tier 1 | Tier 2 | Savings |
|-------|----------|--------|--------|---------|
| Claude Sonnet ($3/$15) | $0.065 | $0.040 | $0.018 | **72%** |
| GPT-4.1-mini ($0.40/$1.60) | $0.008 | $0.005 | $0.002 | **75%** |

---

## 8. Migration Plan

### Phase A — Builder Improvements (Low Risk)

**Goal:** Upgrade `program-builder.ts` to use constraints engine output and produce higher-quality programs.

| Task | File | Change |
|------|------|--------|
| A1 | `program-builder.ts` | Accept `PrescriptionConstraints` as input (not just profile) |
| A2 | `program-builder.ts` | Use `constraints.volume_budget` for sets distribution |
| A3 | `program-builder.ts` | Respect `constraints.exercises_per_session` as hard cap |
| A4 | `program-builder.ts` | Use `constraints.emphasized_groups` for scoring bonus |
| A5 | `program-builder.ts` | Accept `EnrichedStudentContext` for stall detection + novelty |
| A6 | `program-builder.ts` | Generate template-based notes (not null) |
| A7 | `program-builder.ts` | Generate template-based reasoning (richer than current) |

**Validation:** Run existing `validateOutput()` against builder output with constraints. Should pass with zero errors.

**Risk:** Low — builder is already the fallback path. Improving it only improves fallback quality.

### Phase B — Slot Templates + Graph Integration (Medium Risk)

**Goal:** Replace the 3-phase group-based approach with slot-based building using graph data.

| Task | File | Change |
|------|------|--------|
| B1 | New: `slot-templates.ts` | Define `WorkoutSlot` type + all slot templates |
| B2 | `program-builder.ts` | Replace buildWorkout with slot-based filling |
| B3 | `program-builder.ts` | Integrate `filterBySafety()` for pool filtering |
| B4 | `program-builder.ts` | Integrate `findVariationForStalled()` for stall replacement |
| B5 | `program-builder.ts` | Integrate `getSubstitutes()` for substitute attachment |
| B6 | `program-builder.ts` | Add `computeSlotScore()` with graph-aware scoring |
| B7 | `exercise-graph.ts` | Add batch query functions (avoid N+1 during slot filling) |

**Validation:** Same `validateOutput()` + manual comparison of builder output vs agent output on 5 real student profiles.

**Risk:** Medium — changes the core selection algorithm. Requires A/B testing before replacing agent path.

### Phase C — AI Optimizer (Medium Risk)

**Goal:** Replace full LLM generation with lightweight optimizer review.

| Task | File | Change |
|------|------|--------|
| C1 | New: `ai-optimizer.ts` | Optimizer LLM call (prompt, parse, apply) |
| C2 | `prompt-builder.ts` | Add `buildOptimizerPrompt()` function |
| C3 | `generate-program.ts` | New path: builder → optimizer → validate |
| C4 | `generate-program.ts` | Feature flag: `ENABLE_HYBRID_BUILDER` |
| C5 | `rules-engine.ts` | Validate optimizer output (swaps within pool, sets within budget) |

**Validation:** Run optimizer on 10 builder outputs. Verify all swaps are valid, all set adjustments within budget.

**Risk:** Medium — introduces new LLM interaction pattern. Fallback: skip optimizer, use builder output.

### Phase D — A/B Testing (Low Risk)

**Goal:** Compare program quality across approaches.

| Task | Description |
|------|-------------|
| D1 | Add `generation_method` field to `prescription_generations` table |
| D2 | Randomly assign: `agent` (current), `builder_only`, `hybrid` (builder + optimizer) |
| D3 | Track: trainer edit rate, program completion rate, generation latency, token cost |
| D4 | Run for 2-4 weeks, analyze results |
| D5 | Decision: promote winning approach as default |

**Metrics:**

| Metric | Source | Success Criteria |
|--------|--------|-----------------|
| Trainer edit rate | Diff between generation and published program | Hybrid ≤ agent |
| Token cost | `[LLM_OPT]` logs | Hybrid < 40% of agent |
| Latency | `generation_time_ms` | Hybrid < agent |
| Program completion | `workout_sessions.status` | Hybrid ≥ agent |

---

## 9. Risk Analysis

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Slot templates too rigid for edge cases | Medium | Medium | Optional slots + fallback to current builder for unmatched groups |
| Graph empty or stale data | Low | Low | Fallback synergy maps already in place. Graph functions return `[]` on error |
| Optimizer hallucinates exercise IDs | Medium | Low | `applyOptimizerOutput()` validates every swap against pool. Invalid → skip |
| Optimizer returns invalid JSON | Low | Low | JSON parse failure → skip optimizer, use builder output |
| Performance regression from graph queries | Low | Medium | In-memory cache with 30min TTL. Batch queries to avoid N+1 |
| Slot scoring produces worse programs than LLM | Medium | High | A/B test (Phase D) before promoting. Feature flag allows instant revert |

### Quality Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Builder can't capture "nuanced" exercise choices | Medium | Medium | AI Optimizer handles nuance. Builder handles structure. |
| Notes lack personalization | Low | Low | Optimizer writes notes. Builder uses templates as fallback. |
| Stall replacement too aggressive | Low | Medium | Only replace if graph offers variation with weight ≥ 0.3. Keep original as substitute. |
| Volume distribution not optimal | Low | Medium | Uses same `constraints.volume_budget` as current agent path. Same validation. |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Feature flag confusion (Tier 1 + Tier 2) | Low | Low | Clear naming: `ENABLE_COMPACT_EXERCISE_POOL` (Tier 1), `ENABLE_HYBRID_BUILDER` (Tier 2) |
| Rollback needed mid-migration | Low | Medium | Each phase is independently revertible. Feature flags on all new paths. |
| Graph migrations not applied in prod | Medium | Low | Graph functions return fallback values. Builder works without graph data. |

---

## 10. File Impact Summary

### New Files

| File | Purpose |
|------|---------|
| `web/src/lib/prescription/slot-templates.ts` | Slot definitions, WorkoutSlot type, template mapping |
| `web/src/lib/prescription/ai-optimizer.ts` | Optimizer LLM call, prompt building, output parsing, application |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `program-builder.ts` | A, B | Accept constraints, slot-based filling, graph integration |
| `exercise-graph.ts` | B | Add batch query functions |
| `prompt-builder.ts` | C | Add `buildOptimizerPrompt()` |
| `generate-program.ts` | C | New hybrid path with feature flag |
| `rules-engine.ts` | C | Validate optimizer output |
| `constants.ts` | A | Export additional constants for builder |

### Unchanged Files

| File | Reason |
|------|--------|
| `constraints-engine.ts` | Already produces all needed data |
| `context-enricher.ts` | Already provides stall + history data |
| `exercise-selector.ts` | Still used for Tier 1 pool reduction |
| `condition-mappings.ts` | Still used for clinical text |
| `claude-agent.ts` | Retained for A/B testing (agent path) |

---

## 11. Implementation Priority

| Priority | Phase | Effort | Impact | Dependencies |
|----------|-------|--------|--------|-------------|
| 1 | **A** (Builder improvements) | Small | Medium | None |
| 2 | **B** (Slot templates + Graph) | Medium | High | Phase A + Graph migrations deployed |
| 3 | **C** (AI Optimizer) | Medium | High | Phase B |
| 4 | **D** (A/B testing) | Small | Critical | Phase C |

**Estimated timeline:** Phase A (1 session) → Phase B (1-2 sessions) → Phase C (1 session) → Phase D (deploy + wait 2-4 weeks)

---

## Summary

The hybrid builder architecture moves 80% of program construction into deterministic code, leaving only contextual optimization for the LLM. This reduces tokens by ~74%, improves consistency (same constraints always produce similar programs), and makes the system testable without LLM calls.

The builder's output is always valid (passes `validateOutput`). The optimizer is always optional (skip on error → use builder output). Every phase is feature-flagged and independently revertible.
