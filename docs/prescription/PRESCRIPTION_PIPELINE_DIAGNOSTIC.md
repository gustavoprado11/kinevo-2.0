# Prescription Pipeline Diagnostic Report

> **Date:** 2026-03-09
> **Scope:** Analysis only — no code modifications
> **Trigger:** ~63 exercises sent to LLM, ~14k input tokens per generation

---

## 1. Current Pipeline Architecture

### Full flow (Agent path — primary)

```
generateProgram(studentId, agentState)
│
├── 1. Auth check (supabase)
├── 2. Trainer lookup + feature flag
├── 3. Student lookup
├── 4. Fetch prescription profile (student_prescription_profiles)
├── 5. Fetch exercises (fetchExercisesForPrescription)          ← DB query
│     └── Curated exercises filtered by equipment + favorites
├── 6. Build performance context (buildPerformanceContext)       ← DB query
├── 7. Resolve AI mode (resolveAiMode)                          ← deterministic
├── 8. Validate input (validateInput)                           ← deterministic
├── 9. Build input snapshot                                     ← deterministic
│
├── 10a. Agent path:
│   ├── Enrich student context (enrichStudentContext)            ← DB query (5 parallel)
│   ├── Apply volume trade-off answer                           ← deterministic
│   ├── Build constraints (buildConstraints)                    ← deterministic
│   ├── Smart exercise selection (selectSmartExercises)         ← deterministic
│   ├── Generate with agent (generateWithAgent)                 ← LLM CALL
│   │     ├── buildAgentSystemPrompt (constraints, patterns)    ← prompt construction
│   │     └── buildAgentGenerationMessage (answers, exercises)  ← exercise list
│   ├── Validate output (validateOutput)                        ← deterministic
│   ├── Fix violations (fixViolations)                          ← deterministic
│   └── Save to prescription_generations                        ← DB write
│
├── 10b. OpenAI fallback:
│   ├── buildPromptPair (profile, exercises, perf)              ← prompt construction
│   ├── OpenAI API call                                         ← LLM CALL
│   ├── parseAiResponse                                         ← deterministic
│   ├── validateOutput                                          ← deterministic
│   └── fixViolations                                           ← deterministic
│
└── 10c. Heuristic fallback:
      └── buildHeuristicProgram (profile, exercises)            ← FULLY DETERMINISTIC
```

### Files involved

| File | Role | Phase |
|---|---|---|
| `generate-program.ts` | Orchestrator, exercise fetcher | Pre/Post-LLM |
| `context-enricher.ts` | Deep DB context (programs, loads, sessions) | Pre-LLM |
| `constraints-engine.ts` | Split, volume, rep ranges, adherence | Pre-LLM |
| `exercise-selector.ts` | Score-based pool reduction + pattern diversity | Pre-LLM |
| `prompt-builder.ts` | System + user prompt construction | LLM input |
| `claude-agent.ts` | Claude API call (streaming) | LLM |
| `rules-engine.ts` | Output validation + auto-fix | Post-LLM |
| `program-builder.ts` | Complete heuristic fallback | Fallback |
| `condition-mappings.ts` | Clinical condition text for prompts | Pre-LLM |
| `constants.ts` | Volume ranges, splits, rep ranges, rest | All phases |

---

## 2. Deterministic Logic Already Present

### Pre-LLM (all deterministic)

