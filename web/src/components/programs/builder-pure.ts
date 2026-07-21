/**
 * Núcleo PURO do builder — helpers sem nenhuma dependência client-side.
 *
 * Existe porque builder-model.ts importa @dnd-kit (client-only): qualquer
 * Server Component que precise destes helpers (ex.: a página program/new
 * hidratando a cópia do programa atual) quebraria o RSC ao puxar o módulo
 * inteiro. builder-model RE-EXPORTA daqui — os imports existentes não mudam.
 */
import { collapseExpandedScheme } from '@kinevo/shared/lib/prescription/set-scheme'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'

export const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

/** Colapsa as linhas materializadas (workout_item_sets) de volta ao set_scheme
 *  editável + rounds. Sem linhas → modo simples ({ scheme: null, rounds: 1 }). */
export function hydrateSetScheme(
    rows: WorkoutSet[] | null | undefined,
    roundsHint: number | null | undefined,
): { scheme: WorkoutSet[] | null; rounds: number } {
    if (!rows || rows.length === 0) return { scheme: null, rounds: 1 }
    const sorted = [...rows].sort((a, b) => a.set_number - b.set_number)
    const collapsed = collapseExpandedScheme(sorted, roundsHint ?? 1)
    return {
        scheme: collapsed.scheme.length > 0 ? collapsed.scheme : null,
        rounds: collapsed.rounds,
    }
}
