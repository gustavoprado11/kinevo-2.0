# Builder-First Migration Plan

> **Date:** 2026-03-09
> **Status:** Proposed — awaiting founder review
> **Branch:** feature/mobile-trainer-mode
> **Depends on:** Tier 2 Slot Builder (implemented), Exercise Knowledge Graph (migrations 070-073)

---

## 1. Current Architecture Analysis

### 1.1 Generation Flow (as-is)

```
Profile
  → enrichStudentContext()          [4 parallel DB queries, ~200ms]
  → buildConstraints()             [pure function, <1ms]
  → selectSmartExercises()         [pure function, <1ms]
  → analyzeContextAndAsk()         [Claude Sonnet, ~5-15s, ~2K tokens]
  ← Trainer answers questions
  → generateWithAgent()            [Claude Sonnet, ~30-90s, ~17K tokens total]
  → validateOutput()               [pure function, <1ms]
  → fixViolations()                [pure function, <1ms]
  → Save to prescription_generations
```

### 1.2 Where the LLM Owns the Program

**File:** `claude-agent.ts` → `generateWithAgent()` (line ~200)

The LLM receives the full exercise pool + constraints + conversation history and generates:
- Split structure (workout names, scheduled days)
- Exercise selection for each workout
- Sets, reps, rest for each exercise
- Exercise ordering within workouts
- Substitute exercise IDs
- Reasoning and confidence score

**This is the core problem.** The LLM is making 100% of the structural decisions despite the constraints engine, slot templates, and scoring algorithm being available to make them deterministically.

**File:** `prompt-builder.ts` → `buildAgentSystemPrompt()` (line ~1)

The system prompt embeds the full methodology (volume ranges, rep ranges, rest periods, periodization, decision framework) as natural language instructions — effectively re-teaching the LLM what the constraints engine already computed.

### 1.3 Consequences of LLM-First

| Problem | Evidence |
|---|---|
| **High token usage** | ~17K tokens total (system prompt ~8K + context ~5K + output ~4K) |
| **High cost** | ~$0.08-0.13 per program (Sonnet input $3/1M + output $15/1M) |
| **Slow generation** | 30-90s streaming (plus 5-15s analysis phase) |
| **Volume violations** | LLM frequently exceeds/undercuts volume budget despite constraints in prompt |
| **Duplicate exercises** | LLM sometimes picks the same exercise twice in a workout |
| **Pattern duplication** | LLM ignores movement pattern diversity rules |
| **Inconsistent splits** | LLM sometimes ignores split_type constraints |
| **Wasted validation** | rules-engine catches errors the builder would never produce |

### 1.4 What Already Works

The slot builder (`program-builder.ts` → `buildSlotBasedProgram()`) already:

- Produces complete, valid programs in <1ms
- Respects volume budget from constraints engine
- Prevents duplicate exercises (per-workout dedup)
- Enforces movement pattern diversity (-15 penalty)
- Limits fatigue stacking (max 1 high-fatigue compound)
- Distributes sets using budget-aware algorithm
- Attaches graph-based substitutes (top 2 per exercise)
- Replaces stalled exercises via graph variations
- Falls back to legacy builder on any error

**The builder already does everything the LLM is being asked to do — deterministically, in <1ms, with zero token cost.**

### 1.5 What the Builder Cannot Do

| Capability | Builder | LLM |
|---|---|---|
| Generate program structure | Yes | Yes (redundant) |
| Respect volume budget | Yes | Unreliable |
| Exercise selection | Yes (scoring) | Yes (but violations) |
| Movement pattern diversity | Yes (penalty) | Sometimes ignores |
| Contextual exercise swaps | No | Yes — can justify "swap X for Y because Z" |
| Write trainer-facing notes | No | Yes — natural language |
| Flag attention items | Templated only | Yes — context-aware |
| Adjust sets ±1 with rationale | No | Yes |
| Consider trainer patterns | No | Yes — can integrate past preferences |

**Conclusion:** The LLM's only irreplaceable value is contextual judgment on 1-3 exercise swaps, per-exercise notes, and attention flags. Everything else is better done deterministically.

---

## 2. Target Architecture

### 2.1 Pipeline (to-be)

