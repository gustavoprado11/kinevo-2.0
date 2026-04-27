// ============================================================================
// Method labels — pt-BR display strings for each MethodKey
// ============================================================================
// Single source of truth used by web builder, mobile builder, mobile workout
// execution (student), mobile training room (trainer live coaching) and the
// builder preview. Keeps the chip label identical across surfaces.

import type { MethodKey } from '@kinevo/shared/types/prescription'

export const METHOD_KEY_LABELS: Record<MethodKey, string> = {
    standard: 'Padrão',
    custom: 'Customizado',
    pyramid_down: 'Pirâmide ↓',
    pyramid_up: 'Pirâmide ↑',
    drop_set: 'Drop-set',
    top_backoff: 'Top + backoff',
    '5x5': '5×5',
    cluster: 'Cluster',
}

/** Returns null for `'standard'` (no chip) and the translated label otherwise.
 * Unknown values fall back to `null` so the UI hides the chip — matches
 * Edge Cases section of the spec. */
export const getMethodChipLabel = (key: MethodKey | null | undefined): string | null => {
    if (!key || key === 'standard') return null
    return METHOD_KEY_LABELS[key] ?? null
}