| Component | File:Line | What it decides | Could replace LLM? |
|---|---|---|---|
| **Split selection** | `constraints-engine.ts:197` | full_body / upper_lower / ppl_plus / ppl_complete | Yes — already fully deterministic |
| **Split detail** | `constraints-engine.ts:202` | Which muscle groups go in which workout, with day scheduling | Yes — template-based, no LLM needed |
| **Volume budgets** | `constraints-engine.ts:220` | Min/max weekly sets per muscle group per training level | Yes — deterministic from level |
| **Frequency priority** | `constraints-engine.ts:280` | Cut/minimize secondary groups at low frequencies | Yes — lookup table |
| **Emphasis** | `constraints-engine.ts:388` | Elevate volume min for emphasized groups | Yes — deterministic |
| **Volume capping** | `constraints-engine.ts:311` | Scale budget down if unrealistic for session capacity | Yes — arithmetic |
| **Exercises/session** | `constraints-engine.ts:243` | Max exercises per workout based on duration + adherence | Yes — formula |
| **Rep ranges** | `constants.ts:128` | Compound/isolation ranges per goal | Yes — lookup table |
| **Rest seconds** | `constants.ts:138` | Rest per exercise type per goal | Yes — lookup table |
| **Exercise scoring** | `exercise-selector.ts:58` | 4-factor adequacy score (safety, novelty, difficulty, preference) | Yes — deterministic |
| **Pattern diversity** | `exercise-selector.ts:152` | Ensure movement pattern coverage within groups | Yes — deterministic |
| **Adherence** | `constraints-engine.ts:174` | Normal/reduced/minimal classification | Yes — thresholds |
| **AI mode** | `rules-engine.ts:586` | Auto/copilot/assistant mode | Yes — rule-based |

### Post-LLM (all deterministic)

| Component | File:Line | What it validates/fixes |
|---|---|---|
| **Medical restriction check** | `rules-engine.ts:131` | Ensures no restricted exercises in output |
| **Exercise-in-pool check** | `rules-engine.ts:169` | Ensures all IDs exist in provided pool |
| **Compound-per-workout** | `rules-engine.ts:187` | At least 1 compound per workout |
| **Volume max enforcement** | `rules-engine.ts:216` | Weekly sets per group ≤ budget max |
| **Volume min check** | `rules-engine.ts:427` | Weekly sets per group ≥ budget min |
| **Small group limits** | `rules-engine.ts:239` | Exercise count limits per week per level |
| **Rest minimum** | `rules-engine.ts:291` | Compound rest ≥ minimum |
| **Day scheduling** | `rules-engine.ts:314` | Scheduled days match available days |
| **Duplicate detection** | `rules-engine.ts:331` | No exercise appears twice |
| **Pattern diversity** | `rules-engine.ts:352` | Max 2 of same movement pattern per workout |
| **Function ordering** | `rules-engine.ts:377` | main → accessory → conditioning order |
| **Duration estimate** | `rules-engine.ts:400` | Total time ≤ 120% of session duration |
| **Volume auto-fix** | `rules-engine.ts:678` | Reduces sets when over budget |
| **Ordering auto-fix** | `rules-engine.ts:540` | Re-sorts by exercise function |

### Complete heuristic builder (fully deterministic)

`program-builder.ts` already produces a complete valid program:

1. Resolve split template from frequency
2. Filter exercises (medical, disliked)
3. Phase 1: One compound per primary group (scored, shuffled)
4. Phase 2: One exercise per small group (respecting weekly limits)
5. Phase 3: Fill remaining slots with primary group accessories
6. Order by session_position
7. Assign exercise_function (main/accessory)
8. Cap secondary volume overflow
9. Generate reasoning text

**This builder passes `validateOutput()` without error-severity violations.**

---

## 3. LLM Responsibilities Today

### What the LLM actually decides

| Decision | LLM exclusive? | Could be deterministic? |
|---|---|---|
| **Select specific exercises** from scored pool | Yes | **Yes** — heuristic builder already does this |
| **Assign sets** per exercise | Yes | **Yes** — volume budget ÷ occurrences per group |
| **Choose exercise_function** | Yes | **Mostly** — compound=main, isolation=accessory. Only activation/conditioning need judgment |
| **Write exercise notes** | Yes | **Partially** — v2 `ExerciseNoteKey` enum covers 12 semantic keys; backend translates to text |
| **Generate substitute_exercise_ids** | Yes | **Yes** — exercise graph `getSubstitutes()` + trigram RPC already exist |
| **Write reasoning text** | Yes | **Yes** — program-builder.ts already generates basic reasoning; output-enricher.ts generates richer text from constraints |
| **Adjust for stalled exercises** | Yes | **Partially** — context-enricher detects stalls; graph `findVariationForStalled()` can suggest alternatives |
| **Honor trainer emphasis** | Partially (constraints set volume) | **Yes** — constraints already elevate volume min for emphasized groups |
| **Respect clinical conditions** | Partially (prompt text) | **Yes** — exercise graph `filterBySafety()` enforces constraints at pool level |

