import { describe, expect, it } from 'vitest'
import type { CardioConfig, CardioSegment } from '../../../types/workout-items'
import {
    cardioTotalSeconds,
    formatShortDuration,
    intervalBlockSeconds,
    segmentDisplay,
    segmentDurationSeconds,
    summarizeSegments,
} from '../segments'

const steady = (min: number, zone?: 1 | 2 | 3 | 4 | 5, label?: string): CardioSegment => ({
    kind: 'steady',
    label,
    duration_minutes: min,
    intensity_target: zone ? { type: 'zone', zone } : undefined,
})

const tabata: CardioSegment = {
    kind: 'interval',
    intervals: { work_seconds: 20, rest_seconds: 10, rounds: 8 },
    intensity_target: { type: 'rpe', rpe: 9 },
}

describe('intervalBlockSeconds', () => {
    it('descarta o descanso após o último round (fórmula canônica)', () => {
        expect(intervalBlockSeconds({ work_seconds: 20, rest_seconds: 10, rounds: 8 })).toBe(230) // 160 + 70
        expect(intervalBlockSeconds({ work_seconds: 30, rest_seconds: 30, rounds: 1 })).toBe(30)
        expect(intervalBlockSeconds(null)).toBe(0)
    })
})

describe('cardioTotalSeconds — as três modalidades', () => {
    it('continuous usa duration_minutes', () => {
        expect(cardioTotalSeconds({ mode: 'continuous', duration_minutes: 30 })).toBe(1800)
    })
    it('interval usa a fórmula canônica', () => {
        expect(cardioTotalSeconds({
            mode: 'interval',
            intervals: { work_seconds: 240, rest_seconds: 180, rounds: 4 },
        })).toBe(240 * 4 + 180 * 3)
    })
    it('phased soma os segmentos (misto: 10min + tabata + 5min)', () => {
        const config: CardioConfig = {
            mode: 'phased',
            segments: [steady(10, 1), tabata, steady(5, 1)],
        }
        expect(cardioTotalSeconds(config)).toBe(600 + 230 + 300)
    })
    it('phased sem segmentos = 0; config nulo = 0', () => {
        expect(cardioTotalSeconds({ mode: 'phased' })).toBe(0)
        expect(cardioTotalSeconds(null)).toBe(0)
    })
})

describe('segmentDurationSeconds / formatShortDuration', () => {
    it('steady em minutos; interval pela fórmula', () => {
        expect(segmentDurationSeconds(steady(10))).toBe(600)
        expect(segmentDurationSeconds(tabata)).toBe(230)
    })
    it('formata curto', () => {
        expect(formatShortDuration(230)).toBe('3min 50s')
        expect(formatShortDuration(600)).toBe('10min')
        expect(formatShortDuration(45)).toBe('45s')
        expect(formatShortDuration(0)).toBe('—')
    })
})

describe('summarizeSegments (string derivada do bloco)', () => {
    it('caso misto: aquecimento + tiros + solto', () => {
        expect(summarizeSegments([steady(10, 1), tabata, steady(5, 1)]))
            .toBe('10min Z1 → 8× 20/10 RPE 9 → 5min Z1')
    })
    it('caso "séries diferentes": dois blocos intervalados', () => {
        const b1: CardioSegment = { kind: 'interval', intervals: { work_seconds: 30, rest_seconds: 30, rounds: 4 }, intensity_target: { type: 'zone', zone: 5 } }
        const b2: CardioSegment = { kind: 'interval', intervals: { work_seconds: 60, rest_seconds: 60, rounds: 4 }, intensity_target: { type: 'zone', zone: 4 } }
        expect(summarizeSegments([b1, b2])).toBe('4× 30/30 Z5 → 4× 60/60 Z4')
    })
    it('contínuo progressivo', () => {
        expect(summarizeSegments([steady(10, 1), steady(20, 2), steady(5, 1)]))
            .toBe('10min Z1 → 20min Z2 → 5min Z1')
    })
    it('vazio', () => {
        expect(summarizeSegments([])).toBe('')
        expect(summarizeSegments(null)).toBe('')
    })
})

describe('segmentDisplay', () => {
    it('resolve zona em bpm com FCmáx e inclui rótulo', () => {
        expect(segmentDisplay(steady(10, 1, 'Aquecimento'), 190))
            .toBe('Aquecimento · 10min · Zona 1 · 95–114 bpm')
    })
    it('sem FCmáx cai em %', () => {
        expect(segmentDisplay(steady(20, 2), null)).toBe('20min · Zona 2 · 60–70% FCmáx')
    })
})
