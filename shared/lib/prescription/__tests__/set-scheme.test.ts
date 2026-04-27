import { describe, expect, it } from 'vitest'

import type { WorkoutSet, MethodKey } from '@kinevo/shared/types/prescription'
import {
    applyPreset,
    expandToSetScheme,
    inferMethodKeyFromScheme,
    summarizeSetScheme,
    validateSetScheme,
} from '../set-scheme'
import { SYSTEM_PRESETS } from '../set-scheme-presets'

const sampleSet = (overrides: Partial<WorkoutSet> & Pick<WorkoutSet, 'set_number'>): WorkoutSet => ({
    set_type: 'normal',
    reps: '10',
    rest_seconds: 60,
    weight_target_kg: null,
    weight_target_pct1rm: null,
    rir: null,
    tempo: null,
    notes: null,
    ...overrides,
})

describe('summarizeSetScheme', () => {
    it('joins distinct reps with dashes (pyramid)', () => {
        const summary = summarizeSetScheme([
            sampleSet({ set_number: 1, reps: '12', rest_seconds: 90 }),
            sampleSet({ set_number: 2, reps: '10', rest_seconds: 90 }),
            sampleSet({ set_number: 3, reps: '8', rest_seconds: 120 }),
            sampleSet({ set_number: 4, reps: '6', rest_seconds: 180 }),
        ])
        expect(summary.sets).toBe(4)
        expect(summary.reps).toBe('12-10-8-6')
        expect(summary.rest_seconds).toBe(90)
    })

    it('collapses identical reps into a single value', () => {
        const summary = summarizeSetScheme([
            sampleSet({ set_number: 1, reps: '10', rest_seconds: 60 }),
            sampleSet({ set_number: 2, reps: '10', rest_seconds: 60 }),
            sampleSet({ set_number: 3, reps: '10', rest_seconds: 60 }),
        ])
        expect(summary.reps).toBe('10')
        expect(summary.sets).toBe(3)
        expect(summary.rest_seconds).toBe(60)
    })

    it('uses the minimum rest as the aggregate', () => {
        const summary = summarizeSetScheme([
            sampleSet({ set_number: 1, reps: '10', rest_seconds: 0 }),
            sampleSet({ set_number: 2, reps: '8', rest_seconds: 0 }),
            sampleSet({ set_number: 3, reps: '6', rest_seconds: 90 }),
        ])
        expect(summary.rest_seconds).toBe(0)
    })

    it('throws on empty scheme', () => {
        expect(() => summarizeSetScheme([])).toThrow()
    })
})

describe('expandToSetScheme', () => {
    it('expands an aggregate triple into N identical sets', () => {
        const scheme = expandToSetScheme(3, '10-12', 60)
        expect(scheme).toHaveLength(3)
        scheme.forEach((s, i) => {
            expect(s.set_number).toBe(i + 1)
            expect(s.set_type).toBe('normal')
            expect(s.reps).toBe('10-12')
            expect(s.rest_seconds).toBe(60)
        })
    })

    it('falls back to defaults for null aggregates', () => {
        const scheme = expandToSetScheme(null, null, null)
        expect(scheme).toHaveLength(3)
        expect(scheme[0].reps).toBe('10')
        expect(scheme[0].rest_seconds).toBe(60)
    })

    it('clamps absurd inputs', () => {
        expect(expandToSetScheme(0, '10', 30)).toHaveLength(1)
        expect(expandToSetScheme(99, '10', 30)).toHaveLength(50)
        expect(expandToSetScheme(2, '10', -5)[0].rest_seconds).toBe(0)
    })

    it('honours a custom set_type', () => {
        const scheme = expandToSetScheme(2, '10', 30, { setType: 'warmup' })
        expect(scheme.every((s) => s.set_type === 'warmup')).toBe(true)
    })
})

