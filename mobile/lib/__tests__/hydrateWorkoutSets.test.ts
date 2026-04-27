import { describe, it, expect } from 'vitest'
import { hydrateSetPrescriptions } from '../hydrateWorkoutSets'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'

const buildSet = (n: number, type: WorkoutSet['set_type'], reps: string, rest: number): WorkoutSet => ({
    set_number: n,
    set_type: type,
    reps,
    rest_seconds: rest,
    weight_target_kg: null,
    weight_target_pct1rm: null,
    rir: null,
    tempo: null,
    notes: null,
})

describe('hydrateSetPrescriptions', () => {
    it('uses assigned per-set rows when present, sorted by set_number', () => {
        const out = hydrateSetPrescriptions({
            assignedSets: [
                buildSet(3, 'normal', '8', 120),
                buildSet(1, 'normal', '12', 90),
                buildSet(2, 'normal', '10', 90),
            ],
            aggregateSets: 999,
            aggregateReps: 'fallback',
            aggregateRestSeconds: 999,
        })
        expect(out.map((s) => s.set_number)).toEqual([1, 2, 3])
        expect(out.map((s) => s.reps_target)).toEqual(['12', '10', '8'])
        expect(out.map((s) => s.rest_seconds)).toEqual([90, 90, 120])
    })

    it('falls back to N identical normal sets when assigned rows are empty', () => {
        const out = hydrateSetPrescriptions({
            assignedSets: [],
            aggregateSets: 4,
            aggregateReps: '10',
            aggregateRestSeconds: 60,
        })
        expect(out).toHaveLength(4)
        for (const s of out) {
            expect(s.set_type).toBe('normal')
            expect(s.reps_target).toBe('10')
            expect(s.rest_seconds).toBe(60)
            expect(s.weight_target_kg).toBeNull()
        }
    })

    it('falls back to aggregates when assignedSets is null/undefined', () => {
        const fromNull = hydrateSetPrescriptions({
            assignedSets: null,
            aggregateSets: 3,
            aggregateReps: '8-12',
            aggregateRestSeconds: 75,
        })
        const fromUndef = hydrateSetPrescriptions({
            assignedSets: undefined,
            aggregateSets: 3,
            aggregateReps: '8-12',
            aggregateRestSeconds: 75,
        })
        expect(fromNull).toHaveLength(3)
        expect(fromUndef).toHaveLength(3)
        expect(fromNull[0].reps_target).toBe('8-12')
    })

    it('returns empty array when there are zero aggregate sets and no rows', () => {
        const out = hydrateSetPrescriptions({
            assignedSets: null,
            aggregateSets: 0,
            aggregateReps: '',
            aggregateRestSeconds: 0,
        })
        expect(out).toEqual([])
    })

    it('preserves set_type for prescribed sets (drop / cluster / amrap)', () => {
        const out = hydrateSetPrescriptions({
            assignedSets: [
                buildSet(1, 'normal', '10', 0),
                buildSet(2, 'drop', '8', 0),
                buildSet(3, 'cluster', '5+5+5', 180),
                buildSet(4, 'amrap', 'AMRAP', 0),
            ],
            aggregateSets: 1,
            aggregateReps: '10',
            aggregateRestSeconds: 60,
        })
        expect(out.map((s) => s.set_type)).toEqual(['normal', 'drop', 'cluster', 'amrap'])
        expect(out[2].reps_target).toBe('5+5+5')
        expect(out[3].reps_target).toBe('AMRAP')
    })
})
