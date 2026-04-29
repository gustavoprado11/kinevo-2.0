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

/** Labels pt-BR sentence-case usados dentro do badge do set durante a
 *  execução. Substitui as abreviações em caixa-alta (TOP/BACK/FAIL/...) que
 *  eram opacas pro aluno — agora ele lê "Drop", "Falha", "Cluster" etc. e
 *  tem alguma chance de associar à explicação do treinador, ainda que não
 *  conheça o jargão. AMRAP fica como sigla pelo uso consagrado.
 *  `'normal'` retorna string vazia — caller deve esconder o badge. */
export const SET_TYPE_BADGE_LABELS: Record<SetType, string> = {
    warmup: 'Aquecimento',
    normal: '',
    top: 'Top',
    backoff: 'Backoff',
    drop: 'Drop',
    failure: 'Falha',
    cluster: 'Cluster',
    amrap: 'AMRAP',
}
