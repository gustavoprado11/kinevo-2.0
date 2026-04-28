// ============================================================================
// Per-set scheme — pure helpers
// ============================================================================
// Pure functions used by web + mobile builders and the parse-text Edge
// Function. No side effects, no I/O, no DOM access.

import type {
    MethodKey,
    SetType,
    WorkoutSet,
} from '@kinevo/shared/types/prescription'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'
import {
    SYSTEM_PRESETS,
} from '@kinevo/shared/lib/prescription/set-scheme-presets'

export interface SetSchemeSummary {
    sets: number
    reps: string
    rest_seconds: number
}

export interface SetSchemeValidation {
    valid: boolean
    errors: string[]
}

const isSetType = (value: string): value is SetType =>
    (SET_TYPE_OPTIONS as readonly string[]).includes(value)

/** Produce the aggregate `(sets, reps, rest_seconds)` triple that should be
 * mirrored on the parent row whenever a `set_scheme` exists. Single source of
 * truth — never persist diverging aggregates. */
export const summarizeSetScheme = (scheme: WorkoutSet[]): SetSchemeSummary => {
    if (!Array.isArray(scheme) || scheme.length === 0) {
        throw new Error('summarizeSetScheme: scheme must contain at least one set')
    }

    const sets = scheme.length
    const repsValues = scheme.map((s) => s.reps?.trim() ?? '')
    const allEqual = repsValues.every((r) => r === repsValues[0])
    const reps = allEqual ? repsValues[0] : repsValues.join('-')

    // Use the minimum rest of the scheme as the aggregate. Conservative for
    // legacy readers that fall back to the aggregate value (smaller rest = no
    // surprise long pause appearing for clusters / drop sets).
    const rest_seconds = scheme.reduce(
        (min, s) => Math.min(min, Math.max(0, s.rest_seconds ?? 0)),
        Number.POSITIVE_INFINITY,
    )

    return {
        sets,
        reps,
        rest_seconds: Number.isFinite(rest_seconds) ? rest_seconds : 0,
    }
}

interface ExpandOptions {
    setType?: SetType
}

/** Expand legacy aggregate triple into N identical sets. Used when the trainer
 * toggles "Avançado" for the first time on an exercise. Null aggregates fall
 * back to gentle defaults (3 × 10 reps × 60s, normal). */
export const expandToSetScheme = (
    sets: number | null | undefined,
    reps: string | null | undefined,
    rest_seconds: number | null | undefined,
    opts: ExpandOptions = {},
): WorkoutSet[] => {
    const safeSets = Math.max(1, Math.min(50, sets ?? 3))
    const safeReps = (reps ?? '').trim() || '10'
    const safeRest = Math.max(0, rest_seconds ?? 60)
    const setType: SetType = opts.setType ?? 'normal'

    return Array.from({ length: safeSets }, (_, i) => ({
        set_number: i + 1,
        set_type: setType,
        reps: safeReps,
        rest_seconds: safeRest,
        weight_target_kg: null,
        weight_target_pct1rm: null,
        rir: null,
        tempo: null,
        notes: null,
    }))
}

/** Coherence check: returns the list of human-readable errors in pt-BR. */
export const validateSetScheme = (scheme: WorkoutSet[]): SetSchemeValidation => {
    const errors: string[] = []

    if (!Array.isArray(scheme)) {
        return { valid: false, errors: ['scheme deve ser um array'] }
    }
    if (scheme.length === 0) {
        return { valid: false, errors: ['Pelo menos 1 série é obrigatória'] }
    }

    const seenNumbers = new Set<number>()
    scheme.forEach((set, idx) => {
        const label = `Série ${idx + 1}`
        if (typeof set.set_number !== 'number' || !Number.isInteger(set.set_number) || set.set_number < 1) {
            errors.push(`${label}: set_number inválido`)
        } else if (seenNumbers.has(set.set_number)) {
            errors.push(`${label}: set_number ${set.set_number} duplicado`)
        } else {
            seenNumbers.add(set.set_number)
        }

        if (!set.set_type || !isSetType(set.set_type)) {
            errors.push(`${label}: set_type inválido`)
        }

        if (typeof set.reps !== 'string' || set.reps.trim().length === 0) {
            errors.push(`${label}: reps não pode ficar vazio`)
        }

        if (typeof set.rest_seconds !== 'number' || set.rest_seconds < 0) {
            errors.push(`${label}: rest_seconds inválido`)
        }
    })

    // set_number must be contiguous starting at 1
    const sortedNumbers = [...seenNumbers].sort((a, b) => a - b)
    sortedNumbers.forEach((n, i) => {
        if (n !== i + 1) {
            errors.push(`set_number deve ser contínuo começando em 1 (encontrado ${n} na posição ${i + 1})`)
        }
    })

    return { valid: errors.length === 0, errors }
}

