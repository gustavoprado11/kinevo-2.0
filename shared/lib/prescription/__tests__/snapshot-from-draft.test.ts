import { describe, it, expect } from 'vitest'
import { buildSnapshotFromDraft, SupersetInSnapshotError } from '../snapshot-from-draft'
import { mapAiOutputToBuilderData } from '../builder-mapper'
import type {
    PrescriptionOutputSnapshot,
    PrescriptionReasoning,
    ProgramDraftLike,
    ProgramDraftWorkoutItemLike,
} from '../../../types/prescription'

const EMPTY_REASONING: PrescriptionReasoning = {
    structure_rationale: '',
    volume_rationale: '',
    workout_notes: [],
    attention_flags: [],
    confidence_score: 0,
}

function makeItem(overrides: Partial<ProgramDraftWorkoutItemLike> = {}): ProgramDraftWorkoutItemLike {
    return {
        item_type: 'exercise',
        order_index: 0,
        parent_item_id: null,
        exercise_id: 'ex-1',
        exercise_name: 'Supino Reto',
        exercise_muscle_groups: ['Peitoral'],
        exercise_equipment: 'barbell',
        exercise_function: null,
        sets: 4,
        reps: '8-10',
        rest_seconds: 90,
        notes: null,
        substitute_exercise_ids: [],
        item_config: {},
        ...overrides,
    }
}

function makeDraft(overrides: Partial<ProgramDraftLike> = {}): ProgramDraftLike {
    return {
        name: 'Programa A',
        description: '',
        duration_weeks: 8,
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                frequency: ['mon', 'thu'],
                items: [makeItem()],
            },
        ],
        ...overrides,
    }
}

describe('buildSnapshotFromDraft', () => {
    it('serializes a regular draft into a PrescriptionOutputSnapshot', () => {
        const snap = buildSnapshotFromDraft(makeDraft())
        expect(snap.program.name).toBe('Programa A')
        expect(snap.program.duration_weeks).toBe(8)
        expect(snap.workouts).toHaveLength(1)
        const w = snap.workouts[0]
        expect(w.name).toBe('Treino A')
        expect(w.scheduled_days).toEqual([1, 4])
        expect(w.items).toHaveLength(1)
        const item = w.items[0]
        expect(item.exercise_id).toBe('ex-1')
        expect(item.sets).toBe(4)
        expect(item.reps).toBe('8-10')
        expect(item.rest_seconds).toBe(90)
        expect(item.exercise_muscle_group).toBe('Peitoral')
    })

    it('throws SupersetInSnapshotError when any item has parent_item_id', () => {
        const draft = makeDraft({
            workouts: [
                {
                    name: 'Treino A',
                    order_index: 0,
                    frequency: [],
                    items: [makeItem({ parent_item_id: 'some-parent-id' })],
                },
            ],
        })
        expect(() => buildSnapshotFromDraft(draft)).toThrow(SupersetInSnapshotError)
    })

    it('throws SupersetInSnapshotError when item_type is superset (parent)', () => {
        const draft = makeDraft({
            workouts: [
                {
                    name: 'Treino A',
                    order_index: 0,
                    frequency: [],
                    items: [makeItem({ item_type: 'superset' })],
                },
            ],
        })
        expect(() => buildSnapshotFromDraft(draft)).toThrow(SupersetInSnapshotError)
    })

    it('reuses preserveReasoning when provided instead of the empty default', () => {
        const original: PrescriptionReasoning = {
            structure_rationale: 'Upper/Lower — 4 dias',
            volume_rationale: 'Hipertrofia, 12-15 séries por grupo',
            workout_notes: ['Treino A: peito + tríceps'],
            attention_flags: [],
            confidence_score: 0.82,
        }
        const snap = buildSnapshotFromDraft(makeDraft(), { preserveReasoning: original })
        expect(snap.reasoning).toEqual(original)
        expect(snap.reasoning.structure_rationale).toBe('Upper/Lower — 4 dias')
        expect(snap.reasoning.confidence_score).toBe(0.82)
    })

    it('falls back to empty reasoning when options is omitted', () => {
        const snap = buildSnapshotFromDraft(makeDraft())
        expect(snap.reasoning.structure_rationale).toBe('')
        expect(snap.reasoning.confidence_score).toBe(0)
    })

    it('emits scheduled_days: [] when frequency is empty', () => {
        const draft = makeDraft({
            workouts: [
                {
                    name: 'Treino A',
                    order_index: 0,
                    frequency: [],
                    items: [makeItem()],
                },
            ],
        })
        const snap = buildSnapshotFromDraft(draft)
        expect(snap.workouts[0].scheduled_days).toEqual([])
    })

    it('roundtrip without supersets preserves exercise_id, sets, reps, rest_seconds', () => {
        const original: PrescriptionOutputSnapshot = {
            program: { name: 'P', description: 'd', duration_weeks: 6 },
            workouts: [
                {
                    name: 'A',
                    order_index: 0,
                    scheduled_days: [1, 3, 5],
                    items: [
                        {
                            item_type: 'exercise',
                            order_index: 0,
                            exercise_id: 'ex-aaa',
                            exercise_name: 'Supino',
                            sets: 3,
                            reps: '10',
                            rest_seconds: 60,
                            notes: null,
                        },
                        {
                            item_type: 'exercise',
                            order_index: 1,
                            exercise_id: 'ex-bbb',
                            exercise_name: 'Remada',
                            sets: 4,
                            reps: '8',
                            rest_seconds: 75,
                            notes: 'foco no controle',
                        },
                    ],
                },
            ],
            reasoning: EMPTY_REASONING,
        }

        // 1) snapshot → builder data → draft-like
        const builder = mapAiOutputToBuilderData(original)
        const draft: ProgramDraftLike = {
            name: builder.name,
            description: builder.description ?? '',
            duration_weeks: builder.duration_weeks,
            workouts: (builder.workout_templates ?? []).map((w) => ({
                name: w.name,
                order_index: w.order_index,
                frequency: w.frequency ?? [],
                items: (w.workout_item_templates ?? []).map((it) => ({
                    item_type: 'exercise',
                    order_index: it.order_index,
                    parent_item_id: it.parent_item_id,
                    exercise_id: it.exercise_id ?? '',
                    exercise_name: '',
                    exercise_muscle_groups: [],
                    exercise_equipment: null,
                    exercise_function: it.exercise_function ?? null,
                    sets: it.sets ?? 0,
                    reps: it.reps ?? '',
                    rest_seconds: it.rest_seconds ?? 0,
                    notes: it.notes ?? null,
                    substitute_exercise_ids: it.substitute_exercise_ids ?? [],
                    item_config: it.item_config ?? {},
                })),
            })),
        }

        // 2) draft → snapshot
        const final = buildSnapshotFromDraft(draft)

        expect(final.program.name).toBe(original.program.name)
        expect(final.program.duration_weeks).toBe(original.program.duration_weeks)
        expect(final.workouts).toHaveLength(original.workouts.length)
        for (let i = 0; i < original.workouts.length; i++) {
            const o = original.workouts[i]
            const f = final.workouts[i]
            expect(f.name).toBe(o.name)
            expect(f.scheduled_days).toEqual(o.scheduled_days)
            expect(f.items).toHaveLength(o.items.length)
            for (let j = 0; j < o.items.length; j++) {
                expect(f.items[j].exercise_id).toBe(o.items[j].exercise_id)
                expect(f.items[j].sets).toBe(o.items[j].sets)
                expect(f.items[j].reps).toBe(o.items[j].reps)
                expect(f.items[j].rest_seconds).toBe(o.items[j].rest_seconds)
            }
        }
    })
})
