import { describe, it, expect } from 'vitest'
import { mapAiOutputToBuilderData } from '../builder-mapper'
import type { PrescriptionOutputSnapshot, PrescriptionReasoning } from '../../../types/prescription'

const EMPTY_REASONING: PrescriptionReasoning = {
    structure_rationale: '',
    volume_rationale: '',
    workout_notes: [],
    attention_flags: [],
    confidence_score: 0,
}

function makeSnapshot(overrides: Partial<PrescriptionOutputSnapshot> = {}): PrescriptionOutputSnapshot {
    return {
        program: {
            name: 'Programa de Hipertrofia',
            description: 'Foco em peito e costas',
            duration_weeks: 8,
        },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 4],
                items: [
                    {
                        item_type: 'exercise',
                        order_index: 0,
                        exercise_id: 'ex-1',
                        exercise_name: 'Supino Reto',
                        sets: 4,
                        reps: '8-10',
                        rest_seconds: 90,
                        notes: null,
                    },
                ],
            },
        ],
        reasoning: EMPTY_REASONING,
        ...overrides,
    }
}

describe('mapAiOutputToBuilderData', () => {
    it('maps a snapshot with 1 workout', () => {
        const out = mapAiOutputToBuilderData(makeSnapshot())
        expect(out.name).toBe('Programa de Hipertrofia')
        expect(out.duration_weeks).toBe(8)
        expect(out.workout_templates).toHaveLength(1)
        const w = out.workout_templates![0]
        expect(w.name).toBe('Treino A')
        expect(w.frequency).toEqual(['mon', 'thu'])
        expect(w.workout_item_templates).toHaveLength(1)
        const item = w.workout_item_templates![0]
        expect(item.exercise_id).toBe('ex-1')
        expect(item.sets).toBe(4)
        expect(item.reps).toBe('8-10')
        expect(item.rest_seconds).toBe(90)
    })

    it('maps a snapshot with 3 workouts preserving order', () => {
        const snap = makeSnapshot({
            workouts: [
                { name: 'A', order_index: 0, scheduled_days: [1], items: [] },
                { name: 'B', order_index: 1, scheduled_days: [3], items: [] },
                { name: 'C', order_index: 2, scheduled_days: [5], items: [] },
            ],
        })
        const out = mapAiOutputToBuilderData(snap)
        expect(out.workout_templates).toHaveLength(3)
        expect(out.workout_templates!.map((w) => w.name)).toEqual(['A', 'B', 'C'])
        expect(out.workout_templates!.map((w) => w.order_index)).toEqual([0, 1, 2])
    })

    it('handles snapshot with duration_weeks=0 (treated as null in builder)', () => {
        const snap = makeSnapshot()
        snap.program.duration_weeks = 0
        const out = mapAiOutputToBuilderData(snap)
        // duration_weeks comes through as-is from snapshot.program.duration_weeks
        expect(out.duration_weeks).toBe(0)
    })

    it('does not require reasoning to be populated', () => {
        const snap = makeSnapshot({
            reasoning: { ...EMPTY_REASONING, structure_rationale: '' },
        })
        const out = mapAiOutputToBuilderData(snap)
        // mapper does not look at reasoning; should not throw
        expect(out.workout_templates).toBeDefined()
    })

    it('generates IDs prefixed with temp_ for program/workout/item', () => {
        const out = mapAiOutputToBuilderData(makeSnapshot())
        expect(out.id.startsWith('temp_')).toBe(true)
        expect(out.workout_templates![0].id.startsWith('temp_')).toBe(true)
        expect(out.workout_templates![0].workout_item_templates![0].id.startsWith('temp_')).toBe(true)
    })
})