```
Profile
  → enrichStudentContext()          [unchanged]
  → buildConstraints()             [unchanged]
  → selectSmartExercises()         [unchanged]
  → buildSlotBasedProgram()        [PRIMARY — produces complete program]
  → attachGraphSubstitutes()       [already in builder]
  → optimizeWithAI()               [NEW — lightweight LLM review]
  → validateOutput()               [unchanged]
  → Save to prescription_generations
```

### 2.2 AI Optimizer Contract

The optimizer receives a **complete valid program** and may only:

| Action | Scope | Constraint |
|---|---|---|
| Swap exercises | Max 3 per program | Must use exercise from pool |
| Adjust sets | ±1 per exercise | Must stay within volume budget |
| Add exercise notes | Any exercise | Max 15 words each |
| Write attention flags | Max 3 | Max 1 sentence each |
| Write workout notes | Per workout | Max 10 words each |
| Set confidence score | 1 value | 0.0-1.0 |

The optimizer **cannot**:
- Add or remove workouts
- Add or remove exercises (only swap)
- Change split type or scheduled days
- Change reps or rest (set by constraints)
- Exceed volume budget bounds
- Use exercises not in the pool

### 2.3 Token Budget Estimate

| Component | Current (LLM-first) | Target (Builder-first) |
|---|---|---|
| Analysis phase | ~3K tokens | **Removed** (builder doesn't need analysis) |
| System prompt | ~8K tokens | ~1.5K tokens (optimizer rules only) |
| Input (program + context) | ~5K tokens | ~2K tokens (compact program + brief context) |
| Output | ~4K tokens | ~0.8K tokens (diffs only, not full program) |
| **Total** | **~17K tokens** | **~4.3K tokens** |
| **Cost** | **~$0.08-0.13** | **~$0.02-0.03** |
| **Time** | **30-90s** | **3-8s** |

### 2.4 Analysis Phase

The current 2-phase agent flow (analyze → ask questions → generate) **becomes unnecessary** for the builder path:

- The builder doesn't need contextual analysis to produce a program
- Trainer questions are still valuable but can be asked **before** builder invocation
- The analysis phase can remain as an optional pre-step for the agent Q&A flow

**Decision:** Keep `analyzeContextAndAsk()` as-is for the conversational flow (trainer Q&A). The builder path skips it entirely. The optimizer receives any trainer answers as read-only context.

---

## 3. Migration Steps

### Phase 1: AI Optimizer (new file)

Create `web/src/lib/prescription/ai-optimizer.ts`.

**Responsibilities:**
1. Receive builder output + student context + constraints + trainer answers
2. Build compact optimizer prompt
3. Call Claude Haiku (fast, cheap) with structured output
4. Parse diff-based response
5. Apply validated changes to builder output
6. Return optimized program or original on failure

**Optimizer Prompt Structure:**

```
ROLE: You are a training program reviewer.
You receive a complete program generated by the Kinevo builder.
Your job is to make 0-3 small improvements.

RULES:
- You may swap up to 3 exercises (must use IDs from the provided pool)
- You may adjust sets ±1 (must stay within budget shown)
- You must write workout_notes (max 10 words each)
- You must write attention_flags (0-3, max 1 sentence each)
- You must set confidence_score (0.0-1.0)
- You MUST NOT add/remove workouts or exercises
- You MUST NOT change reps, rest, or scheduled days

OUTPUT FORMAT (JSON):
{
  "swaps": [
    { "workout_index": 0, "item_index": 2, "new_exercise_id": "UUID", "reason": "..." }
  ],
  "set_adjustments": [
    { "workout_index": 0, "item_index": 1, "new_sets": 4, "reason": "..." }
  ],
  "workout_notes": ["Treino A — focar em controle excêntrico", ...],
  "attention_flags": ["Volume de posterior baixo — monitorar aderência"],
  "confidence_score": 0.88
}
```

**Input to Optimizer:**

```json
{
  "program": { <builder output — compact format> },
  "student_context": {
    "name": "João",
    "level": "intermediate",
    "goal": "hypertrophy",
    "stalled_exercises": ["Supino Reto com Barra"],
    "adherence": 85,
    "trainer_answers": [{ "question": "...", "answer": "..." }],
    "session_patterns": { "avg_duration": 55 }
  },
  "volume_budget": { <from constraints> },
  "exercise_pool": [ <compact: id, name, muscle_group, equipment only> ]
}
```

**Estimated tokens:** ~1.5K input + ~0.8K output = ~2.3K total.

**Model choice:** Claude Haiku 4.5 ($0.80/1M input, $4/1M output) → ~$0.005 per optimization.

### Phase 2: Optimizer Prompt Builder

Add to `prompt-builder.ts`:

```typescript
export function buildOptimizerPrompt(
    builderOutput: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    exercises: PrescriptionExerciseRef[],
    trainerAnswers?: PrescriptionAgentAnswer[],
): { system: string; user: string }
```

This replaces the massive system prompt (~8K tokens) with a focused optimizer prompt (~1.5K tokens). No methodology re-teaching — the builder already applied it.

### Phase 3: Wire into generate-program.ts

**Current agent path** (lines ~280-380 of generate-program.ts):

```
agentState provided?
  → enrichStudentContext()
  → buildConstraints()
  → selectSmartExercises()
  → generateWithAgent()           ← LLM generates full program
  → validateOutput()
  → fixViolations()
  → save
```

**New builder-first path:**

```
agentState provided?
  → enrichStudentContext()
  → buildConstraints()
  → selectSmartExercises()
  → buildSlotBasedProgram()       ← Builder generates full program
  → optimizeWithAI()              ← LLM reviews and tweaks
  → validateOutput()              ← Safety net (should find nothing)
  → save
```

**Feature flag:** `ENABLE_BUILDER_FIRST` (default: `false` during rollout, flip to `true` when validated).

### Phase 4: Remove Agent Full-Generation Path

Once builder-first is validated:

1. Remove `generateWithAgent()` from the main path
2. Keep `analyzeContextAndAsk()` for the Q&A flow (it's still useful)
3. Archive the full-generation prompt sections in prompt-builder.ts
4. Update `buildAgentSystemPrompt()` to only include optimizer rules

---

## 4. File-by-File Modifications

### 4.1 New File: `web/src/lib/prescription/ai-optimizer.ts`

**Purpose:** Lightweight LLM review of builder output.

**Exports:**
```typescript
export async function optimizeWithAI(
    builderOutput: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    exercises: PrescriptionExerciseRef[],
    trainerAnswers?: PrescriptionAgentAnswer[],
): Promise<OptimizerResult>

export interface OptimizerResult {
    output: PrescriptionOutputSnapshot
    optimizerApplied: boolean
    swapsApplied: number
    setAdjustments: number
    model: string
    tokensUsed: { input: number; output: number }
    status: 'optimized' | 'no_changes' | 'optimizer_failed' | 'optimizer_skipped'
}
```

**Error handling:** On any failure, return original builder output unchanged. Never throw.

**~150-200 lines estimated.**

### 4.2 Modified: `web/src/lib/prescription/prompt-builder.ts`

**Add:**
- `buildOptimizerPrompt()` — compact prompt for optimizer (~100 lines)
- `buildCompactProgramSummary()` — serialize builder output for optimizer input (~30 lines)
- `parseOptimizerResponse()` — parse diff-based optimizer output (~50 lines)

**Do not remove:** Existing `buildPromptPair()` and `buildAgentSystemPrompt()` — they're still used by the OpenAI path and Q&A flow.

**~180 lines added.**

### 4.3 Modified: `web/src/actions/prescription/generate-program.ts`

**Add:**
- Import `optimizeWithAI` from ai-optimizer.ts
- New builder-first path gated by `ENABLE_BUILDER_FIRST` flag
- Logging for builder + optimizer pipeline

**Specific changes:**

After the current agent path block (~line 280), add:

```typescript
const useBuilderFirst = process.env.ENABLE_BUILDER_FIRST === 'true'

if (useBuilderFirst) {
    // 1. Builder produces complete program
    const builderOutput = await buildSlotBasedProgram(
        typedProfile, agentExercises, constraints, enrichedContext
    )

    // 2. Optimizer reviews (optional, non-blocking)
    const optimizerResult = await optimizeWithAI(
        builderOutput, constraints, enrichedContext,
        agentExercises, agentState?.answers
    )

    // 3. Validate final output
    outputSnapshot = optimizerResult.output
    // ... validation + save
}
```

**The existing agent path remains untouched** — gated by `!useBuilderFirst`.

**~40 lines added, 0 lines removed.**

### 4.4 Modified: `web/src/lib/prescription/claude-agent.ts`

**No changes in Phase 1.**

The existing `generateWithAgent()` continues to work when `ENABLE_BUILDER_FIRST` is off. In Phase 4, it gets deprecated but not removed (backward compatibility for in-flight generations).

### 4.5 Modified: `web/.env.example`

**Add:**
```
ENABLE_BUILDER_FIRST=false
```

### 4.6 NOT Modified

| File | Reason |
|---|---|
| `constraints-engine.ts` | Stable, already produces all needed data |
| `rules-engine.ts` | Stable, validates output identically |
| `exercise-selector.ts` | Stable, pool reduction unchanged |
| `context-enricher.ts` | Stable, context enrichment unchanged |
| `exercise-graph.ts` | Already integrated into builder |
| `slot-templates.ts` | Already stable (improvements tracked separately via simulation) |

---

## 5. Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `ENABLE_BUILDER_FIRST` | `false` | Master switch: builder-first pipeline |
| `ENABLE_SLOT_BASED_BUILDER` | `true` | Existing: slot builder vs legacy (kept for safety) |
| `ENABLE_AI_OPTIMIZER` | `true` | Sub-flag: skip optimizer if `false` (builder output used as-is) |

**Rollout sequence:**

1. Deploy with `ENABLE_BUILDER_FIRST=false` (no behavior change)
2. Enable for founder's test account: `ENABLE_BUILDER_FIRST=true`
3. Compare builder-first vs agent-first outputs side-by-side
4. If validated: flip `ENABLE_BUILDER_FIRST=true` for all trainers
5. Monitor for 2 weeks
6. If stable: remove agent full-generation path (Phase 4)

**Rollback:** Set `ENABLE_BUILDER_FIRST=false` → instant revert to agent path.

---

## 6. Failure Handling

### 6.1 Failure Cascade

```
buildSlotBasedProgram()
  ├── Success → optimizeWithAI()
  │               ├── Success → validated optimized output
  │               ├── Timeout → use builder output as-is
  │               ├── Parse error → use builder output as-is
  │               └── API error → use builder output as-is
  │
  └── Error → buildLegacyProgram()  [existing fallback, always succeeds]
```

**Key principle:** The builder output is always valid. The optimizer can only improve it, never break it. If the optimizer fails, skip it — the program is already complete.

### 6.2 Optimizer Validation

After applying optimizer diffs, re-validate:

```typescript
// In ai-optimizer.ts
const optimized = applyOptimizerDiffs(builderOutput, diffs)
const { violations } = validateOutput(optimized, profile, exerciseMap, constraints)

if (violations.some(v => v.severity === 'error')) {
    // Optimizer introduced a violation — discard its changes
    return { output: builderOutput, status: 'optimizer_failed' }
}
```

### 6.3 Timeout Strategy

| Component | Timeout | On Timeout |
|---|---|---|
| Builder | None (sync, <1ms) | N/A |
| Optimizer | 10s | Use builder output |
| Graph substitutes | 5s | Empty substitutes |
| Context enrichment | 10s | Partial context |

**Total worst case:** ~25s (enrichment + builder + optimizer + graph).
**Typical case:** ~5-8s (enrichment 200ms + builder 1ms + optimizer 3-5s + graph 500ms).

### 6.4 Logging

```
[BuilderFirst] Builder: 28 exercises, 98 sets, 15 mains — 0.1ms
[BuilderFirst] Optimizer: 2 swaps, 1 set adjustment — 4.2s, 2.1K tokens
[BuilderFirst] Validation: 0 errors, 0 warnings
[BuilderFirst] Total: 4.5s, source=builder+optimizer
```

vs current:

```
[Agent] Analysis: 1.8K input, 312 output — 8.2s — $0.006
[Agent] Generation: 5.2K input, 3.1K output — 47.3s — $0.062
[Agent] Total: 55.5s — $0.068
[Validation] 3 warnings: duplicate_exercise, volume_overflow, pattern_duplication
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**File:** `__tests__/ai-optimizer.test.ts`

| Test | Assertion |
|---|---|
| Optimizer applies valid swap | Exercise replaced, volume unchanged |
| Optimizer applies set ±1 | Sets changed, within budget |
| Optimizer invalid swap rejected | Output unchanged, status=optimizer_failed |
| Optimizer exceeds budget rejected | Output unchanged |
| Optimizer adds exercise rejected | Output unchanged (not in contract) |
| Optimizer timeout | Builder output returned, status=optimizer_failed |
| Optimizer empty response | Builder output returned, status=no_changes |
| Optimizer uses exercise not in pool | Swap rejected |

### 7.2 Integration Tests

**File:** `__tests__/builder-first-integration.test.ts`

| Test | Assertion |
|---|---|
| Full pipeline: builder → optimizer → validate | Output valid, source=builder+optimizer |
| Full pipeline: builder → optimizer fails → validate | Output valid, source=builder |
| Full pipeline: builder fails → legacy fallback | Output valid, source=heuristic |
| Feature flag off: agent path used | Existing behavior unchanged |
| Optimizer skipped (flag off) | Builder output used directly |

### 7.3 Monte Carlo (Existing)

The simulation at `builder-simulation.ts` already validates:
- 0% fatigue violations
- 4.6% avg identical programs
- Volume compliance patterns

After optimizer integration, extend simulation to verify optimizer diffs don't degrade these metrics.

### 7.4 A/B Comparison

Before full rollout:

1. Generate 20 programs with agent path (current)
2. Generate 20 programs with builder-first path (new)
3. Compare:
   - rules-engine violations (expect fewer with builder-first)
   - Volume budget compliance (expect better with builder-first)
   - Exercise diversity (expect comparable)
   - Token usage (expect ~75% reduction)
   - Generation time (expect ~85% reduction)
   - Trainer satisfaction (manual review)

---

## 8. Rollback Strategy

### 8.1 Instant Rollback

Set `ENABLE_BUILDER_FIRST=false` → reverts to agent path.

No migration needed. No DB changes. No code removal. The agent path is untouched.

### 8.2 Partial Rollback

Set `ENABLE_AI_OPTIMIZER=false` → builder output used without LLM review.

This gives deterministic, zero-cost programs as an emergency fallback.

### 8.3 Data Compatibility

The `prescription_generations` table stores:
- `ai_source`: Will be `'builder'` or `'builder+optimizer'` (new values)
- `output_snapshot`: Same `PrescriptionOutputSnapshot` type — no schema change
- `input_snapshot`: Will include `builder_stats` and `optimizer_diffs` (additive)
- `ai_model`: Will be `'haiku-4.5'` for optimizer (or `'none'` if skipped)

All existing queries, UI rendering, and trainer review flow work unchanged because `output_snapshot` format is identical.

---

## 9. Migration Timeline

| Step | Scope | Risk |
|---|---|---|
| 1. Create `ai-optimizer.ts` | New file, no production impact | None |
| 2. Add `buildOptimizerPrompt()` to prompt-builder.ts | Additive, no existing code changed | None |
| 3. Wire builder-first path in generate-program.ts | Behind feature flag, default off | None |
| 4. Test with founder's account | Single-user validation | Low |
| 5. A/B comparison (20+20 programs) | Data collection | Low |
| 6. Enable for all trainers | Feature flag flip | Medium — monitored |
| 7. Monitor 2 weeks | Observation | Low |
| 8. Remove agent full-generation path | Code cleanup | Low (flag already validated) |

---

## 10. Open Questions for Founder Review

1. **Optimizer model choice:** Claude Haiku 4.5 ($0.005/program) vs Claude Sonnet 4.6 ($0.03/program). Haiku is 6x cheaper and 4x faster. Recommend Haiku for optimizer since it's making small diffs, not generating programs.

2. **Analysis phase:** Keep the Q&A flow (trainer answers questions before generation)? The builder doesn't need it, but trainers may value the interaction. Recommendation: keep Q&A, feed answers to optimizer as context.

3. **Optimizer skip threshold:** Should the optimizer be skipped for certain profiles? E.g., beginners with no history (builder output is already optimal). This would save cost on the simplest cases.

4. **Volume simulation findings:** The Monte Carlo simulation identified structural gaps in slot templates (Panturrilha, Abdominais, Trapézio, Adutores have zero slots). Should these be addressed before or after the migration? Recommendation: after — the optimizer can flag them as attention items.

5. **`ai_source` values:** Current values are `'agent' | 'llm' | 'heuristic'`. New values would be `'builder' | 'builder+optimizer'`. This is an additive change to the JSONB field. Any concern with the UI rendering these?

---

*BUILDER_FIRST_MIGRATION_PLAN.md — v1.0 — 2026-03-09*
