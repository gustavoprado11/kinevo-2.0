// ============================================================================
// Kinevo — Protocolos intervalados nomeados (fonte única)
// ============================================================================
// Espelho dos presets de método da força (set-scheme-presets): um clique
// preenche work/rest/rounds + alvo de intensidade sugerido. O key escolhido
// fica em CardioConfig.protocol_key; editar os números manualmente limpa o
// selo (os números valem — mesma semântica do chip de método).

import type { CardioIntensityTarget, CardioIntervalConfig } from '../../types/workout-items'

export interface CardioIntervalProtocol {
    key: string
    label: string
    /** Descrição curta para o treinador (tooltip/subtítulo). */
    description: string
    intervals: CardioIntervalConfig
    /** Alvo sugerido — aplicado junto ao escolher o protocolo (editável depois). */
    suggested_target: CardioIntensityTarget
}

export const CARDIO_PROTOCOLS: readonly CardioIntervalProtocol[] = [
    {
        key: 'tabata',
        label: 'Tabata',
        description: '20s forte / 10s descanso × 8 (4 min all-out)',
        intervals: { work_seconds: 20, rest_seconds: 10, rounds: 8 },
        suggested_target: { type: 'rpe', rpe: 9 },
    },
    {
        key: 'hiit_15_15',
        label: 'HIIT 15/15',
        description: '15s forte / 15s leve × 20',
        intervals: { work_seconds: 15, rest_seconds: 15, rounds: 20 },
        suggested_target: { type: 'zone', zone: 5 },
    },
    {
        key: 'hiit_30_30',
        label: 'HIIT 30/30',
        description: '30s forte / 30s leve × 10',
        intervals: { work_seconds: 30, rest_seconds: 30, rounds: 10 },
        suggested_target: { type: 'zone', zone: 4 },
    },
    {
        key: 'hiit_40_20',
        label: 'HIIT 40/20',
        description: '40s forte / 20s leve × 10',
        intervals: { work_seconds: 40, rest_seconds: 20, rounds: 10 },
        suggested_target: { type: 'zone', zone: 4 },
    },
    {
        key: 'norwegian_4x4',
        label: '4×4 Norueguês',
        description: '4min forte / 3min leve × 4 (limiar/VO2max)',
        intervals: { work_seconds: 240, rest_seconds: 180, rounds: 4 },
        suggested_target: { type: 'zone', zone: 4 },
    },
] as const

export function cardioProtocol(key: string | null | undefined): CardioIntervalProtocol | null {
    if (!key) return null
    return CARDIO_PROTOCOLS.find(p => p.key === key) ?? null
}

/** Label do protocolo para exibição ("Tabata"); null quando key desconhecido. */
export function cardioProtocolLabel(key: string | null | undefined): string | null {
    return cardioProtocol(key)?.label ?? null
}

/** O key ainda descreve os números atuais? (editar números → selo cai) */
export function protocolMatchesIntervals(
    key: string | null | undefined,
    intervals: CardioIntervalConfig | null | undefined,
): boolean {
    const p = cardioProtocol(key)
    if (!p || !intervals) return false
    return (
        p.intervals.work_seconds === intervals.work_seconds &&
        p.intervals.rest_seconds === intervals.rest_seconds &&
        p.intervals.rounds === intervals.rounds
    )
}
