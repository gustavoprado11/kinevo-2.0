import { describe, expect, it } from 'vitest'

import type { WorkoutSet, MethodKey } from '@kinevo/shared/types/prescription'
import {
    applyPreset,
    buildWeightMetaLabel,
    collapseExpandedScheme,
    deriveRoundAndPhase,
    expandSchemeByRounds,
    expandToSetScheme,
    formatWeightKg,
    inferMethodKeyFromScheme,
    summarizeSetScheme,
    summarizeWithRounds,
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

    it('cluster default describes one round of 3 rest-pause phases (8/4/2)', () => {
        // Fase 4.3: cluster is now a compound method with `defaultRounds: 3`.
        // The per-round config has 3 phases (8 reps, 4 reps, 2 reps with the
        // last carrying the inter-round pause). The builder save flow expands
        // it into 9 physical phases when materializing.
        const scheme = applyPreset('cluster')
        expect(scheme).toHaveLength(3)
        expect(scheme.every((s) => s.set_type === 'cluster')).toBe(true)
        expect(scheme.map((s) => s.reps)).toEqual(['8', '4', '2'])
        expect(scheme[scheme.length - 1].rest_seconds).toBeGreaterThanOrEqual(60)
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

describe('formatWeightKg', () => {
    it('strips trailing zeros from whole numbers', () => {
        expect(formatWeightKg(40)).toBe('40')
        expect(formatWeightKg(40.0)).toBe('40')
        expect(formatWeightKg(80)).toBe('80')
    })

    it('keeps a decimal for non-integer values', () => {
        expect(formatWeightKg(22.5)).toBe('22.5')
        expect(formatWeightKg(7.5)).toBe('7.5')
    })

    it('returns null for null/undefined/non-finite input', () => {
        expect(formatWeightKg(null)).toBeNull()
        expect(formatWeightKg(undefined)).toBeNull()
        expect(formatWeightKg(Number.NaN)).toBeNull()
        expect(formatWeightKg(Number.POSITIVE_INFINITY)).toBeNull()
    })
})

describe('buildWeightMetaLabel', () => {
    it('returns null when neither value is provided', () => {
        expect(buildWeightMetaLabel(null, null)).toBeNull()
        expect(buildWeightMetaLabel(undefined, undefined)).toBeNull()
    })

    it('formats kg only', () => {
        expect(buildWeightMetaLabel(80, null)).toBe('Meta: 80 kg')
        expect(buildWeightMetaLabel(22.5, null)).toBe('Meta: 22.5 kg')
        expect(buildWeightMetaLabel(40.0, undefined)).toBe('Meta: 40 kg')
    })

    it('formats %1RM only', () => {
        expect(buildWeightMetaLabel(null, 75)).toBe('Meta: 75% 1RM')
        expect(buildWeightMetaLabel(undefined, 80)).toBe('Meta: 80% 1RM')
    })

    it('combines both when present', () => {
        expect(buildWeightMetaLabel(80, 75)).toBe('Meta: 80 kg (75% 1RM)')
        expect(buildWeightMetaLabel(22.5, 60)).toBe('Meta: 22.5 kg (60% 1RM)')
    })
})

describe('expandSchemeByRounds', () => {
    it('returns a copy unchanged when rounds <= 1 (linear methods)', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '12', rest_seconds: 90 }),
            sampleSet({ set_number: 2, reps: '10', rest_seconds: 90 }),
        ]
        const out = expandSchemeByRounds(perRound, 1)
        expect(out).toHaveLength(2)
        expect(out.map((s) => s.set_number)).toEqual([1, 2])
        // round_number should remain unset (legacy semantic)
        expect(out.every((s) => s.round_number === undefined || s.round_number === null)).toBe(true)
    })

    it('repeats the per-round scheme N times with sequential set_numbers and round tags', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '10', set_type: 'normal' }),
            sampleSet({ set_number: 2, reps: '8', set_type: 'drop' }),
            sampleSet({ set_number: 3, reps: '8', set_type: 'drop' }),
        ]
        const out = expandSchemeByRounds(perRound, 3)
        expect(out).toHaveLength(9)
        expect(out.map((s) => s.set_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        expect(out.map((s) => s.round_number)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
        // Phase shape preserved per round
        expect(out[0].set_type).toBe('normal')
        expect(out[1].set_type).toBe('drop')
        expect(out[3].reps).toBe('10')
        expect(out[4].reps).toBe('8')
    })

    it('clamps absurd round counts to 1..20', () => {
        const scheme = [sampleSet({ set_number: 1, reps: '5' })]
        expect(expandSchemeByRounds(scheme, 0)).toHaveLength(1)
        expect(expandSchemeByRounds(scheme, -3)).toHaveLength(1)
        expect(expandSchemeByRounds(scheme, 999)).toHaveLength(20)
    })

    it('returns empty array for empty input', () => {
        expect(expandSchemeByRounds([], 5)).toEqual([])
    })
})