interface ApplyPresetOptions {
    sets?: number
    baseReps?: number
    dropPct?: number
}

/** Build a default `WorkoutSet[]` from a preset key. Falls back to the static
 * `SYSTEM_PRESETS[key].defaultSetsConfig` when no overrides are provided. */
export const applyPreset = (
    key: MethodKey,
    opts: ApplyPresetOptions = {},
): WorkoutSet[] => {
    if (key === 'standard' || key === 'custom') {
        return []
    }

    const preset = SYSTEM_PRESETS[key]
    if (!preset) return []

    const hasOverrides =
        typeof opts.sets === 'number' ||
        typeof opts.baseReps === 'number' ||
        typeof opts.dropPct === 'number'

    if (!hasOverrides) {
        return preset.defaultSetsConfig.map((s) => ({ ...s }))
    }

    if (key === 'pyramid_down' || key === 'pyramid_up') {
        const targetSets = Math.max(2, Math.min(10, opts.sets ?? preset.defaultSetsConfig.length))
        const baseReps = Math.max(1, opts.baseReps ?? 12)
        return Array.from({ length: targetSets }, (_, i) => {
            const reps = key === 'pyramid_down' ? baseReps - i * 2 : baseReps - (targetSets - 1 - i) * 2
            const safeReps = Math.max(1, reps)
            // Crescente: descanso aumenta com a carga.
            const rest = key === 'pyramid_down'
                ? (i < 2 ? 90 : i === 2 ? 120 : 180)
                : (i < 2 ? 180 : i === 2 ? 120 : 90)
            return {
                set_number: i + 1,
                set_type: 'normal' as SetType,
                reps: String(safeReps),
                rest_seconds: rest,
                weight_target_kg: null,
                weight_target_pct1rm: null,
                rir: null,
                tempo: null,
                notes: null,
            }
        })
    }

    if (key === 'drop_set') {
        const dropPct = Math.max(5, Math.min(50, opts.dropPct ?? 20))
        const baseReps = String(Math.max(1, opts.baseReps ?? 10))
        return [
            { set_number: 1, set_type: 'normal', reps: baseReps, rest_seconds: 0, weight_target_kg: null, weight_target_pct1rm: 100, rir: null, tempo: null, notes: null },
            { set_number: 2, set_type: 'drop', reps: baseReps, rest_seconds: 0, weight_target_kg: null, weight_target_pct1rm: 100 - dropPct, rir: null, tempo: null, notes: null },
            { set_number: 3, set_type: 'drop', reps: baseReps, rest_seconds: 0, weight_target_kg: null, weight_target_pct1rm: 100 - dropPct * 2, rir: null, tempo: null, notes: null },
        ]
    }

    if (key === '5x5') {
        const targetSets = Math.max(1, Math.min(10, opts.sets ?? 5))
        return Array.from({ length: targetSets }, (_, i) => ({
            set_number: i + 1,
            set_type: 'normal' as SetType,
            reps: '5',
            rest_seconds: 180,
            weight_target_kg: null,
            weight_target_pct1rm: null,
            rir: null,
            tempo: null,
            notes: null,
        }))
    }

    return preset.defaultSetsConfig.map((s) => ({ ...s }))
}

/** Expand a per-round `set_scheme` into the materialized list that gets
 *  persisted to `workout_item_set_templates`/`assigned_workout_item_sets`.
 *
 *  - `rounds <= 1`: identity (returns the input as is). Linear methods stay
 *    untouched and `round_number` ends up null on every row.
 *  - `rounds > 1`: repeats the per-round scheme N times. Each output row gets
 *    a sequential `set_number` (1..rounds*phases) and a 1-based
 *    `round_number`. Used by the mobile builder save flow and by the
 *    `assign-program` Edge Function. */