### Token breakdown (estimated from `buildAgentGenerationMessage`)

| Prompt section | Est. chars | Est. tokens | % of total |
|---|---|---|---|
| System prompt (methodology + decision framework + constraints) | ~8,000 | ~2,000 | 14% |
| Conversation history (analysis + Q&A) | ~3,000 | ~750 | 5% |
| Exercise list (~63 exercises with metadata) | ~32,000 | ~8,000 | **57%** |
| Generation instructions + legend | ~2,000 | ~500 | 4% |
| Trainer answers | ~800 | ~200 | 1% |
| **Total input** | **~46,000** | **~11,500** | |
| Output (program JSON + reasoning) | ~8,000 | ~2,000 | |
| **Total (in + out)** | **~54,000** | **~13,500** | |

**The exercise list dominates input tokens at ~57%.**

---

## 4. Candidate Pool Analysis

### Current pool pipeline

```
DB (all exercises)
  └── is_ai_curated = true  ──────────────── ~72 exercises (migration 063)
      └── equipment filter (EQUIPMENT_MAP)  ── ~55-70 exercises
          └── + non-curated favorites ──────── ~55-75 exercises
              └── selectSmartExercises()  ──── ~50-63 exercises (SMART_GROUP_LIMITS)
                  └── SENT TO LLM ─────────── ~63 exercises (observed)
```

### SMART_GROUP_LIMITS (current caps)

| Group | Limit | Typical needed |
|---|---|---|
| Peito | 8 | 3-4 |
| Costas | 8 | 3-4 |
| Ombros | 8 | 2-3 |
| Quadríceps | 8 | 3-4 |
| Glúteo | 8 | 2-3 |
| Posterior de Coxa | 6 | 2-3 |
| Bíceps | 5 | 1-2 |
| Tríceps | 5 | 1-2 |
| Panturrilha | 4 | 1-2 |
| Abdominais | 6 | 1-2 |
| Oblíquos | 3 | 0-1 |
| Adutores | 3 | 0-1 |
| Trapézio | 3 | 0-1 |
| Antebraço | 2 | 0-1 |
| **Total** | **77** | **~25-35** |

The current limits send **2-3x more exercises than the LLM actually uses.**

A typical 5-day PPL program uses:
- 5 workouts × 6 exercises = 30 exercises
- With substitutes: ~30 unique exercises needed
- The LLM receives 63 → discards ~33 (52%)

### What each exercise costs in tokens

Per exercise in compact format:
```json
{"id":"uuid-36-chars","n":"Supino Reto com Barra","mg":["Peito"],"c":1,"mp":"push_horizontal","diff":"intermediate","pos":"first","prim":1,"s":85,"note":"Âncora primária de push horizontal"}
```
~180-220 chars → ~50-55 tokens per exercise.

63 exercises × 50 tokens = **~3,150 tokens** just for exercise IDs and names.
With all metadata: **~8,000 tokens** (57% of input).

---

## 5. Opportunities to Reduce LLM Work

### Tier 1: High impact, low risk (move to deterministic)

| Opportunity | Token reduction | Implementation |
|---|---|---|
| **Shrink exercise pool to ~25-30** | -1,500-2,000 tokens | Reduce SMART_GROUP_LIMITS to "typical needed" values |
| **Pre-assign exercise_function** | -200 tokens (prompt text) | compound=main, isolation=accessory. Remove DF-3 from prompt |
| **Pre-attach substitutes from graph** | -500 tokens (DF-9 text) | `getSubstitutes()` in output-enricher.ts |
| **Remove exercise metadata LLM doesn't use** | -1,500 tokens | Drop `pos`, `prim`, `diff` from exercise list. LLM doesn't meaningfully use these — ordering is done post-hoc |
| **Total Tier 1** | **~3,700-4,200 tokens** | **~30% reduction** |

### Tier 2: Medium impact, medium risk (simplify LLM role)

