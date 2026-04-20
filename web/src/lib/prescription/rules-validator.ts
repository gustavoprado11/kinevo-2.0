// ============================================================================
// Kinevo Prescription Engine — Domain rules validator (Phase 2.5)
// ============================================================================
// Applies the domain rules from spec 06 §4 as a post-generation guardrail.
// Corrects violations in place (clamp sets, reorder) and returns both the
// corrected program and a list of RuleViolation records so the caller can
// persist them in prescription_generations.rules_violations_json.
//
// Strategy: errors first (set clamps) → warnings (ordering) → clamps on reps
// and rest. Each rule is a pure detector + corrector pair over an immutable
// clone of the output, so chaining is safe.

import type {
    PrescriptionOutputSnapshot,
    PrescriptionExerciseRef,
    StudentPrescriptionProfile,
    TrainingLevel,
    PrescriptionGoal,
    GeneratedWorkout,
    GeneratedWorkoutItem,
} from '@kinevo/shared/types/prescription'

import { REP_RANGES_BY_GOAL, REST_SECONDS } from './constants'

// ============================================================================
// Types
// ============================================================================

export type RuleSeverity = 'error' | 'warning'

export type RuleId =
    | 'MAX_SETS_COMPOUND_4'
    | 'MAX_SETS_ACCESSORY_BY_LEVEL'
    | 'MAX_SETS_SMALL_GROUP_3'
    | 'MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP'
    | 'COMPOUND_BEFORE_ACCESSORY'
    | 'LARGE_GROUP_BEFORE_SMALL'
    | 'REPS_MATCH_GOAL'
    | 'REST_MATCH_GOAL'
    | 'R45_SCHEDULE_MISMATCH'
    | 'R_POOL_UNKNOWN_EXERCISE'

/**
 * How a violation should be remediated:
 *   - `local`: the validator clamped/reordered in place; caller accepts output.
 *   - `retry`: no local fix is safe; caller re-runs the LLM with a corrective
 *     message. Used by R45_SCHEDULE_MISMATCH and R_POOL_UNKNOWN_EXERCISE.
 *   - `none`: unfixable; caller should abort or fall back to legacy pipeline.
 */
export type RuleAutofix = 'local' | 'retry' | 'none'

export interface RuleViolation {
    rule_id: RuleId
    severity: RuleSeverity
    workout_index: number
    /** Index of the item within the workout (pre-reorder when applicable). */
    item_index: number
    exercise_id: string | null
    message: string
    before: Record<string, unknown>
    after: Record<string, unknown>
    /** Added in Fase 2.5.2. Legacy rules default to 'local'. */
    autofix: RuleAutofix
}

export interface ValidateResult {
    output: PrescriptionOutputSnapshot
    violations: RuleViolation[]
}

// ============================================================================
// Group classification
// ============================================================================

// Groups (in DB spelling) where the workout's principal exercise may carry
// 4 sets. §4.2.
const GROUPS_TOLERATE_4: ReadonlySet<string> = new Set([
    'Peito', 'Costas', 'Ombros', 'Quadríceps', 'Posterior de Coxa',
    'Glúteo', 'Panturrilha',
])

// Groups capped at 3 sets for the principal. §4.2.
const SMALL_GROUPS_CAP_3: ReadonlySet<string> = new Set([
    'Bíceps', 'Tríceps', 'Antebraço',
    // Abdominais appears under multiple spellings in the DB; cover both.
    'Abdominais', 'Abdômen', 'Abdome', 'Core',
])

// Rough "size" ordering for §4.7 (larger groups first). Higher = larger.
const GROUP_SIZE: Record<string, number> = {
    'Quadríceps': 100, 'Posterior de Coxa': 100, 'Glúteo': 100,
    'Peito': 95, 'Costas': 95,
    'Ombros': 80,
    'Panturrilha': 60,
    'Trapézio': 55,
    'Bíceps': 40, 'Tríceps': 40,
    'Antebraço': 25,
    'Abdominais': 20, 'Abdômen': 20, 'Abdome': 20, 'Core': 20,
}

function primaryGroup(item: GeneratedWorkoutItem, ref: PrescriptionExerciseRef | undefined): string | null {
    if (item.exercise_muscle_group) return item.exercise_muscle_group
    if (ref?.muscle_group_names?.[0]) return ref.muscle_group_names[0]
    return null
}

