# AI Prescription Engine v2 — Migration Plan

> **Status:** Foundation phase
> **Author:** Engineering
> **Date:** 2026-03-09
> **Engine version:** v2.0.0

---

## 1. Architecture Overview

### Current Architecture (v1)

```
┌────────────────────────────────────────────────────────────┐
│                      ENGINE v1                             │
│                                                            │
│  Phase 1: Analysis           Phase 2: Generation           │
│  ┌─────────────────┐         ┌─────────────────────┐       │
│  │ Claude Sonnet    │         │ Claude Sonnet        │      │
│  │ max: 2048 tok    │         │ max: 8000 tok        │      │
│  │ timeout: 30s     │         │ streaming, 120s      │      │
│  │ $3 / $15 per M   │         │ $3 / $15 per M       │      │
│  └────────┬─────────┘         └─────────┬───────────┘      │
│           │ (no fallback)               │ Fallback         │
│           ▼                             ▼                  │
│                               ┌─────────────────────┐      │
│                               │ OpenAI GPT-4o-mini   │      │
│                               │ response_format:json │      │
│                               └─────────┬───────────┘      │
│                                         │ Fallback         │
│                                         ▼                  │
│                               ┌─────────────────────┐      │
│                               │ Heuristic builder    │      │
│                               │ program-builder.ts   │      │
│                               └─────────────────────┘      │
│                                                            │
│  Post-generation: rules-engine.ts → fixViolations()        │
└────────────────────────────────────────────────────────────┘
```

**Key files:** `claude-agent.ts`, `prompt-builder.ts`, `rules-engine.ts`,
`constraints-engine.ts`, `context-enricher.ts`, `program-builder.ts`,
`exercise-selector.ts`

### Proposed Architecture (v2)

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENGINE v2                                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    program-cache.ts                        │  │
│  │  Hash(profile) → hit? Return cached program, skip LLM     │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │ miss                                 │
│                           ▼                                      │
│  Phase 1: Analysis              Phase 2: Structured Generation   │
│  ┌───────────────────┐          ┌─────────────────────────────┐  │
│  │ Claude Haiku       │          │ GPT-4.1-mini                │  │
│  │ max: 1024 tok      │          │ max: 4000 tok               │  │
│  │ timeout: 20s       │          │ structured output (schema)  │  │
│  │ $1.00 / $5.00 /M   │          │ $0.40 / $1.60 per M         │  │
│  └──────┬─────────────┘          └──────────┬──────────────────┘  │
│         │ fallback                          │ fallback 1          │
│         ▼                                   ▼                    │
│  ┌───────────────────┐          ┌─────────────────────────────┐  │
│  │ Claude Sonnet      │          │ Claude Sonnet (v1 pipeline) │  │
│  │ (existing agent)   │          │ streaming, proven           │  │
│  └───────────────────┘          └──────────┬──────────────────┘  │
│                                            │ fallback 2          │
│                                            ▼                    │
│                                 ┌─────────────────────────────┐  │
│                                 │ Heuristic (unchanged)       │  │
│                                 │ program-builder.ts          │  │
│                                 └─────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  output-enricher.ts                        │  │
│  │  Compact LLM JSON → full PrescriptionOutputSnapshot       │  │
│  │  + exercise metadata + PT-BR notes + reasoning text       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Post-generation: rules-engine.ts → fixViolations() (unchanged) │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    llm-client.ts                           │  │
│  │  Unified abstraction: Anthropic + OpenAI                  │  │
│  │  Structured output, retries, cost tracking, fallback      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Responsibilities

| Role | Model | Reason | Pricing (per 1M tokens) |
|---|---|---|---|
| **Analysis** (Phase 1) | Claude Haiku 4.5 | Excellent reasoning for short-output tasks. Fast. Cheap. | $1.00 input / $5.00 output |
| **Generation** (Phase 2) | GPT-4.1-mini | Best structured JSON output. Schema enforcement. Cost-effective. | $0.40 input / $1.60 output |
| **Fallback analysis** | Claude Sonnet (v1) | Proven pipeline, zero risk | $3.00 / $15.00 |
| **Fallback generation** | Claude Sonnet (v1) | Proven pipeline, zero risk | $3.00 / $15.00 |
| **Final fallback** | Heuristic | Deterministic, zero cost | Free |

### Why separate models?

- **Analysis** requires nuanced reasoning about medical restrictions, training history,
  and ambiguity detection. Claude Haiku excels at this with short outputs (~400 tokens).
- **Generation** is a structured data task: pick exercises from a pool, assign sets/reps,
  fill a JSON schema. GPT-4.1-mini with `response_format: json_schema` guarantees valid
  output with zero parsing failures.
