# Builder-First Implementation Report

## Overview

The builder-first architecture replaces the LLM-first prescription generation pipeline with a deterministic builder that produces 100% of the program, with an optional lightweight AI optimizer (Claude Haiku) for contextual refinements.

**Status**: Implemented, feature-flagged, ready for testing.

---

## Files Changed

### New File: `web/src/lib/prescription/ai-optimizer.ts` (~550 lines)

Self-contained module with all optimizer logic:

| Export | Type | Purpose |
|--------|------|---------|
| `optimizeWithAI()` | async function | Main entry — runs full optimizer pipeline |
| `shouldOptimize()` | function | Determines if optimizer should run |
| `buildContextSummary()` | function | Deterministic context extraction (replaces LLM analysis) |
| `OptimizerResult` | type | Return type with output, status, token usage |

### Modified: `web/src/actions/prescription/generate-program.ts`

- Added `import { optimizeWithAI }` (line 27)
- Added builder-first pipeline gated by `ENABLE_BUILDER_FIRST === 'true'` (lines 301-396)
- Existing agent pipeline unchanged — runs when flag is off

### Modified: `web/.env.example`

- Added `ENABLE_BUILDER_FIRST=false` (default: off)
- Added `ENABLE_AI_OPTIMIZER=true` (default: on)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ENABLE_BUILDER_FIRST=true                                      │
│                                                                 │
│  enrichStudentContext() ──► buildConstraints() ──►              │
│  selectSmartExercises() ──► buildSlotBasedProgram()             │
│       │                                                         │
│       ▼                                                         │
│  shouldOptimize(profile, enrichedContext)                        │
│       │                                                         │
│    ┌──┴──┐                                                      │
│    │ NO  │ → return builderOutput as-is                         │
│    │ YES │ → optimizeWithAI(builderOutput, ...)                 │
│    └─────┘                                                      │
│       │                                                         │
│       ▼                                                         │
│  validateOutput() ──► fixViolations() ──► save                  │
└─────────────────────────────────────────────────────────────────┘
```

### When `ENABLE_BUILDER_FIRST=false` (default)

The existing agent pipeline (`generateWithAgent()`) runs unchanged. Zero behavioral difference.

---

## Key Design Decisions

### 1. No LLM Analysis Phase

**Before**: Full LLM call to analyze student context before generating program.
**After**: `buildContextSummary()` extracts context deterministically — stalled exercises from `load_progression`, adherence from `session_patterns`, emphasized groups from constraints.

### 2. Conditional Optimizer via `shouldOptimize()`

The optimizer is skipped when it adds no value:

| Condition | Rationale |
|-----------|-----------|
| `training_level === 'beginner'` | Builder templates are already optimal |
| Completed sessions + program history < 8 | Insufficient data for contextual swaps |
| Adherence < 60% | Keep things simple for inconsistent students |

### 3. Optimizer Guardrails

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Max swaps | 2 | `parsed.swaps.slice(0, MAX_SWAPS)` |
| Max set adjustments | 2 | `parsed.set_adjustments.slice(0, MAX_SET_ADJUSTMENTS)` |
| Set change range | ±1 only | `Math.abs(adj.new_sets - item.sets) > 1` check |
| Swap targets | Graph substitutes only | Validated against `swapCandidates` |
| Timeout | 10s | `Promise.race` with timeout |

### 4. Reduced Token Input

Instead of sending the full exercise pool (~150+ exercises, 2-10K tokens), the optimizer receives only `swap_candidates`: top 3 graph substitutes per exercise in the program. This typically means ~15-25 exercises × 3 substitutes = ~45-75 candidate entries, dramatically reducing prompt size.

### 5. Model Choice

`claude-haiku-4-5-20251001` — fast, cheap, sufficient for structured diff output with constrained scope.

---

## Failure Cascade

The architecture guarantees a valid program is always returned:

1. **Builder always produces valid output** — deterministic, no LLM dependency
2. **Optimizer is optional** — if it fails (timeout, parse error, API error), builder output is returned as-is
3. **Post-optimizer validation** — if optimizer introduces errors, its structural changes are discarded (notes/flags kept)
4. **Final safety net** — if validation still fails after fix attempts, program is rebuilt from scratch

---

## Feature Flags

| Flag | Default | Effect |
|------|---------|--------|
| `ENABLE_BUILDER_FIRST` | `false` | Activates builder-first pipeline instead of agent |
| `ENABLE_AI_OPTIMIZER` | `true` | When builder-first is active, enables/disables Haiku optimizer |
| `ENABLE_SLOT_BASED_BUILDER` | `true` | Pre-existing flag for slot builder (used by both pipelines) |

---

## Audit Trail

The `prescription_generations` row includes additional metadata when builder-first is used:

```json
{
  "input_snapshot": {
    "builder_first": true,
    "optimizer_status": "optimized | no_changes | optimizer_failed | optimizer_skipped",
    "optimizer_tokens": { "input": 1200, "output": 350 }
  },
  "ai_source": "heuristic" | "agent",
  "ai_model": "slot-builder" | "claude-haiku-4-5-20251001"
}
```

---

## Expected Cost & Latency Impact

| Metric | Agent Pipeline | Builder-First (no optimizer) | Builder-First (with optimizer) |
|--------|---------------|------------------------------|-------------------------------|
| LLM calls | 1-3 (Sonnet) | 0 | 1 (Haiku) |
| Estimated tokens | 8-15K input + 3-6K output | 0 | ~1-2K input + ~500 output |
| Estimated cost | $0.03-0.10 | $0.00 | ~$0.001 |
| Latency | 8-25s | 1-3s | 3-6s |

---

## Testing Checklist

- [ ] Set `ENABLE_BUILDER_FIRST=true` in `.env.local`
- [ ] Generate prescription for a **beginner** student → optimizer should be skipped
- [ ] Generate prescription for an **intermediate** student with 10+ sessions → optimizer should run
- [ ] Set `ENABLE_AI_OPTIMIZER=false` → optimizer should be skipped regardless of student
- [ ] Remove `ANTHROPIC_API_KEY` → optimizer should gracefully skip
- [ ] Set `ENABLE_BUILDER_FIRST=false` → existing agent pipeline should work unchanged
- [ ] Verify `prescription_generations` row has `builder_first: true` in `input_snapshot`

---

## TypeScript Compilation

`tsc --noEmit` passes with zero errors in modified files. Pre-existing type errors in `builder-simulation.ts` (test file) are unrelated.