describe('deriveRoundAndPhase', () => {
    it('maps set_number → { round, phase } for compound layouts', () => {
        // 3 phases per round
        expect(deriveRoundAndPhase(1, 3)).toEqual({ round: 1, phase: 1 })
        expect(deriveRoundAndPhase(3, 3)).toEqual({ round: 1, phase: 3 })
        expect(deriveRoundAndPhase(4, 3)).toEqual({ round: 2, phase: 1 })
        expect(deriveRoundAndPhase(9, 3)).toEqual({ round: 3, phase: 3 })
    })

    it('falls back to round 1 when phasesPerRound is invalid', () => {
        expect(deriveRoundAndPhase(5, 0)).toEqual({ round: 1, phase: 5 })
        expect(deriveRoundAndPhase(5, -1)).toEqual({ round: 1, phase: 5 })
    })

    it('handles single-phase rounds (each set is its own round)', () => {
        expect(deriveRoundAndPhase(1, 1)).toEqual({ round: 1, phase: 1 })
        expect(deriveRoundAndPhase(2, 1)).toEqual({ round: 2, phase: 1 })
        expect(deriveRoundAndPhase(5, 1)).toEqual({ round: 5, phase: 1 })
    })
})

describe('summarizeWithRounds', () => {
    it('falls back to summarizeSetScheme behaviour when rounds <= 1', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '12', rest_seconds: 90 }),
            sampleSet({ set_number: 2, reps: '10', rest_seconds: 90 }),
        ]
        const out = summarizeWithRounds(perRound, 1)
        expect(out.sets).toBe(2)
        expect(out.reps).toBe('12-10')
    })

    it('formats reps as "Nx phaseA/phaseB/..." for compound methods', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '10', rest_seconds: 0 }),
            sampleSet({ set_number: 2, reps: '8', rest_seconds: 0 }),
            sampleSet({ set_number: 3, reps: '8', rest_seconds: 0 }),
        ]
        const out = summarizeWithRounds(perRound, 3)
        expect(out.sets).toBe(9) // 3 rounds × 3 phases
        expect(out.reps).toBe('3× 10/8/8')
        expect(out.rest_seconds).toBe(0)
    })

    it('uses the inner micro-rest of the first phase for compound methods', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '8', rest_seconds: 15 }),
            sampleSet({ set_number: 2, reps: '4', rest_seconds: 15 }),
            sampleSet({ set_number: 3, reps: '2', rest_seconds: 180 }),
        ]
        const out = summarizeWithRounds(perRound, 3)
        expect(out.rest_seconds).toBe(15)
        expect(out.sets).toBe(9)
        expect(out.reps).toBe('3× 8/4/2')
    })

    it('throws on empty input', () => {
        expect(() => summarizeWithRounds([], 3)).toThrow()
    })
})

describe('collapseExpandedScheme', () => {
    it('returns the input flat when rounds <= 1 (linear methods)', () => {
        const flat = [
            sampleSet({ set_number: 1, reps: '12' }),
            sampleSet({ set_number: 2, reps: '10' }),
            sampleSet({ set_number: 3, reps: '8' }),
        ]
        const out = collapseExpandedScheme(flat, 1)
        expect(out.rounds).toBe(1)
        expect(out.scheme).toHaveLength(3)
        expect(out.scheme.map((s) => s.reps)).toEqual(['12', '10', '8'])
    })

    it('reconstructs the per-round scheme from a materialized array', () => {
        const expanded = expandSchemeByRounds(
            [
                sampleSet({ set_number: 1, reps: '10', set_type: 'normal' }),
                sampleSet({ set_number: 2, reps: '8', set_type: 'drop' }),
                sampleSet({ set_number: 3, reps: '8', set_type: 'drop' }),
            ],
            3,
        )
        expect(expanded).toHaveLength(9)
        const out = collapseExpandedScheme(expanded, 3)
        expect(out.rounds).toBe(3)
        expect(out.scheme).toHaveLength(3)
        expect(out.scheme.map((s) => s.set_number)).toEqual([1, 2, 3])
        expect(out.scheme.map((s) => s.reps)).toEqual(['10', '8', '8'])
        expect(out.scheme.map((s) => s.set_type)).toEqual(['normal', 'drop', 'drop'])
        // round_number is reset to null in the per-round shape (UI doesn't
        // need it; the rounds count is the source of truth in the editor).
        expect(out.scheme.every((s) => s.round_number === null)).toBe(true)
    })

    it('roundtrip: expand → collapse equals the original per-round structure', () => {
        const perRound = [
            sampleSet({ set_number: 1, reps: '12', rest_seconds: 90 }),
            sampleSet({ set_number: 2, reps: '10', rest_seconds: 90 }),
        ]
        const out = collapseExpandedScheme(expandSchemeByRounds(perRound, 4), 4)
        expect(out.rounds).toBe(4)
        expect(out.scheme).toHaveLength(2)
        expect(out.scheme.map((s) => s.reps)).toEqual(['12', '10'])
        expect(out.scheme.map((s) => s.rest_seconds)).toEqual([90, 90])
    })

    it('falls back to flat when the materialization is inconsistent', () => {
        // 5 rows tagged for 3 rounds is impossible (5/3 is not integer).
        const inconsistent = [
            sampleSet({ set_number: 1, reps: '10' }),
            sampleSet({ set_number: 2, reps: '10' }),
            sampleSet({ set_number: 3, reps: '10' }),
            sampleSet({ set_number: 4, reps: '10' }),
            sampleSet({ set_number: 5, reps: '10' }),
        ]
        const out = collapseExpandedScheme(inconsistent, 3)
        expect(out.rounds).toBe(1)
        expect(out.scheme).toHaveLength(5)
    })

    it('handles null/undefined safely', () => {
        expect(collapseExpandedScheme(null, 3)).toEqual({ scheme: [], rounds: 1 })
        expect(collapseExpandedScheme(undefined, null)).toEqual({ scheme: [], rounds: 1 })
        expect(collapseExpandedScheme([], 5)).toEqual({ scheme: [], rounds: 1 })
    })
})
