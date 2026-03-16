# Tier 1 — LLM Token Optimization Report

> **Date:** 2026-03-09
> **Status:** Implemented, not deployed
> **TypeScript compilation:** Zero errors (`tsc --noEmit` passed)
> **Feature flag:** `ENABLE_COMPACT_EXERCISE_POOL` (default: `true`, set `false` to revert)
> **Branch:** feature/mobile-trainer-mode

---

## Changes Summary

### 1. Reduced Candidate Exercise Pool

**File:** `web/src/lib/prescription/exercise-selector.ts`

Replaced `SMART_GROUP_LIMITS` with two sets — original and compact — controlled by feature flag.

| Muscle Group | Before | After | Δ |
|---|---|---|---|
| Peito | 8 | 4 | -4 |
| Costas | 8 | 4 | -4 |
| Ombros | 8 | 3 | -5 |
| Quadríceps | 8 | 4 | -4 |
| Glúteo | 8 | 3 | -5 |
| Posterior de Coxa | 6 | 3 | -3 |
| Bíceps | 5 | 2 | -3 |
| Tríceps | 5 | 2 | -3 |
| Panturrilha | 4 | 2 | -2 |
| Abdominais | 6 | 2 | -4 |
| Oblíquos | 3 | 1 | -2 |
| Adutores | 3 | 1 | -2 |
| Trapézio | 3 | 1 | -2 |
| Antebraço | 2 | 1 | -1 |
| **Total** | **77** | **33** | **-44 (57%)** |

**Estimated exercises sent:** ~63 → ~28-33

Selection logic is **unchanged**: same scoring, same pattern diversity, same filtering — only the per-group caps are smaller.

### 2. Compact Exercise Serialization

**File:** `web/src/lib/prescription/prompt-builder.ts`

Both serialization paths (agent + OpenAI) now use a compact format when the flag is on.

**Before (per exercise):**
```json
{"id":"uuid","n":"Supino Reto","mg":["Peito"],"c":1,"mp":"push_horizontal","diff":"intermediate","pos":"first","prim":1,"s":85,"note":"Âncora primária"}
```
~180-220 chars → ~50-55 tokens

**After (per exercise):**
```json
{"id":"uuid","n":"Supino Reto","mg":["Peito"],"mp":"push_horizontal","subs":["uuid1","uuid2"]}
```
~120-150 chars → ~30-38 tokens

**Fields removed:**
- `c` (is_compound) — derivable from `mp` (movement_pattern)
- `diff` (difficulty_level) — pre-filtered by selector
- `pos` (session_position) — ordering done post-hoc by rules engine
- `prim` (is_primary_movement) — not used by LLM for decisions
- `s` (adequacy_score) — internal scoring metric
- `note` (prescription_notes) — curator notes, not LLM-relevant

**Field added:**
- `subs` (substitute_exercise_ids) — pre-computed from exercise graph

### 3. Pre-attached Graph Substitutes

**File:** `web/src/actions/prescription/generate-program.ts`

Before sending exercises to the LLM, calls `exerciseGraph.getSubstitutes()` for each exercise and attaches the top 2 substitutes that exist in the pool. This:

- Removes DF-9 (Intelligent Substitutes) burden from LLM
- Substitutes are graph-backed (trigram similarity ≥ 0.3)
- Only includes substitutes already in the filtered pool
- Falls back to empty array on error (no degradation)

### 4. Feature Flag

**`ENABLE_COMPACT_EXERCISE_POOL`** (env var)

| Value | Behavior |
|---|---|
| `true` (default) | Compact limits, compact serialization, graph substitutes |
| `false` | Original limits (77 max), verbose serialization, no pre-attached subs |

Flag is checked in 3 locations:
- `exercise-selector.ts` — `getSmartGroupLimits()`
- `prompt-builder.ts` — `buildAgentGenerationMessage()` + `buildUserPrompt()`
- `generate-program.ts` — substitute attachment

### 5. Token Measurement

Logs emitted per generation:

