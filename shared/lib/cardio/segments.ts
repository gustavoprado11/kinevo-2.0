// ============================================================================
// Kinevo — Aeróbio por fases (fonte única de duração e resumo)
// ============================================================================
// Helpers do modo 'phased' (CardioConfig.segments): duração de cada segmento,
// total do bloco nas TRÊS modalidades e o resumo compacto que vira a string
// derivada `intensity` — a chave da retrocompat (todas as superfícies de
// exibição e os apps antigos leem duration_minutes/intensity, não segments).
//
// Fórmula canônica do intervalado: work×rounds + rest×(rounds−1) — o descanso
// após o último round não conta (era divergente entre workout-panel e card).

import type { CardioConfig, CardioIntervalConfig, CardioSegment } from '../../types/workout-items'
import { formatIntensityTarget } from './zones'

/** Segundos de um bloco intervalado (sem o descanso após o último round). */
export function intervalBlockSeconds(intervals: CardioIntervalConfig | null | undefined): number {
    if (!intervals) return 0
    const { work_seconds = 0, rest_seconds = 0, rounds = 0 } = intervals
    if (rounds <= 0) return 0
    return work_seconds * rounds + rest_seconds * Math.max(0, rounds - 1)
}

/** Segundos estimados de UM segmento. */
export function segmentDurationSeconds(segment: CardioSegment | null | undefined): number {
    if (!segment) return 0
    if (segment.kind === 'interval') return intervalBlockSeconds(segment.intervals)
    return Math.round((segment.duration_minutes ?? 0) * 60)
}

/** Total estimado (s) de um CardioConfig nas três modalidades. */
export function cardioTotalSeconds(config: CardioConfig | null | undefined): number {
    if (!config) return 0
    if (config.mode === 'phased') {
        return (config.segments ?? []).reduce((sum, s) => sum + segmentDurationSeconds(s), 0)
    }
    if (config.mode === 'interval') return intervalBlockSeconds(config.intervals)
    return Math.round((config.duration_minutes ?? 0) * 60)
}

/** "24min" / "3min 50s" / "45s" — formatação curta de segundos. */
export function formatShortDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return '—'
    const min = Math.floor(totalSeconds / 60)
    const sec = totalSeconds % 60
    if (min === 0) return `${sec}s`
    if (sec === 0) return `${min}min`
    return `${min}min ${sec}s`
}

/** Estrutura de um segmento SEM intensidade ("10min" / "8× 30/30"). */
export function segmentStructureLabel(segment: CardioSegment): string {
    if (segment.kind === 'interval') {
        const iv = segment.intervals
        if (!iv) return '—'
        return `${iv.rounds}× ${iv.work_seconds}/${iv.rest_seconds}`
    }
    return formatShortDuration(segmentDurationSeconds(segment))
}

/**
 * Exibição completa de um segmento — usada na execução do aluno e no preview.
 * Ex.: "Aquecimento · 10min · Zona 1 · 95–114 bpm" ou "8× 30/30 · RPE 9".
 */
export function segmentDisplay(segment: CardioSegment, maxHrBpm?: number | null): string {
    const parts: string[] = []
    if (segment.label) parts.push(segment.label)
    parts.push(segmentStructureLabel(segment))
    const intensity = segment.intensity
        ?? formatIntensityTarget(segment.intensity_target ?? null, maxHrBpm)
    if (intensity) parts.push(intensity)
    return parts.join(' · ')
}

/** Intensidade CURTA de um segmento pro resumo ("Z2", "RPE 9", "130–150"). */
function shortIntensity(segment: CardioSegment): string | null {
    const t = segment.intensity_target
    if (t) {
        if (t.type === 'zone' && t.zone) return `Z${t.zone}`
        if (t.type === 'rpe' && t.rpe != null) return `RPE ${t.rpe}`
        if (t.type === 'hr' && t.hr_min_bpm != null && t.hr_max_bpm != null) return `${t.hr_min_bpm}–${t.hr_max_bpm}`
        if (t.type === 'pace' && t.pace_min_per_km) return t.pace_min_per_km
    }
    return segment.intensity ?? null
}

/**
 * Resumo compacto da sequência — vira a string derivada `intensity` do bloco
 * phased. Ex.: "10min Z1 → 8× 20/10 RPE 9 → 5min Z1".
 */
export function summarizeSegments(segments: CardioSegment[] | null | undefined): string {
    if (!segments || segments.length === 0) return ''
    return segments
        .map((s) => {
            const structure = segmentStructureLabel(s)
            const intensity = shortIntensity(s)
            return intensity ? `${structure} ${intensity}` : structure
        })
        .join(' → ')
}
