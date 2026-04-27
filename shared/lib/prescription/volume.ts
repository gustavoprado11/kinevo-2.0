// ============================================================================
// Volume — effective sets for weekly volume calculations
// ============================================================================
// One source of truth for "how many sets does this item contribute to weekly
// volume?". Consumed by both mobile and web volume summaries and by the
// server-side `get-program-muscle-volume` action.
//
// Convention (Fase 4.5a):
//   - Linear methods (rounds=1 or null): each phase IS one set. `sets`
//     reflects the contagem certa, no transformation needed.
//   - Compound methods (drop-set, cluster, rounds > 1): the prescribed
//     scheme is repeated `rounds` times and each ROUND counts as ONE
//     effective set, regardless of how many phases live inside the round.
//
// Why: aligns with literatura científica (Schoenfeld et al., 2017+) and with
// how the student execution UX counts progress ("Rodada 1 de 3", not
// "Fase 5 de 9"). Avoids overcounting compound methods 2-3× when a trainer
// programmes a drop-set 3 rounds twice a week (was 18 sets/week, should be 6).
//
// Programs created before the rounds model (rounds=null) keep `sets` as the
// effective count — same byte-for-byte behaviour as before.

export interface VolumeItem {
    sets: number | null
    rounds?: number | null
}

/** Effective sets contributed to weekly volume by a single workout item.
 *
 *  - Compound (rounds > 1): returns `rounds` (each round = 1 effective set).
 *  - Linear / legacy (rounds <= 1, null, or undefined): returns `sets ?? 0`.
 *
 *  Defensive: returns 0 for null `sets` so callers can multiply by frequency
 *  without producing NaN. */
export const effectiveSetsForVolume = (item: VolumeItem): number => {
    if (item.rounds && item.rounds > 1) return item.rounds
    return item.sets ?? 0
}
