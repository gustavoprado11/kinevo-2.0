// 1RM estimado — fonte ÚNICA (S5: havia duas fórmulas divergentes por
// construção: o relatório de programa usava best-of Epley+Brzycki e o chat
// MCP usava Epley puro — o mesmo treinador via 1RMs diferentes para os
// mesmos set_logs dependendo da superfície).

/**
 * Estimated 1RM from a single set using the best (larger) of Epley and
 * Brzycki. Brzycki is undefined at reps >= 37, so we clamp. Returns 0 for
 * invalid input. Both formulas agree on 1RM when reps == 1.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
    if (!weight || !reps || weight <= 0 || reps <= 0) return 0
    const epley = weight * (1 + reps / 30)
    // Brzycki explodes as reps approaches 37; clamp to a safe ceiling.
    const brzyckiDen = 37 - Math.min(reps, 36)
    const brzycki = brzyckiDen > 0 ? weight * (36 / brzyckiDen) : epley
    return Math.max(epley, brzycki)
}
