import { effectiveSetsForVolume } from '@kinevo/shared/lib/prescription/volume'

import type { WorkoutItem } from '../program-builder-client'

/**
 * Renders the reps target for a workout item. For compound methods (drop-set,
 * cluster) with a populated `set_scheme`, reads reps from the FIRST round only
 * (filtering by `round_number === 1`, or using all rows when `round_number` is
 * absent — legacy schemes pre-Fase-4.3) and joins distinct values with `-`
 * (e.g. "8-6-4"). Falls back to `item.reps` when set_scheme is missing or has
 * a single phase.
 */
export function repsDisplay(item: WorkoutItem): string {
    const scheme = item.set_scheme
    if (scheme && scheme.length > 1) {
        const firstRound = scheme.filter(
            (s) => s.round_number === undefined || s.round_number === null || s.round_number === 1,
        )
        const phases = firstRound.length > 1 ? firstRound : scheme
        const repsList = phases
            .map((s) => s.reps)
            .filter((r) => typeof r === 'string' && r.length > 0)
        const unique = Array.from(new Set(repsList))
        if (unique.length > 1) return repsList.join('-')
        if (unique.length === 1) return unique[0]
    }
    return String(item.reps ?? '—')
}

/**
 * Computes the display fields for compound methods (rounds > 1). Returns the
 * normalized rounds count, the reps display, and the effective sets contributed
 * to weekly volume. Each card formats the final string however fits its UX.
 *
 * Effective sets follows `effectiveSetsForVolume` — for compound methods, each
 * round counts as ONE effective set regardless of how many phases live inside.
 */
export function compoundSummary(item: WorkoutItem): {
    rounds: number
    reps: string
    effective: number
} {
    const sets = item.sets ?? 0
    const rounds = Math.max(1, Math.min(20, Math.floor(item.rounds ?? 1)))
    const reps = repsDisplay(item)
    const effective = effectiveSetsForVolume({ sets, rounds })
    return { rounds, reps, effective }
}
