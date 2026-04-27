// ============================================================================
// hydrateWorkoutSets — single source of truth for set_scheme hydration
// ============================================================================
// Used by student execution (useWorkoutSession) and trainer live coaching
// (useTrainerWorkoutSession) so both surfaces show identical reps/types per
// set. Programs without per-set rows fall back to the legacy aggregate
// behaviour (N identical sets, set_type='normal').

import type { SetType, WorkoutSet } from '@kinevo/shared/types/prescription'

/** Per-set prescription used for rendering. Mirrors `assigned_workout_item_sets`
 *  but with only the fields the UI needs. */
export interface SetPrescription {
    set_number: number
    set_type: SetType
    reps_target: string
    rest_seconds: number
    weight_target_kg: number | null
    weight_target_pct1rm: number | null
    rir: number | null
    tempo: string | null
    notes: string | null
}

/** Build the per-set prescription for one item.
 *
 *  - When `assignedSets` has rows, sort by `set_number` and map them.
 *  - Otherwise fall back to N identical entries built from the aggregate
 *    `(sets, reps, rest_seconds)` triple — preserves legacy behaviour byte
 *    for byte. */
export function hydrateSetPrescriptions(opts: {
    assignedSets: WorkoutSet[] | null | undefined
    aggregateSets: number | null | undefined
    aggregateReps: string | null | undefined
    aggregateRestSeconds: number | null | undefined
}): SetPrescription[] {
    const { assignedSets, aggregateSets, aggregateReps, aggregateRestSeconds } = opts

    if (Array.isArray(assignedSets) && assignedSets.length > 0) {
        return [...assignedSets]
            .sort((a, b) => a.set_number - b.set_number)
            .map((s) => ({
                set_number: s.set_number,
                set_type: s.set_type,
                reps_target: s.reps,
                rest_seconds: s.rest_seconds,
                weight_target_kg: s.weight_target_kg,
                weight_target_pct1rm: s.weight_target_pct1rm,
                rir: s.rir,
                tempo: s.tempo,
                notes: s.notes,
            }))
    }

    const fallbackCount = Math.max(0, Number.isFinite(aggregateSets) ? Number(aggregateSets) : 0)
    const reps = (aggregateReps ?? '').trim()
    const rest = Math.max(0, Number(aggregateRestSeconds ?? 0))

    return Array.from({ length: fallbackCount }, (_, i) => ({
        set_number: i + 1,
        set_type: 'normal' as SetType,
        reps_target: reps,
        rest_seconds: rest,
        weight_target_kg: null,
        weight_target_pct1rm: null,
        rir: null,
        tempo: null,
        notes: null,
    }))
}
