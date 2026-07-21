import { describe, expect, it } from 'vitest'
import { HR_ZONES, resolveZoneBpm, zonePctLabel, formatIntensityTarget } from '../zones'
import { CARDIO_PROTOCOLS, cardioProtocol, protocolMatchesIntervals } from '../interval-protocols'

describe('resolveZoneBpm', () => {
    it('resolve as 5 zonas para FCmáx 190', () => {
        expect(resolveZoneBpm(1, 190)).toEqual({ min: 95, max: 114 })
        expect(resolveZoneBpm(2, 190)).toEqual({ min: 114, max: 133 })
        expect(resolveZoneBpm(3, 190)).toEqual({ min: 133, max: 152 })
        expect(resolveZoneBpm(4, 190)).toEqual({ min: 152, max: 171 })
        expect(resolveZoneBpm(5, 190)).toEqual({ min: 171, max: 190 })
    })

    it('arredonda para inteiro', () => {
        const z2 = resolveZoneBpm(2, 185)
        expect(z2).toEqual({ min: 111, max: 130 }) // 111.0 / 129.5 → 130
    })

    it('null para zona inválida ou FCmáx ausente', () => {
        expect(resolveZoneBpm(6, 190)).toBeNull()
        expect(resolveZoneBpm(2, null)).toBeNull()
        expect(resolveZoneBpm(2, 0)).toBeNull()
    })
})

describe('formatIntensityTarget', () => {
    it('zone com FCmáx → bpm', () => {
        expect(formatIntensityTarget({ type: 'zone', zone: 2 }, 190)).toBe('Zona 2 · 114–133 bpm')
    })

    it('zone sem FCmáx → %FCmáx', () => {
        expect(formatIntensityTarget({ type: 'zone', zone: 2 }, null)).toBe('Zona 2 · 60–70% FCmáx')
        expect(zonePctLabel(4)).toBe('80–90% FCmáx')
    })

    it('hr / rpe / pace', () => {
        expect(formatIntensityTarget({ type: 'hr', hr_min_bpm: 130, hr_max_bpm: 150 })).toBe('130–150 bpm')
        expect(formatIntensityTarget({ type: 'rpe', rpe: 7 })).toBe('RPE 7')
        expect(formatIntensityTarget({ type: 'pace', pace_min_per_km: '5:30' })).toBe('Pace 5:30 /km')
    })

    it('alvos incompletos → null', () => {
        expect(formatIntensityTarget(null)).toBeNull()
        expect(formatIntensityTarget({ type: 'hr', hr_min_bpm: 130 })).toBeNull()
        expect(formatIntensityTarget({ type: 'rpe' })).toBeNull()
    })
})

describe('CARDIO_PROTOCOLS', () => {
    it('shape íntegro e keys únicos', () => {
        const keys = new Set(CARDIO_PROTOCOLS.map(p => p.key))
        expect(keys.size).toBe(CARDIO_PROTOCOLS.length)
        for (const p of CARDIO_PROTOCOLS) {
            expect(p.intervals.work_seconds).toBeGreaterThan(0)
            expect(p.intervals.rest_seconds).toBeGreaterThanOrEqual(0)
            expect(p.intervals.rounds).toBeGreaterThan(0)
            expect(p.label.length).toBeGreaterThan(0)
        }
    })

    it('tabata é 20/10×8', () => {
        expect(cardioProtocol('tabata')?.intervals).toEqual({ work_seconds: 20, rest_seconds: 10, rounds: 8 })
    })

    it('protocolMatchesIntervals: casa e descasa', () => {
        expect(protocolMatchesIntervals('tabata', { work_seconds: 20, rest_seconds: 10, rounds: 8 })).toBe(true)
        expect(protocolMatchesIntervals('tabata', { work_seconds: 30, rest_seconds: 10, rounds: 8 })).toBe(false)
        expect(protocolMatchesIntervals('desconhecido', { work_seconds: 20, rest_seconds: 10, rounds: 8 })).toBe(false)
    })
})
