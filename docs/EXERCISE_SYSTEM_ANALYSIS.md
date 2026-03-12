# EXERCISE_SYSTEM_ANALYSIS

## Verdict

Kinevo already contains a meaningful **implicit exercise knowledge graph**, but it is **distributed across exercise metadata, rule engines, heuristics, and swap logic**, not modeled as a dedicated graph subsystem.

Today, the strongest existing graph-like edges are:

- `Exercise -> MuscleGroup`
- `Exercise -> Equipment`
- `Exercise -> MovementPattern`
- `Exercise -> DifficultyLevel`
- `Exercise -> SessionPosition`
- `Exercise -> AI Curation / Prescription Notes`
- `WorkoutItem -> SubstituteExercise[]`

There are also some **derived / inferred relationships**:

- `Exercise(primary group) -> SecondaryMuscleGroup` via hard-coded synergy maps
- `Exercise A -> similar substitute Exercise B` via shared muscle groups + trigram similarity
- `Condition -> cautious muscle groups`
- `Condition -> contraindicated movement patterns` in definitions, but not fully enforced in the selection pipeline
- `Trainer edit history -> preferred replacements A -> B`

What does **not** exist yet is a first-class graph model for:

- exercise progressions/regressions
- canonical substitute families
- explicit biomechanical inheritance or category taxonomy
- equipment compatibility matrix per movement family
- exercise-to-exercise relationship tables
- pattern-aware clinical filtering that is enforced end-to-end

---

## 1. Exercise Data Structures

### Core TypeScript structures