| Opportunity | Token reduction | Implementation |
|---|---|---|
| **Pre-build workout skeletons** | -2,000 tokens (DF text) | Deterministic builder assigns exercises to workout slots; LLM only approves/swaps |
| **Replace text reasoning with enum keys** | -800 tokens (output) | v2 `ExerciseNoteKey` + backend text generation (output-enricher.ts already built) |
| **Remove Decision Framework from prompt** | -3,000 tokens | If LLM role is reduced to "pick from pre-scored candidates", most DF rules are unnecessary |
| **Remove methodology section** | -800 tokens | Volume/rep/rest rules are enforced by constraints; LLM doesn't need to "know" them |
| **Total Tier 2** | **~6,600 tokens** | **~47% reduction** |

### Tier 3: Maximum reduction (hybrid builder)

| Opportunity | Token reduction | Implementation |
|---|---|---|
| **Deterministic builder generates full program** | N/A | Already exists in program-builder.ts |
| **LLM only reviews + adjusts** | -10,000+ tokens | Send pre-built program + "approve or suggest changes" |
| **LLM generates only reasoning text** | -6,000+ tokens | Remove exercise selection from LLM entirely |
| **Total Tier 3** | **~10,000-12,000 tokens** | **~85% reduction** |

---

## 6. Estimated Token Reduction

### Current baseline

| Metric | Value |
|---|---|
| Input tokens (observed) | ~11,500 |
| Output tokens (observed) | ~2,000 |
| Total tokens | ~13,500 |
| Cost per generation (Claude Sonnet) | ~$0.065 |
| Cost per generation (GPT-4.1-mini) | ~$0.008 |

### Projected by tier

| Approach | Input tokens | Output tokens | Total | Reduction |
|---|---|---|---|---|
| **Current** | 11,500 | 2,000 | 13,500 | — |
| **Tier 1** (shrink pool + remove metadata) | ~7,500 | 2,000 | 9,500 | **30%** |
| **Tier 1+2** (simplified LLM role) | ~4,000 | 1,200 | 5,200 | **61%** |
| **Tier 3** (hybrid: LLM reviews builder output) | ~2,500 | 800 | 3,300 | **76%** |
| **No LLM** (pure heuristic) | 0 | 0 | 0 | **100%** |

### Cost projections (per generation)

| Approach | Claude Sonnet | GPT-4.1-mini | Heuristic |
|---|---|---|---|
| Current | $0.065 | $0.008 | $0.00 |
| Tier 1 | $0.045 | $0.005 | — |
| Tier 1+2 | $0.025 | $0.003 | — |
| Tier 3 (hybrid) | $0.015 | $0.002 | — |

---

## 7. Proposed Hybrid Builder Architecture