- Using one model for both would either overpay for generation (Haiku doing structured
  JSON) or underperform on analysis (GPT-4.1-mini reasoning about medical edge cases).

---

## 3. Token Reduction Strategy

### 3.1 Eliminate LLM-generated text

The v1 system asks the LLM to generate:
- `exercise_name`, `exercise_muscle_group`, `exercise_equipment` (redundant — already in exerciseMap)
- `reasoning.structure_rationale` (verbose text)
- `reasoning.volume_rationale` (verbose text)
- `reasoning.workout_notes[]` (verbose text per workout)
- `notes` per exercise (free-form text)
- `program.description` (free-form text)

**v2 approach:** The LLM returns only IDs and numbers. The backend enriches
everything else from `exerciseMap` + template strings.

### 3.2 Compact output schema

v1 output per exercise (~120 tokens):
```json
{
  "exercise_id": "uuid",
  "exercise_name": "Supino Reto com Barra",
  "exercise_muscle_group": "Peito",
  "exercise_equipment": "barbell",
  "sets": 4,
  "reps": "8-12",
  "rest_seconds": 90,
  "notes": "Composto principal — âncora de volume para peito com carga controlável",
  "substitute_exercise_ids": ["uuid1", "uuid2"],
  "order_index": 0,
  "exercise_function": "main"
}
```

v2 output per exercise (~40 tokens):
```json
{
  "exercise_id": "uuid",
  "sets": 4,
  "reps": "8-12",
  "rest_seconds": 90,
  "exercise_function": "main",
  "substitute_exercise_ids": ["uuid1", "uuid2"],
  "note_key": "compound_anchor"
}
```

### 3.3 Projected savings

| Metric | v1 (Sonnet) | v2 (Haiku + GPT-4.1-mini) |
|---|---|---|
| Analysis input tokens | ~1,500 | ~1,200 (shorter prompt) |
| Analysis output tokens | ~800 | ~400 (schema-enforced) |
| Analysis cost | $0.0165 | $0.0032 |
| Generation input tokens | ~4,000 | ~3,500 (no format instructions) |
| Generation output tokens | ~6,000 | ~2,000 (compact schema) |
| Generation cost | $0.1020 | $0.0046 |
| **Total per generation** | **~$0.1185** | **~$0.0078** |
| **Reduction factor** | — | **~15x cheaper** |

### 3.4 Cache multiplier

With `program-cache.ts`, identical profiles skip LLM entirely.
Conservative estimate: 20-30% cache hit rate at scale → effective cost
reduction of **~20x**.

---

## 4. Component Responsibilities

### 4.1 `llm-client.ts` — LLM Abstraction Layer

- Unified interface for Anthropic (Claude) and OpenAI calls
- Provider-specific message formatting handled internally
- Structured output via JSON Schema (OpenAI) or prompt enforcement (Claude)
- Automatic cost tracking with per-model pricing
- Retry with configurable fallback chain
- Timeout management per call

### 4.2 `schemas.ts` — Output Schemas