function isCompound(item: GeneratedWorkoutItem, ref: PrescriptionExerciseRef | undefined): boolean {
    if (ref?.is_compound) return true
    if (ref?.muscle_group_names && ref.muscle_group_names.length >= 2) return true
    const name = (ref?.name ?? item.exercise_name ?? '').toLowerCase()
    return COMPOUND_NAME_PATTERNS.some(p => name.includes(p))
}

// Kept in sync with the heuristic in analyze-context.ts / get-prescription-data.ts.
const COMPOUND_NAME_PATTERNS = [
    'supino', 'press', 'remada', 'puxada', 'barra fixa', 'pulldown',
    'agachamento', 'leg press', 'terra', 'passada', 'lunge', 'avanço',
    'stiff', 'desenvolvimento', 'press militar', 'hip thrust', 'búlgaro',
    'levantamento', 'flexão',
]

// ============================================================================
// Rep / rest range utilities
// ============================================================================

function parseRepRange(reps: string | null | undefined): [number, number] | null {
    if (!reps) return null
    const match = reps.match(/(\d+)\s*-\s*(\d+)/)
    if (match) {
        const lo = parseInt(match[1], 10)
        const hi = parseInt(match[2], 10)
        if (Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi >= lo) return [lo, hi]
    }
    const single = reps.match(/^\s*(\d+)\s*$/)
    if (single) {
        const n = parseInt(single[1], 10)
        if (Number.isFinite(n)) return [n, n]
    }
    return null
}

function canonicalRepRangeForGoal(goal: PrescriptionGoal, compound: boolean): string {
    const ranges = REP_RANGES_BY_GOAL[goal]
    return compound ? ranges.compound : ranges.isolation
}

function canonicalRestForGoal(goal: PrescriptionGoal, compound: boolean): number {
    const rests = REST_SECONDS[compound ? 'compound' : 'isolation']
    return rests[goal]
}

// Widest plausible rep range per goal — items outside this get clamped.
// Derived from §4.8.
const REP_BOUNDS_BY_GOAL: Record<PrescriptionGoal, [number, number]> = {
    hypertrophy: [6, 15],
    weight_loss: [10, 20],
    performance: [3, 12],
    health: [8, 15],
}

// Widest plausible rest (seconds) per goal.
const REST_BOUNDS_BY_GOAL: Record<PrescriptionGoal, [number, number]> = {
    hypertrophy: [45, 120],
    weight_loss: [30, 60],
    performance: [120, 240],
    health: [45, 90],
}

// ============================================================================
// Level caps for accessories / isolations
// ============================================================================

const ACCESSORY_CAP_BY_LEVEL: Record<TrainingLevel, number> = {
    beginner: 3,
    intermediate: 4,
    advanced: 5,
}

// ============================================================================
// Public entry point
// ============================================================================

export function validatePrescriptionAgainstRules(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    profile: StudentPrescriptionProfile,
): ValidateResult {
    // Work on a deep clone so the original stays untouched.
    let current: PrescriptionOutputSnapshot = structuredClone(output)
    const violations: RuleViolation[] = []

    const step = (fn: (o: PrescriptionOutputSnapshot) => ValidateResult) => {
        const r = fn(current)
        current = r.output
        violations.push(...r.violations)
    }

    // ── ERRORS first (set clamps) ────────────────────────────────────────
    step(o => clampCompoundSets(o, exerciseMap))
    step(o => clampAccessorySetsByLevel(o, exerciseMap, profile.training_level))
    step(o => clampSmallGroupSets(o, exerciseMap))
    step(o => enforceOneFourSetPerGroup(o, exerciseMap))

    // ── WARNINGS next (ordering + rep/rest clamps) ──────────────────────
    step(o => enforceCompoundBeforeAccessory(o, exerciseMap))
    step(o => enforceLargeGroupBeforeSmall(o, exerciseMap))
    step(o => clampRepsToGoal(o, exerciseMap, profile.goal))
    step(o => clampRestToGoal(o, exerciseMap, profile.goal))

    // ── NEW (Fase 2.5.2): retry-only rules ──────────────────────────────
    // These rules cannot be auto-corrected locally; they produce violations
    // with `autofix: 'retry'` so the caller (trySmartV2Generation) can
    // re-run the LLM with a corrective message.
    step(o => enforceScheduleCoverage(o, profile.available_days))
    step(o => enforceExerciseIdsInPool(o, exerciseMap))

    return { output: current, violations }
}

// ============================================================================
// Rule implementations
// ============================================================================