### Architecture: Deterministic Builder + AI Optimizer

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC BUILDER                        │
│                                                                 │
│  1. Constraints Engine ──────── split, volume, reps, rest       │
│  2. Exercise Graph ──────────── safety filter, substitutes      │
│  3. Smart Selector ──────────── score + rank per slot           │
│  4. Slot Filler ─────────────── assign top exercise per slot    │
│  5. Volume Balancer ─────────── distribute sets per budget      │
│  6. Order + Function ────────── session_position + function     │
│  7. Substitute Attacher ─────── graph-based substitutes         │
│  8. Reasoning Generator ─────── template-based from constraints │
│                                                                 │
│  OUTPUT: Complete valid program (passes validateOutput)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI OPTIMIZER                               │
│                                                                 │
│  INPUT: Pre-built program + student context (compact)           │
│  ROLE: Review + suggest specific adjustments                    │
│                                                                 │
│  What it CAN change:                                            │
│    • Swap 1-2 exercises for better context fit                  │
│    • Adjust sets ±1 within budget bounds                        │
│    • Add attention_flags for the trainer                        │
│    • Write personalized notes (why this exercise for THIS       │
│      student, referencing stalled exercises, preferences)       │
│                                                                 │
│  What it CANNOT change:                                         │
│    • Split structure (determined by constraints)                │
│    • Muscle groups per workout (template-based)                 │
│    • Volume budget boundaries (enforced by constraints)         │
│    • Exercise pool (pre-filtered for safety)                    │
│    • Rep ranges / rest seconds (goal-determined)                │
│                                                                 │
│  TOKEN BUDGET: ~2,500 input, ~800 output                       │
│  FALLBACK: Skip optimizer, use builder output as-is             │
└─────────────────────────────────────────────────────────────────┘
```

### What percentage moves out of the LLM

| Responsibility | Current owner | Proposed owner | % of LLM work |
|---|---|---|---|
| Split selection | Constraints (deterministic) | Same | Already 0% |
| Volume budgets | Constraints (deterministic) | Same | Already 0% |
| Exercise selection | **LLM** | **Builder** | ~35% moved out |
| Sets assignment | **LLM** | **Builder** | ~10% moved out |
| Exercise ordering | **LLM** + post-fix | **Builder** | ~5% moved out |
| Substitute generation | **LLM** | **Graph + Builder** | ~10% moved out |
| exercise_function | **LLM** | **Builder** | ~5% moved out |
| Reasoning text | **LLM** | **Builder + Enricher** | ~15% moved out |
| **Contextual adjustments** | **LLM** | **AI Optimizer** | Remains ~20% |
| **Total** | 100% LLM | **~80% deterministic** | **~80% moved out** |

### What the AI Optimizer prompt would look like

```
You are reviewing a pre-built training program for [student name].
The program was constructed by the Kinevo engine and passes all validation rules.

STUDENT CONTEXT:
- [3-5 lines of context: level, goal, stalled exercises, adherence]

PRE-BUILT PROGRAM:
[compact program: ~20-25 exercises with IDs, sets, reps]

AVAILABLE SWAPS (top 2 alternatives per exercise):
[from exercise graph, ~15-20 swap options]

INSTRUCTIONS:
1. Review each exercise choice. Suggest swaps ONLY if clearly better for this student's context.
2. Add 1-3 attention_flags for the trainer.
3. Write personalized notes for key exercises (max 5).
4. Return JSON with: swaps[], flags[], notes[].

If the program is good as-is, return: {"swaps":[], "flags":[], "notes":[]}
```

**Estimated tokens: ~2,500 input + ~800 output = ~3,300 total (76% reduction).**

### Implementation path

| Phase | What changes | Risk | Effort |
|---|---|---|---|
| **A** | Reduce SMART_GROUP_LIMITS + strip unused metadata | None | Small |
| **B** | Pre-assign exercise_function + substitutes from graph | Low | Small |
| **C** | Upgrade heuristic builder to "slot filler" with graph scoring | Medium | Medium |
| **D** | Replace full LLM generation with AI Optimizer review | Medium | Medium |
| **E** | A/B test: builder-only vs. builder+optimizer vs. current | Low | Medium |

### Key insight

**The heuristic builder (`program-builder.ts`) already generates programs that pass validation.** The main value the LLM adds today is:

1. **Contextual exercise selection** — choosing exercises that fit the student's specific history, stalled exercises, and trainer preferences. The builder uses scoring + randomization instead.

2. **Personalized notes** — explaining WHY each exercise was chosen for THIS student. The builder generates generic reasoning.

3. **Nuanced adjustments** — things like "this student has been doing Supino Reto for 3 months, let's try Supino Inclinado for stimulus variation."

A hybrid approach preserves these benefits at ~20% of the current token cost by having the builder do 80% of the work and the AI optimize the remaining 20%.

---

## Summary

| Finding | Impact |
|---|---|
| Exercise list is 57% of input tokens | Pool reduction is the single highest-impact optimization |
| Heuristic builder already produces valid programs | The LLM is not strictly necessary for correctness |
| 80% of program decisions are already deterministic | LLM is over-scoped for its actual contribution |
| Decision Framework (11 rules) is ~3,000 tokens | Can be eliminated if LLM role is narrowed |
| Exercise graph enables deterministic substitutes | Removes substitute generation from LLM |
| SMART_GROUP_LIMITS allow 2-3x more exercises than used | Immediate 30% reduction possible by tightening limits |
