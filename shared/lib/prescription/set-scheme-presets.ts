// ============================================================================
// System training-method presets — per-set prescription
// ============================================================================
// These constants are the source of truth for the 6 system presets seeded
// in `training_method_presets` (migration 111). The SQL seed must produce the
// same `sets_config` JSON for each key — `set-scheme-presets.test.ts`
// guarantees this stays aligned with `applyPreset()` from `set-scheme.ts`.
//
// `'standard'` and `'custom'` are not presets; they are method markers.

import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription'

export interface SystemPresetDefinition {
    key: MethodKey
    name: string
    description: string
    /** Per-round structure. For linear presets (rounds = 1) this is the full
     *  scheme. For compound presets (drop-set, cluster) this is ONE round and
     *  the builder/Edge Function expand it `defaultRounds` times at save. */
    defaultSetsConfig: WorkoutSet[]
    /** How many rounds the preset describes by default. 1 for linear methods
     *  (pyramid, 5×5, top+backoff). 3 for compound methods (drop-set, cluster). */
    defaultRounds: number
}

const baseSet = (overrides: Partial<WorkoutSet> & Pick<WorkoutSet, 'set_number' | 'set_type' | 'reps' | 'rest_seconds'>): WorkoutSet => ({
    weight_target_kg: null,
    weight_target_pct1rm: null,
    rir: null,
    tempo: null,
    notes: null,
    ...overrides,
})

export const PYRAMID_DOWN_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'normal', reps: '12', rest_seconds: 90 }),
    baseSet({ set_number: 2, set_type: 'normal', reps: '10', rest_seconds: 90 }),
    baseSet({ set_number: 3, set_type: 'normal', reps: '8', rest_seconds: 120 }),
    baseSet({ set_number: 4, set_type: 'normal', reps: '6', rest_seconds: 180 }),
]

export const PYRAMID_UP_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'normal', reps: '6', rest_seconds: 180 }),
    baseSet({ set_number: 2, set_type: 'normal', reps: '8', rest_seconds: 120 }),
    baseSet({ set_number: 3, set_type: 'normal', reps: '10', rest_seconds: 90 }),
    baseSet({ set_number: 4, set_type: 'normal', reps: '12', rest_seconds: 90 }),
]

export const DROP_SET_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'normal', reps: '10', rest_seconds: 0, weight_target_pct1rm: 100 }),
    baseSet({ set_number: 2, set_type: 'drop', reps: '8', rest_seconds: 0, weight_target_pct1rm: 80 }),
    baseSet({ set_number: 3, set_type: 'drop', reps: '8', rest_seconds: 0, weight_target_pct1rm: 60 }),
]

export const TOP_BACKOFF_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'top', reps: '5', rest_seconds: 180, weight_target_pct1rm: 90 }),
    baseSet({ set_number: 2, set_type: 'backoff', reps: '8', rest_seconds: 120, weight_target_pct1rm: 80 }),
    baseSet({ set_number: 3, set_type: 'backoff', reps: '8', rest_seconds: 120, weight_target_pct1rm: 80 }),
    baseSet({ set_number: 4, set_type: 'backoff', reps: '8', rest_seconds: 120, weight_target_pct1rm: 80 }),
]

export const FIVE_BY_FIVE_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'normal', reps: '5', rest_seconds: 180 }),
    baseSet({ set_number: 2, set_type: 'normal', reps: '5', rest_seconds: 180 }),
    baseSet({ set_number: 3, set_type: 'normal', reps: '5', rest_seconds: 180 }),
    baseSet({ set_number: 4, set_type: 'normal', reps: '5', rest_seconds: 180 }),
    baseSet({ set_number: 5, set_type: 'normal', reps: '5', rest_seconds: 180 }),
]

// One round of a cluster (rest-pause) session. The trainer prescribes 3
// rounds by default → materialized into 9 physical phases at save. Each
// round has 3 phases of decreasing reps with 15s micro-rests inside the
// round; the last phase keeps a longer rest_seconds (180s) so the inter-
// round pause is preserved when the scheme is expanded.
export const CLUSTER_DEFAULT: WorkoutSet[] = [
    baseSet({ set_number: 1, set_type: 'cluster', reps: '8', rest_seconds: 15 }),
    baseSet({ set_number: 2, set_type: 'cluster', reps: '4', rest_seconds: 15 }),
    baseSet({ set_number: 3, set_type: 'cluster', reps: '2', rest_seconds: 180 }),
]

export const SYSTEM_PRESETS: Record<
    Exclude<MethodKey, 'standard' | 'custom'>,
    SystemPresetDefinition
> = {
    pyramid_down: {
        key: 'pyramid_down',
        name: 'Pirâmide ↓',
        description: 'Reps decrescentes com descanso crescente (12-10-8-6).',
        defaultSetsConfig: PYRAMID_DOWN_DEFAULT,
        defaultRounds: 1,
    },
    pyramid_up: {
        key: 'pyramid_up',
        name: 'Pirâmide ↑',
        description: 'Reps crescentes com descanso decrescente (6-8-10-12).',
        defaultSetsConfig: PYRAMID_UP_DEFAULT,
        defaultRounds: 1,
    },
    drop_set: {
        key: 'drop_set',
        name: 'Drop-set',
        description: '3 rodadas: série base + 2 quedas de carga sem descanso.',
        defaultSetsConfig: DROP_SET_DEFAULT,
        defaultRounds: 3,
    },
    top_backoff: {
        key: 'top_backoff',
        name: 'Top + backoff',
        description: 'Série pesada de top + 3 backoffs a ~80%.',
        defaultSetsConfig: TOP_BACKOFF_DEFAULT,
        defaultRounds: 1,
    },
    '5x5': {
        key: '5x5',
        name: '5×5',
        description: '5 séries de 5 reps com 180s de descanso.',
        defaultSetsConfig: FIVE_BY_FIVE_DEFAULT,
        defaultRounds: 1,
    },
    cluster: {
        key: 'cluster',
        name: 'Cluster (rest-pause)',
        description: '3 rodadas com microdescansos: 8/4/2 reps por rodada.',
        defaultSetsConfig: CLUSTER_DEFAULT,
        defaultRounds: 3,
    },
}

/** Method keys whose `set_scheme` is a per-round structure that must be
 *  expanded `defaultRounds` times at save (Fase 4.3). Linear methods keep
 *  rounds=1 and the scheme is materialized as is. */
export const COMPOUND_METHOD_KEYS: ReadonlySet<MethodKey> = new Set<MethodKey>([
    'drop_set',
    'cluster',
])

export const isCompoundMethod = (key: MethodKey | null | undefined): boolean =>
    key !== null && key !== undefined && COMPOUND_METHOD_KEYS.has(key)