function withMutatedWorkouts(
    output: PrescriptionOutputSnapshot,
    mutate: (workout: GeneratedWorkout, wi: number) => { workout: GeneratedWorkout; violations: RuleViolation[] },
): ValidateResult {
    const violations: RuleViolation[] = []
    const workouts = output.workouts.map((w, wi) => {
        const { workout, violations: vs } = mutate(w, wi)
        violations.push(...vs)
        return workout
    })
    return { output: { ...output, workouts }, violations }
}

function clampCompoundSets(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            if (!isCompound(item, ref)) return item
            if (typeof item.sets !== 'number' || item.sets <= 4) return item
            vs.push({
                rule_id: 'MAX_SETS_COMPOUND_4',
                autofix: 'local',
                severity: 'error',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Exercício composto com ${item.sets} séries; limite absoluto é 4.`,
                before: { sets: item.sets },
                after: { sets: 4 },
            })
            return { ...item, sets: 4 }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

function clampAccessorySetsByLevel(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
    level: TrainingLevel,
): ValidateResult {
    const cap = ACCESSORY_CAP_BY_LEVEL[level]
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            if (isCompound(item, ref)) return item
            if (typeof item.sets !== 'number' || item.sets <= cap) return item
            vs.push({
                rule_id: 'MAX_SETS_ACCESSORY_BY_LEVEL',
                autofix: 'local',
                severity: 'error',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Acessório com ${item.sets} séries; teto para ${level} é ${cap}.`,
                before: { sets: item.sets },
                after: { sets: cap },
            })
            return { ...item, sets: cap }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

function clampSmallGroupSets(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            const group = primaryGroup(item, ref)
            if (!group || !SMALL_GROUPS_CAP_3.has(group)) return item
            if (typeof item.sets !== 'number' || item.sets <= 3) return item
            vs.push({
                rule_id: 'MAX_SETS_SMALL_GROUP_3',
                autofix: 'local',
                severity: 'error',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Grupo pequeno (${group}) com ${item.sets} séries; teto para principal é 3.`,
                before: { sets: item.sets },
                after: { sets: 3 },
            })
            return { ...item, sets: 3 }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

function enforceOneFourSetPerGroup(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const seenFourByGroup = new Set<string>()
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            if (typeof item.sets !== 'number') return item
            if (item.sets !== 4) return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            const group = primaryGroup(item, ref)
            if (!group) return item
            // Only groups that tolerate 4 count here; small groups are handled
            // by clampSmallGroupSets and won't reach here with sets=4.
            if (!GROUPS_TOLERATE_4.has(group)) return item
            if (!seenFourByGroup.has(group)) {
                seenFourByGroup.add(group)
                return item
            }
            // Second+ exercise with 4 sets for the same group in this workout.
            vs.push({
                rule_id: 'MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP',
                autofix: 'local',
                severity: 'error',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Segundo exercício de ${group} com 4 séries no mesmo treino; reduzindo para 3.`,
                before: { sets: 4 },
                after: { sets: 3 },
            })
            return { ...item, sets: 3 }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

function enforceCompoundBeforeAccessory(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    return withMutatedWorkouts(output, (workout, wi) => {
        const items = workout.items
        // Only reorder exercise items; warmup/cardio stay at their positions.
        const exerciseIdxs = items
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => !it.item_type || it.item_type === 'exercise')

        // Check if any accessory appears before a compound.
        let outOfOrder = false
        let seenAccessory = false
        for (const { it } of exerciseIdxs) {
            const ref = it.exercise_id ? map.get(it.exercise_id) : undefined
            if (isCompound(it, ref)) {
                if (seenAccessory) { outOfOrder = true; break }
            } else {
                seenAccessory = true
            }
        }
        if (!outOfOrder) return { workout, violations: [] }

        // Stable sort: compounds before accessories, preserving relative order.
        const sorted = [...exerciseIdxs].sort((a, b) => {
            const refA = a.it.exercise_id ? map.get(a.it.exercise_id) : undefined
            const refB = b.it.exercise_id ? map.get(b.it.exercise_id) : undefined
            const ca = isCompound(a.it, refA) ? 0 : 1
            const cb = isCompound(b.it, refB) ? 0 : 1
            return ca - cb
        })

        // Rebuild item list preserving positions of non-exercise items.
        const result: GeneratedWorkoutItem[] = []
        let exerciseCursor = 0
        for (const it of items) {
            if (!it.item_type || it.item_type === 'exercise') {
                result.push({ ...sorted[exerciseCursor].it, order_index: result.length })
                exerciseCursor++
            } else {
                result.push({ ...it, order_index: result.length })
            }
        }
        return {
            workout: { ...workout, items: result },
            violations: [{
                rule_id: 'COMPOUND_BEFORE_ACCESSORY',
                autofix: 'local',
                severity: 'warning',
                workout_index: wi,
                item_index: 0,
                exercise_id: null,
                message: 'Acessório antes de composto; reordenado.',
                before: {},
                after: {},
            }],
        }
    })
}

function enforceLargeGroupBeforeSmall(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    return withMutatedWorkouts(output, (workout, wi) => {
        const items = workout.items
        // Only act on the compound segment: find a contiguous prefix of
        // compounds (after the compound-before-accessory pass has already run)
        // and reorder them by GROUP_SIZE desc, preserving relative order for
        // equal sizes.
        const compoundRange = findLeadingCompoundRange(items, map)
        if (compoundRange.length < 2) return { workout, violations: [] }

        const sorted = [...compoundRange].sort((a, b) => {
            const gA = primaryGroup(a.it, a.it.exercise_id ? map.get(a.it.exercise_id) : undefined)
            const gB = primaryGroup(b.it, b.it.exercise_id ? map.get(b.it.exercise_id) : undefined)
            const sizeA = gA ? (GROUP_SIZE[gA] ?? 50) : 50
            const sizeB = gB ? (GROUP_SIZE[gB] ?? 50) : 50
            return sizeB - sizeA
        })

        // No change? Skip.
        const changed = sorted.some((entry, i) => entry.idx !== compoundRange[i].idx)
        if (!changed) return { workout, violations: [] }

        const newItems = items.slice()
        for (let i = 0; i < compoundRange.length; i++) {
            newItems[compoundRange[i].idx] = { ...sorted[i].it, order_index: compoundRange[i].idx }
        }
        // Reassign order_index to reflect final position.
        const normalized = newItems.map((it, idx) => ({ ...it, order_index: idx }))

        return {
            workout: { ...workout, items: normalized },
            violations: [{
                rule_id: 'LARGE_GROUP_BEFORE_SMALL',
                autofix: 'local',
                severity: 'warning',
                workout_index: wi,
                item_index: 0,
                exercise_id: null,
                message: 'Grupos maiores vêm antes dos pequenos; reordenado.',
                before: {},
                after: {},
            }],
        }
    })
}

function findLeadingCompoundRange(
    items: GeneratedWorkoutItem[],
    map: Map<string, PrescriptionExerciseRef>,
): Array<{ it: GeneratedWorkoutItem; idx: number }> {
    const range: Array<{ it: GeneratedWorkoutItem; idx: number }> = []
    for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.item_type && it.item_type !== 'exercise') continue
        const ref = it.exercise_id ? map.get(it.exercise_id) : undefined
        if (!isCompound(it, ref)) break
        range.push({ it, idx: i })
    }
    return range
}