export const expandSchemeByRounds = (
    scheme: WorkoutSet[],
    rounds: number,
): WorkoutSet[] => {
    if (!Array.isArray(scheme) || scheme.length === 0) return []
    const safeRounds = Math.max(1, Math.min(20, Math.floor(rounds)))
    if (safeRounds <= 1) return scheme.map((s) => ({ ...s }))
    const phasesPerRound = scheme.length
    const expanded: WorkoutSet[] = []
    for (let r = 0; r < safeRounds; r++) {
        for (let p = 0; p < phasesPerRound; p++) {
            const phase = scheme[p]
            expanded.push({
                ...phase,
                set_number: r * phasesPerRound + p + 1,
                round_number: r + 1,
            })
        }
    }
    return expanded
}

/** Inverse of `expandSchemeByRounds`: given a materialized scheme stored in
 *  `workout_item_set_templates` / `assigned_workout_item_sets`, reconstruct
 *  the per-round scheme (one round only) plus the rounds count.
 *
 *  Used by the web builder load to display the editable per-round structure
 *  while the persisted layout remains the materialized N×M grid.
 *
 *  Strategy:
 *  - When `roundsHint <= 1` or the input is empty: returns the input as a
 *    single-round scheme (rounds = 1). Linear methods always take this path.
 *  - When `roundsHint > 1` and the input length is divisible by it: returns
 *    the first round only with `set_number` reset to 1..M.
 *  - When the data is inconsistent (length not divisible): falls back to the
 *    safe single-round shape and rounds=1, so the UI still renders.
 *
 *  Precondition the save flow guarantees: every round materializes the same
 *  per-round structure, so reading the first round is enough.
 */
export const collapseExpandedScheme = (
    expandedScheme: WorkoutSet[] | null | undefined,
    roundsHint: number | null | undefined,
): { scheme: WorkoutSet[]; rounds: number } => {
    const rounds = Number.isFinite(roundsHint as number)
        ? Math.max(1, Math.floor(roundsHint as number))
        : 1
    if (!Array.isArray(expandedScheme) || expandedScheme.length === 0) {
        return { scheme: [], rounds: 1 }
    }
    if (rounds <= 1) {
        return { scheme: expandedScheme.map((s) => ({ ...s })), rounds: 1 }
    }
    const phasesPerRound = Math.floor(expandedScheme.length / rounds)
    if (phasesPerRound <= 0 || phasesPerRound * rounds !== expandedScheme.length) {
        // Inconsistent materialization — fall back to flat single round.
        return { scheme: expandedScheme.map((s) => ({ ...s })), rounds: 1 }
    }
    const sorted = [...expandedScheme].sort((a, b) => a.set_number - b.set_number)
    const firstRound = sorted.slice(0, phasesPerRound).map((s, idx) => ({
        ...s,
        set_number: idx + 1,
        round_number: null,
    }))
    return { scheme: firstRound, rounds }
}

/** Given a 1-based `set_number` and the number of phases per round, derive
 *  the `{ round, phase }` pair (both 1-based). For `phasesPerRound <= 0`,
 *  returns `{ round: 1, phase: setNumber }` — defensive default for callers
 *  that don't know whether the scheme was materialized. */
export const deriveRoundAndPhase = (
    setNumber: number,
    phasesPerRound: number,
): { round: number; phase: number } => {
    if (!Number.isFinite(setNumber) || setNumber < 1) return { round: 1, phase: 1 }
    if (!Number.isFinite(phasesPerRound) || phasesPerRound <= 0) {
        return { round: 1, phase: Math.max(1, Math.floor(setNumber)) }
    }
    const round = Math.floor((setNumber - 1) / phasesPerRound) + 1
    const phase = ((setNumber - 1) % phasesPerRound) + 1
    return { round, phase }
}

/** Variant of `summarizeSetScheme` that respects `rounds` for compound
 *  methods. The aggregate `(sets, reps, rest_seconds)` is what the parent
 *  template stores, so when `rounds > 1` we need a compact representation
 *  that survives the round trip — for example "3× 10/8/8" instead of joining
 *  every materialized phase with dashes ("10-8-8-10-8-8-10-8-8").
 *
 *  - `rounds <= 1` or scheme not yet expanded: behaves like
 *    `summarizeSetScheme` (joins distinct reps with `-`).
 *  - `rounds > 1`: `sets` = phasesPerRound × rounds; `reps` = `${rounds}× ${a/b/c}`
 *    where `a/b/c` are the per-round phase reps; `rest_seconds` is the rest
 *    AFTER the first phase (i.e. the inner micro-rest, not the inter-round
 *    pause). This keeps the legacy aggregate readable for clients that
 *    haven't yet been updated to read `rounds`. */