- `Exercise` and `MuscleGroup` are defined as an M:N relationship in [shared/types/exercise.ts](/Users/gustavoprado/kinevo/shared/types/exercise.ts#L1) and duplicated in [web/src/types/exercise.ts](/Users/gustavoprado/kinevo/web/src/types/exercise.ts#L1).
- The AI prescription pipeline uses a richer lightweight projection, `PrescriptionExerciseRef`, in [shared/types/prescription.ts](/Users/gustavoprado/kinevo/shared/types/prescription.ts#L100). This is currently the most graph-like exercise node shape in the codebase.
- Generated workout items flatten exercise metadata into snapshots in [shared/types/prescription.ts](/Users/gustavoprado/kinevo/shared/types/prescription.ts#L168). Important limitation: `GeneratedWorkoutItem.exercise_muscle_group` stores only one group, not the full muscle-group set.

### Exercise pool mapping

- The prescription flow fetches `exercises` plus `exercise_muscle_groups -> muscle_groups`, then maps rows into `PrescriptionExerciseRef` in [web/src/actions/prescription/get-prescription-data.ts](/Users/gustavoprado/kinevo/web/src/actions/prescription/get-prescription-data.ts#L199).
- The generation pipeline does the same with curated-pool and full-pool fallback logic in [web/src/actions/prescription/generate-program.ts](/Users/gustavoprado/kinevo/web/src/actions/prescription/generate-program.ts#L615).
- `is_compound` is not persisted in the DB. It is derived at runtime from either:
  - `muscle_group_names.length >= 2`, or
  - name heuristics such as `supino`, `agachamento`, `terra`, `puxada`, in [web/src/actions/prescription/get-prescription-data.ts](/Users/gustavoprado/kinevo/web/src/actions/prescription/get-prescription-data.ts#L242) and [web/src/actions/prescription/generate-program.ts](/Users/gustavoprado/kinevo/web/src/actions/prescription/generate-program.ts#L603).

### Database-level exercise structures

- Original `exercises` table started with a single `muscle_group` column in [supabase/migrations/001_initial_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/001_initial_schema.sql#L55).
- It evolved to an array-based `muscle_groups` model in [supabase/migrations/007_exercises_legacy_migration.sql](/Users/gustavoprado/kinevo/supabase/migrations/007_exercises_legacy_migration.sql#L15).
- It then evolved again to a normalized junction table `exercise_muscle_groups` in [supabase/migrations/011_exercise_governance_v2.sql](/Users/gustavoprado/kinevo/supabase/migrations/011_exercise_governance_v2.sql#L52).

### Stale generated schema type

- The generated Supabase type file still shows the older `exercises.muscle_groups: string[] | null` shape in [shared/types/database.ts](/Users/gustavoprado/kinevo/shared/types/database.ts). It does not reflect newer fields like `difficulty_level`, `movement_pattern`, `is_ai_curated`, `prescription_notes`, or the normalized junction model. This is a schema-typing lag, not a runtime source of truth.

---

## 2. Exercise Metadata Fields

### Persisted exercise metadata already in the system

- `equipment` exists since the base schema in [supabase/migrations/001_initial_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/001_initial_schema.sql#L57).
- `difficulty_level`, `is_primary_movement`, and `session_position` were added in [supabase/migrations/037_exercise_metadata.sql](/Users/gustavoprado/kinevo/supabase/migrations/037_exercise_metadata.sql#L4).
- `movement_pattern` was added in [supabase/migrations/061_exercise_movement_pattern.sql](/Users/gustavoprado/kinevo/supabase/migrations/061_exercise_movement_pattern.sql#L8).
- `is_ai_curated` and `prescription_notes` were added in [supabase/migrations/063_ai_curated_exercises.sql](/Users/gustavoprado/kinevo/supabase/migrations/063_ai_curated_exercises.sql#L14).

### Metadata enrichment strategy

- `equipment` is classified by SQL name-pattern enrichment in [supabase/migrations/060_exercises_equipment_enrichment.sql](/Users/gustavoprado/kinevo/supabase/migrations/060_exercises_equipment_enrichment.sql#L10).
- `difficulty_level`, `is_primary_movement`, and `session_position` are seeded from name and muscle-group heuristics in [supabase/seeds/037_exercise_metadata_seed.sql](/Users/gustavoprado/kinevo/supabase/seeds/037_exercise_metadata_seed.sql#L15).
- `movement_pattern` can be inferred with a TS rule engine in [web/scripts/populate-movement-patterns.mjs](/Users/gustavoprado/kinevo/web/scripts/populate-movement-patterns.mjs#L16).
- `prescription_notes` embeds rich exercise-selection semantics, for example “alternativa segura”, “âncora primária”, “complementa compostos”, in [supabase/migrations/063_ai_curated_exercises.sql](/Users/gustavoprado/kinevo/supabase/migrations/063_ai_curated_exercises.sql#L31).

### Practical metadata categories present today

- Muscle-group membership
- Equipment family
- Movement pattern
- Difficulty
- Primary-movement flag
- Recommended session position
- AI-curation flag
- Narrative coaching notes
- Substitute exercise IDs on workout items, not on exercise nodes
- Exercise function on workout items (`warmup`, `activation`, `main`, `accessory`, `conditioning`) in [shared/types/prescription.ts](/Users/gustavoprado/kinevo/shared/types/prescription.ts#L31) and [supabase/migrations/054_exercise_function.sql](/Users/gustavoprado/kinevo/supabase/migrations/054_exercise_function.sql#L6)

---

## 3. Relationship Logic

### A. Muscle-group relationships

- `exercise_muscle_groups` is the canonical normalized many-to-many edge in [supabase/migrations/011_exercise_governance_v2.sql](/Users/gustavoprado/kinevo/supabase/migrations/011_exercise_governance_v2.sql#L56).
- The prescription engine groups exercises by muscle using `groupExercisesByMuscle()` in [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L199).
- Selection logic treats the first muscle group as the primary one in multiple places:
  - [web/src/lib/prescription/exercise-selector.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/exercise-selector.ts#L134)
  - [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L455)

### B. Equipment compatibility

- Equipment is used as a real compatibility filter in [web/src/actions/prescription/generate-program.ts](/Users/gustavoprado/kinevo/web/src/actions/prescription/generate-program.ts#L654).
- The `EQUIPMENT_MAP` in generation/analyze actions maps profile-level environment choices into permitted equipment families.
- This is graph-like as `StudentContext -> allowed equipment set -> filtered Exercise nodes`.
- Limitation: this is a flat whitelist, not a typed compatibility graph such as `movement family -> allowed equipment variants`.

### C. Substitution logic

- Manual substitutions are persisted as `substitute_exercise_ids UUID[]` on workout items in [supabase/migrations/022_exercise_swap_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/022_exercise_swap_schema.sql#L5).
- Automatic substitute suggestions are produced by `get_smart_substitutes()` in [supabase/migrations/023_smart_swap_logic.sql](/Users/gustavoprado/kinevo/supabase/migrations/023_smart_swap_logic.sql#L14).
- That RPC defines similarity as:
  - shared muscle-group overlap through `exercise_muscle_groups`
  - name similarity after normalizing implement words like `barra`, `halter`, `smith`, `banco`
- App-side substitute retrieval is in [web/src/actions/exercises/get-substitutes.ts](/Users/gustavoprado/kinevo/web/src/actions/exercises/get-substitutes.ts#L27).

### D. Trainer preference relationships

- Trainer edit history is mined into recurring `A -> B` replacement preferences in [web/src/lib/prescription/trainer-patterns.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/trainer-patterns.ts#L112).
- This is the closest thing to a learned relationship layer:
  - `Exercise A -> preferred replacement Exercise B`
  - `MuscleGroup -> frequently increased/decreased volume`
  - `MuscleGroup -> often removed / deprioritized`

### E. Clinical condition relationships

- Condition mappings already encode:
  - `Condition -> cautious muscle groups`
  - `Condition -> contraindicated movement patterns`
  - `Condition -> prescription rules`
- See [web/src/lib/prescription/condition-mappings.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/condition-mappings.ts#L15).
- Limitation: `contraindicated_patterns` exists in definitions, but repo search did not find it enforced downstream. Today, the active pipeline mainly converts conditions into `restricted_muscle_groups` and prompt guidance.

### F. Questionnaire-derived relationship hints

- The questionnaire mapper defines `painful_activity -> movement_pattern[]` in [web/src/lib/prescription/questionnaire-mapper.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/questionnaire-mapper.ts#L98).
- This is explicit graph thinking, but it is not fully materialized into exercise filtering. The derived restrictions currently persist mostly as description + muscle-group caution, not as explicit prohibited-pattern constraints.

### G. Progression / regression context

- `context-enricher.ts` computes per-exercise load trend (`progressing`, `stalled`, `regressing`) in [web/src/lib/prescription/context-enricher.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/context-enricher.ts#L169).
- Shared constants mention “stall weeks before variation” in [shared/types/prescription.ts](/Users/gustavoprado/kinevo/shared/types/prescription.ts#L339).
- Limitation: there is **no explicit exercise progression graph** such as `Goblet Squat -> Front Squat -> Back Squat`, nor a regression tree.

---

## 4. Constraint Logic

### Volume budgets per muscle group

- Fully implemented in [web/src/lib/prescription/constraints-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/constraints-engine.ts#L79).
- Budget generation includes:
  - primary vs small group classification
  - secondary-group volume factors
  - frequency-based deprioritization
  - emphasis boosting
  - capacity capping
- Supporting constants live in [web/src/lib/prescription/constants.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/constants.ts#L22).

### Movement-pattern balancing

- The selector explicitly enforces movement-pattern diversity within each muscle group in [web/src/lib/prescription/exercise-selector.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/exercise-selector.ts#L142).
- The validator warns when a workout accumulates too many exercises with the same non-isolation pattern in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L352).

### Redundancy detection

- Duplicate exact exercise usage across the generated program is detected in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L331).
- Pattern redundancy is detected as repeated movement-pattern concentration in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L352).
- There is no deep overlap score across exercises beyond muscle-group membership and pattern repetition.

### Fatigue distribution

- Partial, heuristic implementation exists:
  - session duration estimation in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L400)
  - rest minimums for compound work in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L290)
  - frequency penalties and capacity scaling in [web/src/lib/prescription/constraints-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/constraints-engine.ts#L243)
- What is missing is a dedicated fatigue model across patterns, joints, or axial loading classes.

### Compound vs accessory logic

- Strongly present, but partly heuristic:
  - `is_compound` is derived at runtime, not stored
  - at least one compound per workout is enforced in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L186)
  - compound vs accessory affects reps/rest in [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L497)
  - workout ordering uses `session_position` and `exercise_function` in [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L392) and [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L377)

### Secondary-muscle reasoning

- This is one of the most graph-like parts of the system.
- `rules-engine.ts` defines `SECONDARY_MUSCLE_GROUPS` in [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L620).
- `program-builder.ts` mirrors it as `BUILDER_SECONDARY_MAP` in [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L607).
- That logic supports:
  - direct volume attribution
  - secondary synergy attribution
  - overflow prevention
  - intelligent reduction order

This is not a general graph service, but it is already a hard-coded exercise-physiology relationship map.

---

## 5. Database Schema

### Existing exercise-related tables / columns

| Schema element | Purpose | Reference |
| --- | --- | --- |
| `exercises` | Base exercise node table | [001_initial_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/001_initial_schema.sql#L55) |
| `muscle_groups` | Canonical muscle-group nodes | [010_exercise_governance.sql](/Users/gustavoprado/kinevo/supabase/migrations/010_exercise_governance.sql#L8) |
| `exercise_muscle_groups` | M:N edge table between exercises and muscle groups | [011_exercise_governance_v2.sql](/Users/gustavoprado/kinevo/supabase/migrations/011_exercise_governance_v2.sql#L56) |
| `equipment` on `exercises` | Equipment family | [001_initial_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/001_initial_schema.sql#L57) |
| `difficulty_level` | Suitability / complexity | [037_exercise_metadata.sql](/Users/gustavoprado/kinevo/supabase/migrations/037_exercise_metadata.sql#L4) |
| `is_primary_movement` | “open the session” / anchor movement | [037_exercise_metadata.sql](/Users/gustavoprado/kinevo/supabase/migrations/037_exercise_metadata.sql#L4) |
| `session_position` | First / middle / last positioning | [037_exercise_metadata.sql](/Users/gustavoprado/kinevo/supabase/migrations/037_exercise_metadata.sql#L4) |
| `movement_pattern` | Biomechanical pattern label | [061_exercise_movement_pattern.sql](/Users/gustavoprado/kinevo/supabase/migrations/061_exercise_movement_pattern.sql#L8) |
| `is_ai_curated` | Curated engine subset flag | [063_ai_curated_exercises.sql](/Users/gustavoprado/kinevo/supabase/migrations/063_ai_curated_exercises.sql#L14) |
| `prescription_notes` | Narrative exercise semantics for selection | [063_ai_curated_exercises.sql](/Users/gustavoprado/kinevo/supabase/migrations/063_ai_curated_exercises.sql#L15) |
| `substitute_exercise_ids` | Manual substitute relationships at workout-item level | [022_exercise_swap_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/022_exercise_swap_schema.sql#L5) |
| `exercise_function` | Functional role inside a workout | [054_exercise_function.sql](/Users/gustavoprado/kinevo/supabase/migrations/054_exercise_function.sql#L6) |
| `planned_exercise_id`, `executed_exercise_id`, `swap_source` in `set_logs` | Swap traceability and history | [022_exercise_swap_schema.sql](/Users/gustavoprado/kinevo/supabase/migrations/022_exercise_swap_schema.sql#L40) |

### Tables that do **not** appear to exist

Repo-wide search did **not** reveal dedicated tables for:

- `exercise_relationships`
- `exercise_variations`
- `movement_patterns` as a standalone dimension table
- `exercise_progressions`
- `exercise_regressions`
- `biomechanical_categories`

So the system stores relationship data primarily as:

- columns on `exercises`
- a junction table to `muscle_groups`
- UUID arrays on workout items
- hard-coded TypeScript maps

---

## 6. Existing Graph-Like Relationships

### Graph model already implicit in the codebase

#### Node types

- `Exercise`
- `MuscleGroup`
- `Condition`
- `WorkoutItem`
- `TrainerPattern`

#### Persisted edges

- `Exercise -> MuscleGroup` through `exercise_muscle_groups`
- `Exercise -> Equipment` via `exercises.equipment`
- `Exercise -> MovementPattern` via `exercises.movement_pattern`
- `Exercise -> DifficultyLevel` via `exercises.difficulty_level`
- `Exercise -> SessionPosition` via `exercises.session_position`
- `Exercise -> AI Curation` via `exercises.is_ai_curated`
- `Exercise -> PrescriptionNotes` via `exercises.prescription_notes`
- `WorkoutItem -> SubstituteExercise[]` via `substitute_exercise_ids`

#### Derived edges

- `Exercise(primary target) -> Secondary muscle groups` from hard-coded synergy maps in:
  - [web/src/lib/prescription/rules-engine.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/rules-engine.ts#L620)
  - [web/src/lib/prescription/program-builder.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/program-builder.ts#L607)
- `Exercise A -> similar substitute Exercise B` from [023_smart_swap_logic.sql](/Users/gustavoprado/kinevo/supabase/migrations/023_smart_swap_logic.sql#L14)
- `Condition -> muscle groups / patterns / rules` from [condition-mappings.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/condition-mappings.ts#L15)
- `Painful activity -> movement patterns` from [questionnaire-mapper.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/questionnaire-mapper.ts#L98)
- `Trainer history -> preferred replacement edge A -> B` from [trainer-patterns.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/trainer-patterns.ts#L112)

### What makes this “graph-like” instead of “just flat metadata”

- The selector and builder traverse these edges to choose exercises.
- The rules engine traverses them to validate volume, redundancy, and safety.
- The swap RPC traverses them to suggest alternatives.
- The curation metadata adds semantic meaning that goes beyond a simple CRUD library.

### Main limitation of the current implicit graph

- Relationships are not centralized.
- Different modules re-encode similar knowledge independently.
- Some edges are persisted, others are inferred, others are hard-coded.
- There is no canonical relationship taxonomy or API layer.

---

## 7. Missing Knowledge Graph Components

### Missing explicit relationship types

- `Exercise -> ProgressionOf -> Exercise`
- `Exercise -> RegressionOf -> Exercise`
- `Exercise -> SubstituteFor -> Exercise` at the exercise-node level
- `Exercise -> VariantOf -> Exercise`
- `Exercise -> ContraindicatedForCondition -> Condition`
- `Exercise -> CompatibleWithEquipmentProfile -> Environment`
- `Exercise -> FatigueClass / AxialLoadClass / StabilityDemand`
- `Exercise -> JointDemand / PlaneOfMotion / Unilateral-Bilateral`

### Missing enforcement gaps

- `contraindicated_patterns` exists in condition mappings, but is not enforced in exercise filtering.
- Questionnaire `PAIN_TO_PATTERNS` creates movement-pattern hints, but those hints are not turned into hard exercise exclusions.
- Periodization constants exist, but not an exercise progression graph.
- `stall_weeks_before_variation` exists as a constant, but there is no concrete variation lookup table to act on it.

### Missing normalization

- `is_compound` is derived repeatedly instead of stored or derived from canonical movement metadata.
- `exercise_muscle_group` in generated items is lossy; it stores one selected attribution rather than the full relationship set.
- `substitute_exercise_ids` lives on workout items, so substitute knowledge is program-instance-centric, not library-centric.

### Missing introspection / query surface

- No repository-wide graph query API such as “give me all chest push_h exercises compatible with dumbbells and safe for shoulder impingement”.
- No central relation registry or DSL.

---

## 8. Opportunities To Evolve Into a Full Exercise Knowledge Graph

### 1. Promote existing metadata into a canonical graph model

Use the current `PrescriptionExerciseRef` fields as the starting exercise-node schema:

- `muscle_group_names`
- `equipment`
- `movement_pattern`
- `difficulty_level`
- `is_primary_movement`
- `session_position`
- `is_ai_curated`
- `prescription_notes`

This is already enough to stand up a usable graph-backed recommendation layer.

### 2. Add a dedicated exercise relationship table

Recommended shape:

- `exercise_relationships`
- columns: `source_exercise_id`, `target_exercise_id`, `relationship_type`, `weight`, `metadata`, `created_at`

Useful `relationship_type` values:

- `substitute`
- `progression`
- `regression`
- `variation`
- `same_pattern`
- `same_primary_muscle`
- `secondary_synergy`
- `lower_skill_alternative`
- `home_gym_alternative`
- `machine_supported_alternative`

### 3. Normalize currently hard-coded synergy maps

Move these maps out of TS constants into persisted relationships:

- `Quadríceps -> Glúteo`
- `Posterior de Coxa -> Glúteo`
- `Peito -> Ombros / Tríceps`
- `Costas -> Bíceps`
- `Ombros -> Tríceps`

This would unify:

- volume accounting
- overflow prevention
- substitution quality
- clinical filtering

### 4. Convert condition restrictions into executable graph constraints

Current condition mappings already have the right conceptual shape. Next step:

- enforce `Condition -> contraindicated movement patterns`
- map conditions to equipment preferences or exclusions
- map conditions to safer substitute families

### 5. Persist substitute knowledge at library level

Keep `substitute_exercise_ids` on workout items for trainer overrides, but add library-level substitute edges so the system can learn and reuse them globally.

### 6. Add progression/regression families

The codebase already tracks exercise performance trends in [web/src/lib/prescription/context-enricher.ts](/Users/gustavoprado/kinevo/web/src/lib/prescription/context-enricher.ts#L169). The missing piece is a graph that tells the engine what to do when an exercise is stalled, regressing, too technical, or unsafe.

### 7. Centralize graph access

Today the relationship logic is scattered across:

- selection
- constraints
- validation
- swaps
- questionnaire mapping
- trainer-pattern mining

A dedicated graph service would reduce duplicated heuristics and align behavior across AI and heuristic paths.

---

## Summary

Kinevo is **not starting from zero**. It already has the raw ingredients of an exercise knowledge graph:

- normalized exercise-to-muscle edges
- biomechanical movement tags
- equipment tags
- curated exercise semantics
- substitute relationships
- trainer-preference replacement patterns
- secondary-muscle synergy logic

The current architecture is best described as:

**“A partially normalized exercise metadata model with graph-like reasoning implemented in application logic.”**

That is a strong base for evolving into a full Exercise Knowledge Graph, but the next step should be to **promote relationships to first-class persisted edges** instead of continuing to encode them ad hoc across multiple modules.