function clampRepsToGoal(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
    goal: PrescriptionGoal,
): ValidateResult {
    const [lo, hi] = REP_BOUNDS_BY_GOAL[goal]
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            const range = parseRepRange(item.reps ?? null)
            if (!range) return item
            const [rLo, rHi] = range
            if (rLo >= lo && rHi <= hi) return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            const canonical = canonicalRepRangeForGoal(goal, isCompound(item, ref))
            vs.push({
                rule_id: 'REPS_MATCH_GOAL',
                autofix: 'local',
                severity: 'warning',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Reps "${item.reps}" fora da faixa para ${goal}; ajustando para "${canonical}".`,
                before: { reps: item.reps },
                after: { reps: canonical },
            })
            return { ...item, reps: canonical }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

function clampRestToGoal(
    output: PrescriptionOutputSnapshot,
    map: Map<string, PrescriptionExerciseRef>,
    goal: PrescriptionGoal,
): ValidateResult {
    const [lo, hi] = REST_BOUNDS_BY_GOAL[goal]
    return withMutatedWorkouts(output, (workout, wi) => {
        const vs: RuleViolation[] = []
        const items = workout.items.map((item, ii) => {
            if (item.item_type && item.item_type !== 'exercise') return item
            if (typeof item.rest_seconds !== 'number') return item
            if (item.rest_seconds >= lo && item.rest_seconds <= hi) return item
            const ref = item.exercise_id ? map.get(item.exercise_id) : undefined
            const canonical = canonicalRestForGoal(goal, isCompound(item, ref))
            vs.push({
                rule_id: 'REST_MATCH_GOAL',
                autofix: 'local',
                severity: 'warning',
                workout_index: wi,
                item_index: ii,
                exercise_id: item.exercise_id ?? null,
                message: `Descanso ${item.rest_seconds}s fora da faixa para ${goal}; ajustando para ${canonical}s.`,
                before: { rest_seconds: item.rest_seconds },
                after: { rest_seconds: canonical },
            })
            return { ...item, rest_seconds: canonical }
        })
        return { workout: { ...workout, items }, violations: vs }
    })
}

// ============================================================================
// §4.5 — Schedule coverage (Fase 2.5.2)
// ============================================================================
// `covered = union(workout.scheduled_days)` must equal `profile.available_days`
// as a set (order-insensitive, repetition allowed within each workout to
// express PPL+1 / bro-split / etc.). Mismatches are not auto-corrected
// locally — the caller re-runs the LLM with a corrective message.

function enforceScheduleCoverage(
    output: PrescriptionOutputSnapshot,
    availableDays: number[],
): ValidateResult {
    const declared = new Set(availableDays)
    const covered = new Set<number>()
    for (const wk of output.workouts) {
        for (const d of wk.scheduled_days ?? []) covered.add(d)
    }

    const missing = [...declared].filter(d => !covered.has(d)).sort((a, b) => a - b)
    const extra = [...covered].filter(d => !declared.has(d)).sort((a, b) => a - b)

    if (missing.length === 0 && extra.length === 0) {
        return { output, violations: [] }
    }

    const coveredArr = [...covered].sort((a, b) => a - b)
    const declaredArr = [...declared].sort((a, b) => a - b)

    let message: string
    if (missing.length > 0 && extra.length === 0) {
        message =
            `Programa cobre apenas ${JSON.stringify(coveredArr)} mas o aluno declarou ` +
            `available_days=${JSON.stringify(declaredArr)}. Redistribua os workouts para cobrir ` +
            `todos os dias declarados (pode repetir workouts em múltiplos dias, ex: PPL+1).`
    } else if (extra.length > 0 && missing.length === 0) {
        message =
            `Programa agenda workouts em dias ${JSON.stringify(extra)} que NÃO constam em ` +
            `available_days=${JSON.stringify(declaredArr)}. Reagende usando apenas os dias declarados.`
    } else {
        message =
            `Programa tem descoberto (${JSON.stringify(missing)}) e excesso (${JSON.stringify(extra)}) ` +
            `vs available_days=${JSON.stringify(declaredArr)}. Use apenas os dias declarados cobrindo ` +
            `todos eles.`
    }

    return {
        output,
        violations: [{
            rule_id: 'R45_SCHEDULE_MISMATCH',
            autofix: 'retry',
            severity: 'error',
            workout_index: -1,
            item_index: -1,
            exercise_id: null,
            message,
            before: { covered: coveredArr, declared: declaredArr },
            after: { declared: declaredArr },
        }],
    }
}

// ============================================================================
// Pool membership (Fase 2.5.2) — every exercise_id must exist in exerciseMap
// ============================================================================
// Hallucinated UUIDs break enricher fallbacks ("Exercício desconhecido") and
// break downstream rule checks (no muscle_group to validate against). No safe
// local fix — caller re-runs with a corrective message listing the missing IDs.

function enforceExerciseIdsInPool(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): ValidateResult {
    const violations: RuleViolation[] = []
    for (let wi = 0; wi < output.workouts.length; wi++) {
        const wk = output.workouts[wi]
        for (let ii = 0; ii < wk.items.length; ii++) {
            const it = wk.items[ii]
            if (it.item_type && it.item_type !== 'exercise') continue
            const id = it.exercise_id
            if (!id) continue
            if (!exerciseMap.has(id)) {
                violations.push({
                    rule_id: 'R_POOL_UNKNOWN_EXERCISE',
                    autofix: 'retry',
                    severity: 'error',
                    workout_index: wi,
                    item_index: ii,
                    exercise_id: id,
                    message:
                        `exercise_id "${id}" não existe no pool fornecido ` +
                        `(workout "${wk.name}", item ${ii}). Use apenas IDs do pool.`,
                    before: { exercise_id: id },
                    after: { exercise_id: null },
                })
            }
        }
    }
    return { output, violations }
}