- TypeScript types for compact LLM outputs (analysis + generation)
- JSON Schema objects for OpenAI `response_format: json_schema`
- Validation functions for Claude responses (which don't enforce schema natively)
- Kept flat and simple to minimize structured-output failures

### 4.3 `output-enricher.ts` — Backend Enrichment

- Maps `exercise_id` → full metadata from exerciseMap
- Translates `note_key` → localized PT-BR text
- Generates `reasoning.structure_rationale` from constraints + split type
- Generates `reasoning.volume_rationale` from computed volume vs budget
- Generates `reasoning.workout_notes` from exercise anchors per workout
- Produces complete `PrescriptionOutputSnapshot` compatible with v1 pipeline

### 4.4 `program-cache.ts` — Generation Cache

- Computes deterministic hash from profile parameters:
  training_level, goal, available_days, session_duration_minutes,
  available_equipment, medical_restrictions, favorite/disliked exercise IDs
- In-memory cache with TTL (24h default)
- Cache key includes engine version to auto-invalidate on upgrades
- Returns cached `CompactGenerationOutput` or null (miss)
- Stores after successful generation + validation

---

## 5. Caching Design

### Hash inputs

```
SHA-256(JSON.stringify({
  engine_version: "2.0.0",
  training_level,
  goal,
  available_days (sorted),
  session_duration_minutes (bucketed to 5-min increments),
  available_equipment (sorted),
  medical_restriction_descriptions (sorted),
  favorite_exercise_ids (sorted),
  disliked_exercise_ids (sorted),
}))
```

### Cache behavior

| Scenario | Action |
|---|---|
| Exact profile match, cache fresh | Return cached, skip LLM |
| Profile match, cache expired (>24h) | LLM call, update cache |
| Profile changed | Cache miss, LLM call |
| Engine version bumped | All caches invalidated |
| Trainer answers questions | Always bypass cache (personalized) |

### Storage

Phase 1: In-memory `Map<string, CacheEntry>` (simplest, works for single server).
Phase 2 (future): Supabase table or Redis if multi-server deployment needed.

---

## 6. Rollout Strategy

### Feature flag

```sql
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS prescription_engine_version TEXT DEFAULT 'v1';
-- 'v1' = current Claude Sonnet pipeline
-- 'v2' = new Haiku + GPT-4.1-mini pipeline
```

### Rollout phases

| Phase | Scope | Duration | Rollback |
|---|---|---|---|
| **0 — Foundation** | No production impact. New files compile. | 1 week | N/A |
| **1 — Shadow mode** | v2 runs in background, results logged but not shown | 1 week | Delete logs |
| **2 — Internal dogfood** | v2 enabled for 1 internal trainer | 1 week | `SET 'v1'` |
| **3 — Canary** | v2 for 10% of trainers | 2 weeks | `SET 'v1'` |
| **4 — General availability** | `DEFAULT 'v2'` for all trainers | — | `SET 'v1'` per trainer |
| **5 — Deprecation** | Remove v1 branch (keep claude-agent.ts as fallback) | 4 weeks after GA | — |

### Validation criteria (Phase 1 → 2 gate)

- [ ] Zero parsing failures in 50 shadow generations
- [ ] Average confidence_score within ±0.1 of v1
- [ ] rules-engine error rate ≤ v1
- [ ] Average cost per generation < $0.02
- [ ] p95 latency < 30s (analysis + generation)

---

## 7. Files Changed / Created

### New files (foundation — this PR)

| File | Purpose |
|---|---|
| `web/src/lib/prescription/schemas.ts` | Compact output types + JSON Schema for structured output |
| `web/src/lib/prescription/llm-client.ts` | Unified LLM abstraction (Anthropic + OpenAI) |
| `web/src/lib/prescription/output-enricher.ts` | Compact → PrescriptionOutputSnapshot conversion |
| `web/src/lib/prescription/program-cache.ts` | Deterministic profile hash + in-memory cache |
| `docs/AI_PRESCRIPTION_ENGINE_V2_PLAN.md` | This document |

### New files (future — integration PR)

| File | Purpose |
|---|---|
| `web/src/lib/prescription/llm-generator.ts` | v2 pipeline orchestrator |
| `supabase/migrations/070_prescription_engine_v2.sql` | Feature flag column |

### Files that MUST NOT be modified

| File | Reason |
|---|---|
| `claude-agent.ts` | v1 pipeline, used as fallback |
| `rules-engine.ts` | Shared validation, works with both v1 and v2 |
| `constraints-engine.ts` | Shared input computation |
| `context-enricher.ts` | Shared context fetching |
| `program-builder.ts` | Heuristic fallback |
| `exercise-selector.ts` | Shared exercise scoring |

### Files to modify (future — integration PR)

| File | Change |
|---|---|
| `generate-program.ts` | Add v1/v2 branch by feature flag |
| `analyze-context.ts` | Add v1/v2 branch for analysis phase |
| `constants.ts` | Add `ENGINE_VERSION_V2` |
| `web/package.json` | Add `openai` SDK dependency |

---

## 8. Risk Analysis

| Risk | Severity | Mitigation |
|---|---|---|
| GPT-4.1-mini selects worse exercises | HIGH | constraints-engine pre-computes all rules; rules-engine validates post-generation; smart exercise selector pre-scores pool |
| Structured output schema too strict | MEDIUM | Keep schema flat; test with real exercise pools before deploy |
| Haiku misses subtle medical edge cases | MEDIUM | Haiku only asks questions; generation decisions go through rules-engine; Sonnet fallback if Haiku fails |
| Cache returns stale program | LOW | 24h TTL; cache key includes exercise IDs and restrictions; trainer Q&A always bypasses cache |
| Regression in v1 pipeline | VERY LOW | v1 code is completely untouched; feature flag controls routing |
| OpenAI API outage | LOW | Falls back to Claude Sonnet (v1), then heuristic |

---

## 9. Cost Tracking

The `prescription_generations` table already stores `ai_model` (string) and
`generation_time_ms`. v2 changes:

- `ai_model` will contain `"gpt-4.1-mini"` or `"claude-haiku-4-5"` instead of `"claude-sonnet-4-6"`
- `ai_source` will be `"agent"` for v2 pipeline (same as v1 agent path)
- Cost is computed in `llm-client.ts` using the pricing table and logged via `console.log`
- No schema changes needed — all existing fields accommodate the new values