describe('validateSetScheme', () => {
    it('passes for a well-formed scheme', () => {
        const result = validateSetScheme([
            sampleSet({ set_number: 1, reps: '12' }),
            sampleSet({ set_number: 2, reps: '10' }),
        ])
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    it('rejects empty scheme', () => {
        expect(validateSetScheme([]).valid).toBe(false)
    })

    it('rejects duplicate set_number', () => {
        const result = validateSetScheme([
            sampleSet({ set_number: 1 }),
            sampleSet({ set_number: 1 }),
        ])
        expect(result.valid).toBe(false)
    })

    it('rejects non-contiguous set_number', () => {
        const result = validateSetScheme([
            sampleSet({ set_number: 1 }),
            sampleSet({ set_number: 3 }),
        ])
        expect(result.valid).toBe(false)
    })

    it('rejects unknown set_type', () => {
        const bad = sampleSet({ set_number: 1 }) as WorkoutSet
        ;(bad as unknown as { set_type: string }).set_type = 'mystery'
        const result = validateSetScheme([bad])
        expect(result.valid).toBe(false)
    })

    it('rejects empty reps', () => {
        const result = validateSetScheme([sampleSet({ set_number: 1, reps: '   ' })])
        expect(result.valid).toBe(false)
    })

    it('rejects negative rest_seconds', () => {
        const result = validateSetScheme([sampleSet({ set_number: 1, rest_seconds: -10 })])
        expect(result.valid).toBe(false)
    })
})

describe('applyPreset', () => {
    it('returns empty for standard/custom', () => {
        expect(applyPreset('standard')).toEqual([])
        expect(applyPreset('custom')).toEqual([])
    })

    it('produces 4-set descending pyramid by default', () => {
        const scheme = applyPreset('pyramid_down')
        expect(scheme.map((s) => s.reps)).toEqual(['12', '10', '8', '6'])
        expect(scheme[scheme.length - 1].rest_seconds).toBeGreaterThanOrEqual(scheme[0].rest_seconds)
    })

    it('honours pyramid sets override', () => {
        const scheme = applyPreset('pyramid_down', { sets: 5, baseReps: 14 })
        expect(scheme).toHaveLength(5)
        expect(scheme[0].reps).toBe('14')
        expect(scheme[4].reps).toBe('6')
    })

    it('drop_set produces 1 normal + 2 drops with declining %1RM', () => {
        const scheme = applyPreset('drop_set', { baseReps: 10, dropPct: 20 })
        expect(scheme).toHaveLength(3)
        expect(scheme[0].set_type).toBe('normal')
        expect(scheme[1].set_type).toBe('drop')
        expect(scheme[2].set_type).toBe('drop')
        expect(scheme[0].weight_target_pct1rm).toBe(100)
        expect(scheme[1].weight_target_pct1rm).toBe(80)
        expect(scheme[2].weight_target_pct1rm).toBe(60)
        expect(scheme.every((s) => s.rest_seconds === 0)).toBe(true)
    })

    it('5x5 produces 5 sets of 5 reps with 180s rest', () => {
        const scheme = applyPreset('5x5')
        expect(scheme).toHaveLength(5)
        expect(scheme.every((s) => s.reps === '5' && s.rest_seconds === 180)).toBe(true)
    })

    it('cluster default has a single set with rest-pause reps', () => {
        const scheme = applyPreset('cluster')
        expect(scheme).toHaveLength(1)
        expect(scheme[0].set_type).toBe('cluster')
        expect(scheme[0].reps).toBe('8+4+2')
    })
})

describe('inferMethodKeyFromScheme', () => {
    it('returns standard for empty', () => {
        expect(inferMethodKeyFromScheme([])).toBe('standard')
        expect(inferMethodKeyFromScheme(null)).toBe('standard')
    })

    it('detects each system preset via roundtrip', () => {
        const keys = Object.keys(SYSTEM_PRESETS) as Array<Exclude<MethodKey, 'standard' | 'custom'>>
        keys.forEach((key) => {
            const scheme = applyPreset(key)
            expect(inferMethodKeyFromScheme(scheme)).toBe(key)
        })
    })

    it('returns custom for an arbitrary scheme', () => {
        const scheme: WorkoutSet[] = [
            sampleSet({ set_number: 1, reps: '7', rest_seconds: 33 }),
            sampleSet({ set_number: 2, reps: '5', rest_seconds: 44 }),
        ]
        expect(inferMethodKeyFromScheme(scheme)).toBe('custom')
    })
})