export const summarizeWithRounds = (
    perRoundScheme: WorkoutSet[],
    rounds: number,
): SetSchemeSummary => {
    if (!Array.isArray(perRoundScheme) || perRoundScheme.length === 0) {
        throw new Error('summarizeWithRounds: scheme must contain at least one phase')
    }
    const safeRounds = Math.max(1, Math.min(20, Math.floor(rounds)))
    const phasesPerRound = perRoundScheme.length

    if (safeRounds <= 1) {
        return summarizeSetScheme(perRoundScheme)
    }

    const phaseReps = perRoundScheme.map((s) => (s.reps?.trim() ?? '').length > 0 ? s.reps.trim() : '0').join('/')
    const reps = `${safeRounds}× ${phaseReps}`
    const sets = phasesPerRound * safeRounds
    const rest_seconds = Math.max(0, perRoundScheme[0]?.rest_seconds ?? 0)
    return { sets, reps, rest_seconds }
}

/** Format an absolute kg value as the human-readable string used in meta
 *  labels. Strips trailing zeros for whole numbers (`40.0` → `40`) and keeps
 *  one decimal otherwise (`22.5`). Returns null for null/undefined/non-finite.
 */
export const formatWeightKg = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    return Number.isInteger(num) ? `${num}` : num.toFixed(1).replace(/\.0$/, '')
}

/** Build the per-set "Meta: …" label for the **weight** column.
 *
 *  - Both fields filled  → "Meta: 80 kg (75% 1RM)"
 *  - Only kg             → "Meta: 80 kg"
 *  - Only %1RM           → "Meta: 75% 1RM"
 *  - Neither             → null  (UI hides the label, falls back to placeholder)
 */
export const buildWeightMetaLabel = (
    weightKg: number | null | undefined,
    weightPct1rm: number | null | undefined,
): string | null => {
    const kg = formatWeightKg(weightKg)
    const pct = (weightPct1rm === null || weightPct1rm === undefined || !Number.isFinite(Number(weightPct1rm)))
        ? null
        : `${Number(weightPct1rm)}% 1RM`
    if (kg !== null && pct !== null) return `Meta: ${kg} kg (${pct})`
    if (kg !== null) return `Meta: ${kg} kg`
    if (pct !== null) return `Meta: ${pct}`
    return null
}

/** Heuristic: try to identify which preset (if any) a scheme corresponds to.
 * Returns `'standard'` for an empty scheme and `'custom'` when no preset
 * matches. Tolerant to ±10% on rest_seconds and exact match on reps.
 *
 * @deprecated Fase 4.5d: `method_key` reflete a intenção declarada do trainer
 *   (qual chip ele clicou no segmented control), não é mais derivado da
 *   estrutura. Builders web e mobile não chamam mais essa função no save/edit.
 *   Mantida pra retrocompat com qualquer caller externo (ex.: parser de
 *   texto da Fase 5 pode usar pra sugerir o chip ativo após detectar um
 *   padrão pirâmide / drop-set no texto livre). Não use em UIs novas — prefira
 *   deixar `method_key = null` e que o trainer escolha manualmente.
 */
export const inferMethodKeyFromScheme = (
    scheme: WorkoutSet[] | null | undefined,
): MethodKey => {
    if (!scheme || scheme.length === 0) return 'standard'

    for (const presetKey of Object.keys(SYSTEM_PRESETS) as Array<Exclude<MethodKey, 'standard' | 'custom'>>) {
        if (matchesPreset(scheme, SYSTEM_PRESETS[presetKey].defaultSetsConfig)) {
            return presetKey
        }
    }

    return 'custom'
}

const matchesPreset = (a: WorkoutSet[], b: WorkoutSet[]): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        const setA = a[i]
        const setB = b[i]
        if (setA.set_number !== setB.set_number) return false
        if (setA.set_type !== setB.set_type) return false
        if ((setA.reps ?? '').trim() !== (setB.reps ?? '').trim()) return false
        const restA = setA.rest_seconds ?? 0
        const restB = setB.rest_seconds ?? 0
        const tolerance = Math.max(5, Math.round(restB * 0.1))
        if (Math.abs(restA - restB) > tolerance) return false
    }
    return true
}
