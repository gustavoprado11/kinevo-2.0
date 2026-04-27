// ============================================================================
// Set type labels — pt-BR display strings for each SetType
// ============================================================================
// Single source of truth for the per-set badge label / full label across web,
// mobile (student execution + trainer live coaching + builder preview).
// Keeps wording identical so the trainer and the student read the same thing.

import type { SetType } from '@kinevo/shared/types/prescription'

/** Full pt-BR labels (used in tooltips, accessibility, expanded UIs). */
export const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: 'Aquecimento',
    normal: 'Normal',
    top: 'Top',
    backoff: 'Backoff',
    drop: 'Drop',
    failure: 'Falha',
    cluster: 'Cluster',
    amrap: 'AMRAP',
}

/** Compact uppercase labels used inside the per-set badge in workout cards.
 *  `'normal'` returns an empty string — caller should hide the badge. */
export const SET_TYPE_BADGE_LABELS: Record<SetType, string> = {
    warmup: 'W',
    normal: '',
    top: 'TOP',
    backoff: 'BACK',
    drop: 'DROP',
    failure: 'FAIL',
    cluster: 'CLUSTER',
    amrap: 'AMRAP',
}