```
[LLM_OPT] exercises_sent=31
[LLM_OPT] estimated_tokens=4200
[LLM_OPT] reduction=47%
[LLM_OPT] graph_substitutes: 22/31 exercises have pre-attached subs
```

Baseline: 8,000 tokens (pre-Tier 1 exercise list average).

---

## Token Estimates

### Exercise list only (dominant cost component)

| Metric | Before | After | Reduction |
|---|---|---|---|
| Exercises sent | ~63 | ~31 | **-51%** |
| Chars per exercise | ~200 | ~135 | **-33%** |
| Total exercise chars | ~12,600 | ~4,185 | **-67%** |
| Exercise tokens | ~3,150 | ~1,046 | **-67%** |
| With metadata | ~8,000 | ~3,200 | **-60%** |

### Full prompt (estimated)

| Component | Before | After | Notes |
|---|---|---|---|
| System prompt | ~2,000 | ~2,000 | Unchanged |
| Conversation history | ~750 | ~750 | Unchanged |
| Exercise list | ~8,000 | ~3,200 | Compact format + fewer exercises |
| Legend text | ~500 | ~200 | Shorter legend |
| Trainer answers | ~200 | ~200 | Unchanged |
| **Total input** | **~11,450** | **~6,350** | **-45%** |
| Output | ~2,000 | ~2,000 | Unchanged |
| **Total** | **~13,450** | **~8,350** | **-38%** |

### Cost impact (per generation)

| Model | Before | After | Savings |
|---|---|---|---|
| Claude Sonnet ($3/$15 per 1M) | $0.065 | $0.040 | **-38%** |
| GPT-4.1-mini ($0.40/$1.60 per 1M) | $0.008 | $0.005 | **-38%** |

---

## Behavior Changes

| Area | Impact |
|---|---|
| Exercise selection scoring | **None** — same algorithm, same weights |
| Movement pattern diversity | **None** — same pass-1/pass-2 logic |
| LLM exercise choice | **Narrower pool** — LLM has fewer options per group (4 vs 8 for primaries). This is intentional: typical programs use 3-4 per primary group. |
| Substitute quality | **Improved** — graph-backed substitutes replace LLM inference |
| Post-generation validation | **None** — rules engine unchanged |
| Heuristic fallback | **None** — program-builder uses raw exercise list, not smart-selected |
| OpenAI fallback path | **Compact serialization** — same flag applies |

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Too few exercises for edge cases | Compact limits still provide 1-2 alternatives per group beyond typical need. Feature flag allows instant revert. |
| LLM needs removed fields | `is_compound` is derivable from `movement_pattern`. `difficulty_level` and `session_position` are pre-filtered by selector and enforced post-hoc by rules engine. |
| Graph substitutes are empty (no data) | Falls back to empty `subs` array. LLM can still suggest substitutes from the pool. DF-9 prompt text remains. |
| Feature flag not read in serverless | Env vars are available in Next.js server actions via `process.env`. |

---

## Files Modified

| File | Change |
|---|---|
| `web/src/lib/prescription/exercise-selector.ts` | Split `SMART_GROUP_LIMITS` into original + compact with `getSmartGroupLimits()` |
| `web/src/lib/prescription/prompt-builder.ts` | Compact serialization in `buildAgentGenerationMessage()` + `buildUserPrompt()`, updated legend, token logging |
| `web/src/actions/prescription/generate-program.ts` | Import `getSubstitutes`, attach top 2 graph subs before agent call |
| `web/.env.example` | Added `ENABLE_COMPACT_EXERCISE_POOL=true` |

---

## Validation

- [x] `tsc --noEmit` passes with zero errors
- [x] Feature flag defaults to `true` (compact enabled)
- [x] Feature flag `false` restores exact original behavior
- [x] No changes to rules-engine.ts, constraints-engine.ts, or program-builder.ts
- [x] No changes to output format or validation logic
- [x] Graph substitute attachment is fire-and-forget (errors → empty array)
- [x] Token measurement logs follow `[LLM_OPT]` prefix convention
