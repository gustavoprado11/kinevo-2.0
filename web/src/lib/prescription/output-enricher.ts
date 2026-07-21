// ============================================================================
// Kinevo Prescription Engine v2 — Output Enricher
// ============================================================================
// Converts the compact LLM output (IDs + numbers only) into a full
// PrescriptionOutputSnapshot that is compatible with the existing v1 pipeline.
//
// Responsibilities:
//   1. Map exercise_id → name, muscle_group, equipment from exerciseMap
//   2. Translate note_key → localized PT-BR exercise notes
//   3. Generate reasoning.structure_rationale from constraints + split
//   4. Generate reasoning.volume_rationale from computed volume vs budget
//   5. Generate reasoning.workout_notes from exercise anchors
//   6. Generate program.description from profile data
//
// The LLM never generates free-form text — all human-readable output
// comes from this module.

import type {
    PrescriptionOutputSnapshot,
    PrescriptionExerciseRef,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    PrescriptionReasoning,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import type { PrescriptionConstraints } from './constraints-engine'
import type { CompactGenerationOutput, ExerciseNoteKey } from './schemas'
import { computeWeeklyVolumePerMuscle } from './rules-engine'
import { PRIMARY_MUSCLE_GROUPS } from './constants'

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Converts a CompactGenerationOutput into a full PrescriptionOutputSnapshot.
 * This is the bridge between the v2 compact LLM output and the existing
 * v1 data structures used by rules-engine, UI components, and the database.
 */
export function enrichCompactOutput(
    compact: CompactGenerationOutput,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
): PrescriptionOutputSnapshot {
    // Issue 1 (auto-substitution pre-pass): when the LLM emits an exercise_id
    // that isn't in the pool, swap it for a compatible candidate from the same
    // workout's intended muscle groups before the main enrichment runs. This
    // recovers from hallucinations silently when there's a safe alternative;
    // truly unresolvable cases fall through to the existing R_POOL_UNKNOWN_EXERCISE
    // path (retry loop in generate-program.ts → hard-fail if also exhausted).
    const substitutions = applyAutoSubstitutions(compact, exerciseMap, constraints)
    if (substitutions.length > 0) {
        console.warn(
            `[Smart-v2][autoSubst] count=${substitutions.length} ` +
            `details=${JSON.stringify(substitutions)}`,
        )
    }

    // Fase 2.5.2: surface IDs the LLM referenced that aren't in the pool AND
    // couldn't be auto-substituted. The rules-validator (R_POOL_UNKNOWN_EXERCISE)
    // catches these and triggers a semantic retry; we log here so the detection
    // is visible in logs at the enrichment layer — useful when the retry also
    // fails and we want to understand what the LLM kept hallucinating.
    const missingIds: string[] = []
    for (const cw of compact.workouts) {
        for (const it of cw.items) {
            if ((it.item_type ?? 'exercise') !== 'exercise') continue
            if (it.exercise_id && !exerciseMap.has(it.exercise_id)) {
                missingIds.push(it.exercise_id)
            }
        }
    }
    if (missingIds.length > 0) {
        console.warn(
            `[Smart-v2][missingIds] count=${missingIds.length} ` +
            `poolSize=${exerciseMap.size} ids=${JSON.stringify(missingIds)}`,
        )
    }

    // 1. Enrich workouts with exercise metadata
    const workouts = compact.workouts.map((cw, wi) =>
        enrichWorkout(cw, wi, exerciseMap)
    )

    // 2. Generate reasoning from constraints + enriched workouts
    const reasoning = generateReasoning(
        workouts,
        compact,
        constraints,
        profile,
        exerciseMap,
    )

    // 3. Generate program description
    const description = generateProgramDescription(profile, constraints)

    return {
        program: {
            name: compact.program.name,
            description,
            duration_weeks: compact.program.duration_weeks,
        },
        workouts,
        reasoning,
    }
}

// ============================================================================
// Workout Enrichment
// ============================================================================

function enrichWorkout(
    compact: CompactGenerationOutput['workouts'][number],
    fallbackIndex: number,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): GeneratedWorkout {
    return {
        name: compact.name,
        order_index: compact.order_index ?? fallbackIndex,
        scheduled_days: compact.scheduled_days,
        workout_type: compact.workout_type ?? 'strength',
        items: compact.items.map((item, ii) =>
            enrichWorkoutItem(item, ii, exerciseMap)
        ),
    }
}

function enrichWorkoutItem(
    compact: CompactGenerationOutput['workouts'][number]['items'][number],
    fallbackIndex: number,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): GeneratedWorkoutItem {
    const itemType = compact.item_type || 'exercise'

    // Warmup/cardio items don't need exercise enrichment
    if (itemType === 'warmup' || itemType === 'cardio') {
        return {
            item_type: itemType,
            order_index: fallbackIndex,
            item_config: compact.item_config ?? {},
            exercise_id: null,
            exercise_name: null,
            exercise_muscle_group: null,
            exercise_equipment: null,
            sets: null,
            reps: null,
            rest_seconds: null,
            notes: null,
            substitute_exercise_ids: [],
            exercise_function: null,
        }
    }

    const exercise = compact.exercise_id ? exerciseMap.get(compact.exercise_id) : undefined

    return {
        item_type: 'exercise',
        exercise_id: compact.exercise_id!,
        exercise_name: exercise?.name ?? 'Exercício desconhecido',
        exercise_muscle_group: exercise?.muscle_group_names[0] ?? '',
        exercise_equipment: exercise?.equipment ?? null,
        sets: compact.sets!,
        reps: compact.reps!,
        rest_seconds: compact.rest_seconds!,
        // Issue 2 — strict filter: only render notes for the keys that carry
        // information the trainer actually needs to see. The LLM still emits
        // the full enum, but the backend silently discards keys the trainer
        // already infers from the card itself (function + muscle group +
        // exercise name). Currently only clinical_safe_pick passes through
        // because medical-restriction reasoning is the one signal that's
        // never obvious from the card and is critical for trainer review.
        notes: shouldDisplayNoteKey(compact.note_key)
            ? translateNoteKey(compact.note_key!, exercise)
            : null,
        substitute_exercise_ids: compact.substitute_exercise_ids ?? [],
        order_index: fallbackIndex,
        exercise_function: compact.exercise_function,
    }
}

/**
 * Whitelist of note_keys that the UI is allowed to render.
 * Configured strictly per product decision (Issue 2): only clinical_safe_pick
 * survives. To re-enable other keys, add them here — translations remain in
 * NOTE_TRANSLATIONS below so re-enabling is a one-line change.
 */
const DISPLAYABLE_NOTE_KEYS: ReadonlySet<NonNullable<ExerciseNoteKey>> = new Set([
    'clinical_safe_pick',
])

function shouldDisplayNoteKey(key: ExerciseNoteKey | null | undefined): boolean {
    if (!key) return false
    return DISPLAYABLE_NOTE_KEYS.has(key)
}

// ============================================================================
// Issue 1 — Auto-substitution for hallucinated exercise IDs
// ============================================================================
// When the LLM emits an exercise_id that doesn't exist in the pool, instead of
// surrendering to the "Exercício desconhecido" fallback we attempt a silent
// recovery: pick a compatible exercise from the same workout's intended muscle
// groups (constraints.split_detail[wi].muscle_groups) that isn't already in
// the workout and isn't on the prohibited list.
//
// Strategy:
//   1. For each workout, build the set of already-resolved sibling IDs.
//   2. For each item with a hallucinated ID, score every pool candidate:
//        +20 if primary muscle group is in this workout's intended groups
//        +10 if exercise_function matches (compound for "main", non-compound
//             for "accessory") — soft signal, not a hard filter
//        −∞ if already in the workout, prohibited, or no muscle-group match
//             at all
//      Return the highest-scoring candidate; null if none qualify.
//   3. Mutate compact.workouts[wi].items[ii].exercise_id in place; record the
//      substitution for telemetry.
//
// Truly unresolvable cases (no compatible candidate in the pool) fall through
// to R_POOL_UNKNOWN_EXERCISE, which triggers the semantic retry in
// generate-program.ts — and after retries are exhausted, the hard-fail.

export interface AutoSubstitution {
    workout_index: number
    item_index: number
    old_id: string
    new_id: string
    target_group: string | null
}

function applyAutoSubstitutions(
    compact: CompactGenerationOutput,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    constraints: PrescriptionConstraints,
): AutoSubstitution[] {
    const substitutions: AutoSubstitution[] = []
    const prohibited = new Set(constraints.prohibited_exercise_ids ?? [])

    for (let wi = 0; wi < compact.workouts.length; wi++) {
        const workout = compact.workouts[wi]
        const intendedGroups = new Set(
            constraints.split_detail?.[wi]?.muscle_groups ?? [],
        )

        // Two-pass: first collect IDs already resolved (siblings) so we don't
        // pick the same exercise twice; then resolve the broken items.
        const siblingIds = new Set<string>()
        for (const it of workout.items) {
            if ((it.item_type ?? 'exercise') !== 'exercise') continue
            if (it.exercise_id && exerciseMap.has(it.exercise_id)) {
                siblingIds.add(it.exercise_id)
            }
        }

        for (let ii = 0; ii < workout.items.length; ii++) {
            const it = workout.items[ii]
            if ((it.item_type ?? 'exercise') !== 'exercise') continue
            if (!it.exercise_id || exerciseMap.has(it.exercise_id)) continue

            const substitute = findCompatibleSubstitute({
                desiredFunction: it.exercise_function ?? 'accessory',
                intendedGroups,
                exerciseMap,
                excludeIds: siblingIds,
                prohibited,
            })

            if (substitute) {
                substitutions.push({
                    workout_index: wi,
                    item_index: ii,
                    old_id: it.exercise_id,
                    new_id: substitute.id,
                    target_group: substitute.ref.muscle_group_names[0] ?? null,
                })
                // Mutate in place so the rest of enrichment sees a valid ID.
                it.exercise_id = substitute.id
                siblingIds.add(substitute.id)
            }
            // else: leave the broken ID; R_POOL_UNKNOWN_EXERCISE will catch it.
        }
    }

    return substitutions
}

interface SubstituteCandidate {
    id: string
    ref: PrescriptionExerciseRef
    score: number
}

function findCompatibleSubstitute(args: {
    desiredFunction: string | null | undefined
    intendedGroups: Set<string>
    exerciseMap: Map<string, PrescriptionExerciseRef>
    excludeIds: Set<string>
    prohibited: Set<string>
}): SubstituteCandidate | null {
    const { desiredFunction, intendedGroups, exerciseMap, excludeIds, prohibited } = args
    let best: SubstituteCandidate | null = null

    for (const [id, ref] of exerciseMap) {
        if (excludeIds.has(id)) continue
        if (prohibited.has(id)) continue

        const primary = ref.muscle_group_names[0]
        if (!primary) continue

        // Hard filter: must target one of the workout's intended groups when
        // we have that signal. Without intended groups (legacy callers without
        // split_detail), fall back to "any primary group" so we still recover.
        if (intendedGroups.size > 0 && !intendedGroups.has(primary)) continue

        let score = 20  // base reward for matching the workout's group
        if (desiredFunction === 'main' && ref.is_compound) score += 10
        if (desiredFunction === 'accessory' && !ref.is_compound) score += 10
        // Mild preference for primary movements when filling a "main" slot.
        if (desiredFunction === 'main' && ref.is_primary_movement) score += 5

        if (!best || score > best.score) {
            best = { id, ref, score }
        }
    }

    return best
}

// ============================================================================
// Note Key → PT-BR Translation
// ============================================================================

const NOTE_TRANSLATIONS: Record<NonNullable<ExerciseNoteKey>, string> = {
    compound_anchor: 'Composto principal — âncora de volume do treino',
    replaces_stalled: 'Substitui exercício estagnado do programa anterior',
    favorite_included: 'Incluído por ser exercício favorito do aluno',
    movement_pattern_cover: 'Cobre padrão de movimento necessário para o treino',
    volume_filler: 'Completa budget de volume do grupo muscular',
    unilateral_balance: 'Trabalho unilateral para equilíbrio e estabilidade',
    isolation_complement: 'Isolamento complementar após compostos',
    activation_warmup: 'Ativação leve para preparar o grupo muscular alvo',
    conditioning_finisher: 'Condicionamento ou finalizador da sessão',
    clinical_safe_pick: 'Escolhido por segurança considerando restrições médicas',
    adherence_simple: 'Exercício simples para facilitar aderência',
    emphasis_priority: 'Priorizado pela ênfase muscular definida pelo treinador',
}

function translateNoteKey(
    noteKey: ExerciseNoteKey,
    exercise?: PrescriptionExerciseRef,
): string | null {
    if (!noteKey) return null

    const base = NOTE_TRANSLATIONS[noteKey]
    if (!base) return null

    // For "replaces_stalled", append exercise-specific context if available
    if (noteKey === 'replaces_stalled' && exercise?.prescription_notes) {
        return `${base} — ${exercise.prescription_notes}`
    }

    return base
}

// ============================================================================
// Reasoning Generation (Backend, not LLM)
// ============================================================================

function generateReasoning(
    workouts: GeneratedWorkout[],
    compact: CompactGenerationOutput,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): PrescriptionReasoning {
    return {
        // Fase 2.5.2 (Option 1b): derive from the REAL output instead of
        // templating from constraints. Previous behavior produced "Upper/Lower
        // 4x/sem" even when the LLM delivered PPL+1 5x — the structure_rationale
        // now reflects what was actually generated. Keeps UI contract intact
        // (prescription-rationale-panel.tsx:93 still reads this field).
        structure_rationale: generateStructureRationaleFromOutput(workouts),
        volume_rationale: generateVolumeRationale(workouts, constraints, exerciseMap),
        workout_notes: generateWorkoutNotes(workouts, exerciseMap),
        attention_flags: translateAttentionFlags(compact.meta.flags),
        confidence_score: compact.meta.confidence,
    }
}

// ============================================================================
// Attention flags — LLM emits free-form snake_case identifiers
// ============================================================================
// The smart-v2 schema accepts `meta.flags: string[]` without restricting the
// vocabulary, so the LLM produces whatever it considers worth flagging. The
// UI was rendering these raw — strings like "replaced_stalled_exercises" and
// "advanced_level" leaked to the trainer. This translator does three things:
//
//   1. Translates known flags to PT-BR human-readable text via FLAG_TRANSLATIONS.
//   2. Drops "echo" flags that just restate input (level, goal, frequency)
//      — they don't help the trainer because they already chose them.
//   3. Drops unknown flags entirely (with telemetry warn) instead of
//      surfacing mangled snake_case. Empty list is fine: the panel hides
//      when attention_flags.length === 0.
//
// Adding new flags as we observe them in production is a one-line change.

// Translations are written in trainer-facing voice: each line answers "o que
// aconteceu + o que conferir". Avoid internal jargon (budget, faixa, cap).
// The trainer should read a flag and know whether they need to act.
const FLAG_TRANSLATIONS: Record<string, string> = {
    // Performance / programming decisions
    replaced_stalled_exercises: 'A IA trocou exercícios em que o aluno estava estagnado nas últimas semanas',
    auto_substitution_applied: 'A IA substituiu automaticamente um exercício que não pôde ser reconhecido',

    // Volume signals — actionable, no internal terminology
    volume_adjusted_to_minimum: 'Volume de algum grupo ficou no mínimo recomendado — reforce manualmente se quiser mais',
    volume_below_minimum: 'Algum grupo ficou abaixo do volume mínimo recomendado — revise antes de ativar',
    volume_below_min: 'Algum grupo ficou abaixo do volume mínimo recomendado — revise antes de ativar',
    volume_above_maximum: 'Algum grupo ficou acima do volume máximo recomendado — pode gerar excesso de fadiga',
    volume_above_max: 'Algum grupo ficou acima do volume máximo recomendado — pode gerar excesso de fadiga',
    volume_capped: 'Volume foi limitado pela duração da sessão — considere sessões mais longas para mais volume',

    // Adherence / context
    low_adherence_adjustment: 'Programa simplificado pela baixa aderência do aluno nas últimas semanas',
    reduced_adherence: 'Programa simplificado pela aderência reduzida do aluno',
    minimal_adherence: 'Aluno com aderência muito baixa — o programa foi reduzido; vale conversar com ele',
    new_student_conservative: 'Aluno novo, sem histórico — prescrição conservadora para aprendizado',
    no_history: 'Aluno sem histórico — prescrição conservadora para os primeiros ciclos',

    // Trainer signals
    emphasis_applied: 'A IA priorizou os grupos que você marcou com ênfase',
    medical_restrictions_applied: 'Restrições médicas do aluno foram respeitadas — alguns exercícios foram filtrados',

    // Program change
    large_program_change: 'Mudança grande em relação ao programa anterior — vale comunicar ao aluno',
    new_movement_patterns: 'Novos padrões de movimento foram introduzidos para variar o estímulo',
}

// Echo flags — restate input the trainer already provided. Dropped silently.
// Pattern check (suffix/prefix) is preferred over a hardcoded list because the
// LLM can drift slightly (e.g. "advanced_level" vs "level_advanced").
const FLAG_ECHO_PATTERNS = [
    /_level$/i,           // advanced_level, intermediate_level, beginner_level
    /^level_/i,           // level_advanced
    /^goal_/i,            // goal_hypertrophy
    /_goal$/i,
    /^frequency_/i,       // frequency_4x
    /_per_week$/i,
    /^split_/i,           // split_upper_lower (the structure_rationale already covers this)
]

/**
 * Snake_case identifier shape: letters, digits and underscores only — no
 * spaces, punctuation, or accented characters. Anything that doesn't match is
 * treated as already-translated free text and passed through, which makes
 * this function safe to call twice (once at the enricher, once defensively
 * at the UI for old persisted snapshots). Case-insensitive on purpose —
 * the LLM has been seen emitting uppercase variants under retries.
 */
const SNAKE_CASE_FLAG = /^[a-zA-Z0-9_]+$/

export function translateAttentionFlags(flags: string[] | null | undefined): string[] {
    if (!flags || flags.length === 0) return []

    const translated: string[] = []
    const dropped: string[] = []

    for (const raw of flags) {
        const trimmed = raw.trim()
        if (!trimmed) continue

        // Idempotence guard: if it doesn't look like a snake_case enum token,
        // assume it's human text we wrote on a previous pass and keep it.
        if (!SNAKE_CASE_FLAG.test(trimmed)) {
            translated.push(trimmed)
            continue
        }

        const key = trimmed.toLowerCase()

        // Drop echo flags silently
        if (FLAG_ECHO_PATTERNS.some(p => p.test(key))) {
            dropped.push(raw)
            continue
        }

        const text = FLAG_TRANSLATIONS[key]
        if (text) {
            translated.push(text)
        } else {
            // Unknown flag — drop and log so we can grow the dictionary.
            dropped.push(raw)
        }
    }

    if (dropped.length > 0) {
        console.warn(
            `[Smart-v2][flagDropped] count=${dropped.length} ` +
            `flags=${JSON.stringify(dropped)}`,
        )
    }

    return translated
}

// ============================================================================
// Structure rationale — derived from the output (Fase 2.5.2, Option 1b)
// ============================================================================
// inferSplitLabel maps workout names to the closed set defined with Gustavo.
// Unknown patterns return "Split personalizado" — no "Custom" fallback, no
// heuristic guessing.

const DAY_NAMES_PT_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function generateStructureRationaleFromOutput(
    workouts: GeneratedWorkout[],
): string {
    if (!workouts || workouts.length === 0) return 'Sem workouts gerados.'

    const covered = new Set<number>()
    for (const w of workouts) for (const d of w.scheduled_days ?? []) covered.add(d)
    const frequency = covered.size

    const splitLabel = inferSplitLabel(workouts.map(w => w.name), frequency)

    const schedule = workouts
        .map(w => {
            const days = (w.scheduled_days ?? [])
                .slice()
                .sort((a, b) => a - b)
                .map(d => DAY_NAMES_PT_SHORT[d] ?? `d${d}`)
                .join('+')
            return `${w.name} ${days}`
        })
        .join(', ')

    return `${splitLabel} ${frequency}x/sem (${schedule}).`
}

/**
 * Closed-set classifier. Returns one of:
 *   - "PPL"           when names cover {Push, Pull, Legs} (any prefix/order)
 *       → "PPL+1"   when frequency === 5
 *       → "PPLPPL"  when frequency === 6
 *       → "PPL"     otherwise (3 or 4)
 *   - "Upper/Lower A/B"  when names include Upper A/B + Lower A/B variants
 *   - "Upper/Lower"       when names include Upper + Lower (no A/B variants)
 *   - "Full Body"         when every name starts with "Full Body" or "Treino " (A/B/C)
 *   - "Split personalizado" otherwise
 */
function inferSplitLabel(names: string[], frequency: number): string {
    const lower = names.map(n => n.toLowerCase())

    const hasPush = lower.some(n => n.includes('push'))
    const hasPull = lower.some(n => n.includes('pull'))
    const hasLegs = lower.some(n => n.includes('legs'))
    if (hasPush && hasPull && hasLegs) {
        if (frequency === 6) return 'PPLPPL'
        if (frequency === 5) return 'PPL+1'
        return 'PPL'
    }

    const hasUpperA = lower.some(n => /\bupper\s*a\b/.test(n))
    const hasUpperB = lower.some(n => /\bupper\s*b\b/.test(n))
    const hasLowerA = lower.some(n => /\blower\s*a\b/.test(n))
    const hasLowerB = lower.some(n => /\blower\s*b\b/.test(n))
    if (hasUpperA && hasUpperB && hasLowerA && hasLowerB) return 'Upper/Lower A/B'

    const hasUpper = lower.some(n => n.includes('upper'))
    const hasLower = lower.some(n => n.includes('lower'))
    if (hasUpper && hasLower) return 'Upper/Lower'

    const allFullBody = lower.every(n => n.startsWith('full body'))
    if (allFullBody) return 'Full Body'

    // A/B/C nominals without recognizable pattern → honest "personalized".
    return 'Split personalizado'
}

// Retained for generateProgramDescription below — describes the split *type*
// rolled up from constraints, not the delivered workouts.
const SPLIT_LABELS: Record<string, string> = {
    full_body: 'Full Body',
    upper_lower: 'Upper/Lower',
    ppl_plus: 'PPL+',
    ppl_complete: 'PPL Completo',
}

/**
 * Generates volume rationale by comparing actual volume to budget.
 * Only lists groups that are outside their budget range (exceptions only).
 *
 * Magnitude classification (issue 3 — was "déficit aceitável" hardcoded):
 *   - Deficit  <15% of min  → "déficit aceitável"      (acceptable noise)
 *   - Deficit 15-30% of min → "abaixo do alvo"          (notable, not blocking)
 *   - Deficit  >30% of min  → "abaixo do mínimo (revisar)"
 *                              (mirrors R_VOLUME_BELOW_MIN_PRIMARY retry)
 *   - Excess   <15% of max  → "ligeiramente acima do alvo"
 *   - Excess  >=15% of max  → "acima do máximo (verificar)"
 *
 * The thresholds intentionally match VOLUME_DEFICIT_RETRY_THRESHOLD (0.30) so
 * the text never says "aceitável" for cases the validator considers severe.
 */
const VOLUME_RATIONALE_MILD_THRESHOLD = 0.15
const VOLUME_RATIONALE_SEVERE_THRESHOLD = 0.30

export function classifyDeficit(actual: number, min: number): string {
    const pct = (min - actual) / min
    if (pct <= VOLUME_RATIONALE_MILD_THRESHOLD) return 'déficit aceitável'
    if (pct <= VOLUME_RATIONALE_SEVERE_THRESHOLD) return 'abaixo do alvo'
    return 'abaixo do mínimo (revisar)'
}

export function classifyExcess(actual: number, max: number): string {
    const pct = (actual - max) / max
    if (pct < VOLUME_RATIONALE_MILD_THRESHOLD) return 'ligeiramente acima do alvo'
    return 'acima do máximo (verificar)'
}

function generateVolumeRationale(
    workouts: GeneratedWorkout[],
    constraints: PrescriptionConstraints,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): string {
    const weeklyVolume = computeWeeklyVolumePerMuscle(workouts, exerciseMap)
    const exceptions: string[] = []

    for (const group of PRIMARY_MUSCLE_GROUPS) {
        const actual = weeklyVolume[group] || 0
        const budget = constraints.volume_budget[group]
        if (!budget || actual === 0) continue

        if (actual < budget.min) {
            exceptions.push(`${group}: ${actual}s (mín ${budget.min}) — ${classifyDeficit(actual, budget.min)}`)
        } else if (actual > budget.max) {
            exceptions.push(`${group}: ${actual}s (máx ${budget.max}) — ${classifyExcess(actual, budget.max)}`)
        }
    }

    if (exceptions.length === 0) {
        return 'Todos os grupos primários dentro do budget de volume.'
    }

    return exceptions.join('. ') + '.'
}

/**
 * Generates per-workout notes from exercise anchors.
 * Format: "{workout_name}: {anchor_exercise_1} + {anchor_exercise_2}. {focus}."
 */
function generateWorkoutNotes(
    workouts: GeneratedWorkout[],
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): string[] {
    return workouts.map(w => {
        // Filter to exercise items only for analysis
        const exerciseItems = w.items.filter(item => (item.item_type || 'exercise') === 'exercise')

        // Find main (compound anchor) exercises
        const anchors = exerciseItems
            .filter(item => item.exercise_function === 'main')
            .map(item => {
                const ref = item.exercise_id ? exerciseMap.get(item.exercise_id) : undefined
                return ref?.name ?? item.exercise_name
            })

        const anchorText = anchors.length > 0
            ? anchors.join(' + ')
            : 'Acessórios focados'

        // Identify primary muscle groups in this workout
        const groups = new Set<string>()
        for (const item of exerciseItems) {
            const ref = item.exercise_id ? exerciseMap.get(item.exercise_id) : undefined
            if (ref) {
                for (const g of ref.muscle_group_names) {
                    groups.add(g)
                }
            }
        }

        const primaryGroups = [...groups]
            .filter(g => PRIMARY_MUSCLE_GROUPS.includes(g))
            .slice(0, 3)

        if (primaryGroups.length > 0) {
            return `${w.name}: ${anchorText}. Foco: ${primaryGroups.join(', ')}.`
        }

        return `${w.name}: ${anchorText}.`
    })
}

/**
 * Generates a short program description from profile data.
 */
function generateProgramDescription(
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
): string {
    const goalLabel = GOAL_LABELS[profile.goal] ?? profile.goal
    const levelLabel = LEVEL_LABELS[profile.training_level] ?? profile.training_level
    const splitLabel = SPLIT_LABELS[constraints.split_type] ?? constraints.split_type

    return `Programa de ${goalLabel} para aluno ${levelLabel}. ` +
        `Estrutura ${splitLabel}, ${constraints.split_detail.length}x por semana, ` +
        `sessões de ${profile.session_duration_minutes} minutos.`
}

const GOAL_LABELS: Record<string, string> = {
    hypertrophy: 'hipertrofia',
    weight_loss: 'emagrecimento',
    performance: 'performance',
    health: 'saúde',
}

const LEVEL_LABELS: Record<string, string> = {
    beginner: 'iniciante',
    intermediate: 'intermediário',
    advanced: 'avançado',
}
