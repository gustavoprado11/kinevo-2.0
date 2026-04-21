import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    assignFromSnapshot,
    GenerationNotFoundError,
    GenerationAlreadyApprovedError,
    GenerationSnapshotMissingError,
    GenerationSnapshotAllItemsInvalidError,
} from '../assign-from-snapshot'

const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'
const GENERATION_ID = '19957cce-ca65-42fb-a765-d40e83aae8f1'

function makeSnapshot(overrides: Partial<{ workouts: unknown[]; program: unknown }> = {}): Record<string, unknown> {
    return {
        program: overrides.program ?? {
            name: 'Programa Hipertrofia Intermediário 5x Semana',
            description: 'Programa de hipertrofia para aluno intermediário.',
            duration_weeks: 8,
        },
        workouts: overrides.workouts ?? [
            {
                name: 'Push',
                order_index: 1,
                scheduled_days: [1, 4],
                items: [
                    {
                        item_type: 'exercise',
                        order_index: 0,
                        exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784',
                        exercise_name: 'Supino Reto com Barra',
                        exercise_muscle_group: 'Peito',
                        exercise_equipment: 'barbell',
                        exercise_function: 'main',
                        sets: 4,
                        reps: '8-12',
                        rest_seconds: 90,
                        notes: 'Composto principal',
                        substitute_exercise_ids: ['f86432d8-1959-4a15-9444-835cf0c91f51'],
                    },
                    {
                        item_type: 'exercise',
                        order_index: 1,
                        exercise_id: '651231b1-48d9-4013-b537-cdc7c15a3e7c',
                        exercise_name: 'Supino Inclinado com Halteres',
                        exercise_muscle_group: 'Peito',
                        exercise_equipment: 'dumbbell',
                        exercise_function: 'accessory',
                        sets: 3,
                        reps: '10-12',
                        rest_seconds: 60,
                        notes: null,
                    },
                ],
            },
            {
                name: 'Pull',
                order_index: 2,
                scheduled_days: [2, 5],
                items: [
                    {
                        item_type: 'exercise',
                        order_index: 0,
                        exercise_id: '517b6e4a-362d-4f6c-9ddf-5565f9b0e24c',
                        exercise_name: 'Remada Curvada',
                        exercise_muscle_group: 'Costas',
                        exercise_equipment: 'barbell',
                        exercise_function: 'main',
                        sets: 4,
                        reps: '8-12',
                        rest_seconds: 90,
                        notes: null,
                    },
                ],
            },
        ],
    }
}

/** Builds a `data` list for the `exercises` pool lookup marking every
 *  snapshot exercise_id as valid (system-owned). */
function allSnapshotExercisesValid(snapshot: ReturnType<typeof makeSnapshot>): Array<{ id: string; owner_id: null }> {
    const ids = new Set<string>()
    const workouts = (snapshot.workouts as Array<{ items: Array<{ exercise_id?: string }> }>) ?? []
    for (const wk of workouts) {
        for (const it of wk.items ?? []) {
            if (typeof it.exercise_id === 'string') ids.add(it.exercise_id)
        }
    }
    return Array.from(ids).map((id) => ({ id, owner_id: null }))
}

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------
//
// The helper issues these calls in order (happy path, isScheduled=false):
//   1) from('prescription_generations').select().eq(id).eq(trainerId).eq(studentId).single()
//   2) from('assigned_programs').update({status:'completed',...}).eq(student_id).in('status', [...])
//   3) from('assigned_programs').insert({...}).select('id').single()
//   4) for each workout: from('assigned_workouts').insert({...}).select('id').single()
//   5) for each item:    from('assigned_workout_items').insert({...})
//   6) from('prescription_generations').update({status:'approved',...}).eq(id)
//
// The mock uses an outcome script per table. Each table call consumes the
// next scripted outcome; builders capture what was passed to `.insert`/`.update`
// so assertions can introspect.

interface TableScript {
    /** Ordered list of responses. */
    selectSingle?: Array<{ data: unknown; error?: unknown }>
    /** For `.select(...).in(...)` list queries (e.g. exercises pool check). */
    selectList?: Array<{ data: unknown[] | null; error?: unknown }>
    insertSingle?: Array<{ data: unknown; error?: unknown }>
    insertNoReturn?: Array<{ error?: unknown }>
    updateNoReturn?: Array<{ error?: unknown }>
    deleteNoReturn?: Array<{ error?: unknown }>
}

interface MockCapture {
    inserts: Record<string, unknown[]>
    updates: Record<string, unknown[]>
    deletes: Record<string, Array<Record<string, unknown>>>
}

function makeSupabase(script: Record<string, TableScript>): { client: any; capture: MockCapture } {
    const capture: MockCapture = { inserts: {}, updates: {}, deletes: {} }
    const indexes = new Map<string, number>()

    const nextIndex = (key: string) => {
        const i = indexes.get(key) ?? 0
        indexes.set(key, i + 1)
        return i
    }

    const client = {
        from(table: string) {
            const t = script[table] ?? {}

            return {
                select: (_cols: string) => ({
                    eq: function chain(): any {
                        return {
                            eq: chain,
                            in: chain,
                            single: () => {
                                const i = nextIndex(`${table}:selectSingle`)
                                return Promise.resolve(t.selectSingle?.[i] ?? { data: null, error: null })
                            },
                        }
                    },
                    // .select(...).in(...) → list response (pool lookup)
                    in: (_col: string, _values: unknown[]) => {
                        const i = nextIndex(`${table}:selectList`)
                        return Promise.resolve(t.selectList?.[i] ?? { data: [], error: null })
                    },
                }),
                insert: (payload: unknown) => {
                    const list = capture.inserts[table] ?? (capture.inserts[table] = [])
                    list.push(payload)

                    return {
                        select: (_cols: string) => ({
                            single: () => {
                                const i = nextIndex(`${table}:insertSingle`)
                                return Promise.resolve(t.insertSingle?.[i] ?? { data: null, error: null })
                            },
                        }),
                        // Fire-and-forget insert (items) resolves to { error? }.
                        then: (resolve: any) => {
                            const i = nextIndex(`${table}:insertNoReturn`)
                            return Promise.resolve(t.insertNoReturn?.[i] ?? { error: null }).then(resolve)
                        },
                    }
                },
                update: (payload: Record<string, unknown>) => {
                    const list = capture.updates[table] ?? (capture.updates[table] = [])
                    list.push(payload)

                    return {
                        eq: function chain(): any {
                            return {
                                eq: chain,
                                in: chain,
                                then: (resolve: any) => {
                                    const i = nextIndex(`${table}:updateNoReturn`)
                                    return Promise.resolve(t.updateNoReturn?.[i] ?? { error: null }).then(resolve)
                                },
                            }
                        },
                    }
                },
                delete: () => ({
                    eq: (_col: string, val: unknown) => {
                        const list = capture.deletes[table] ?? (capture.deletes[table] = [])
                        list.push({ val })
                        const i = nextIndex(`${table}:deleteNoReturn`)
                        return Promise.resolve(t.deleteNoReturn?.[i] ?? { error: null })
                    },
                }),
            }
        },
    }

    return { client, capture }
}

function baseInput(overrides: Partial<Parameters<typeof assignFromSnapshot>[1]> = {}) {
    return {
        generationId: GENERATION_ID,
        trainerId: TRAINER_ID,
        studentId: STUDENT_ID,
        startDate: null,
        isScheduled: false,
        ...overrides,
    }
}

describe('assignFromSnapshot', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('happy path: inserts program + 2 workouts + 3 items, marks generation approved', async () => {
        const snapshot = makeSnapshot()
        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [
                    { data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot, student_id: STUDENT_ID, trainer_id: TRAINER_ID }, error: null },
                ],
            },
            exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            assigned_programs: {
                insertSingle: [{ data: { id: 'new-program-id' }, error: null }],
            },
            assigned_workouts: {
                insertSingle: [
                    { data: { id: 'wk-1' }, error: null },
                    { data: { id: 'wk-2' }, error: null },
                ],
            },
        })

        const result = await assignFromSnapshot(client, baseInput())

        expect(result).toEqual({ programId: 'new-program-id' })

        // Program insert shape
        expect(capture.inserts.assigned_programs).toHaveLength(1)
        expect(capture.inserts.assigned_programs[0]).toMatchObject({
            student_id: STUDENT_ID,
            trainer_id: TRAINER_ID,
            source_template_id: null,
            ai_generated: true,
            prescription_generation_id: GENERATION_ID,
            name: 'Programa Hipertrofia Intermediário 5x Semana',
            duration_weeks: 8,
            status: 'active',
            current_week: 1,
        })

        // 2 workouts inserted
        expect(capture.inserts.assigned_workouts).toHaveLength(2)
        expect(capture.inserts.assigned_workouts[0]).toMatchObject({
            assigned_program_id: 'new-program-id',
            name: 'Push',
            order_index: 1,
            scheduled_days: [1, 4],
        })

        // 3 items total (2 + 1)
        expect(capture.inserts.assigned_workout_items).toHaveLength(3)
        expect(capture.inserts.assigned_workout_items[0]).toMatchObject({
            assigned_workout_id: 'wk-1',
            item_type: 'exercise',
            exercise_name: 'Supino Reto com Barra',
            substitute_exercise_ids: ['f86432d8-1959-4a15-9444-835cf0c91f51'],
            item_config: {},
            parent_item_id: null,
        })

        // Generation marked approved
        expect(capture.updates.prescription_generations).toHaveLength(1)
        expect(capture.updates.prescription_generations[0]).toMatchObject({
            status: 'approved',
            assigned_program_id: 'new-program-id',
        })
    })

    it('throws GenerationNotFoundError when fetch returns null', async () => {
        const { client, capture } = makeSupabase({
            prescription_generations: { selectSingle: [{ data: null, error: null }] },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationNotFoundError)
        expect(capture.inserts.assigned_programs).toBeUndefined()
    })

    it('throws GenerationAlreadyApprovedError when status is already approved', async () => {
        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'approved', output_snapshot: makeSnapshot() }, error: null }],
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationAlreadyApprovedError)
        expect(capture.inserts.assigned_programs).toBeUndefined()
    })

    it('throws GenerationSnapshotMissingError when output_snapshot is null', async () => {
        const { client } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: null }, error: null }],
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationSnapshotMissingError)
    })

    it('throws GenerationSnapshotMissingError when snapshot.program.name is missing', async () => {
        const badSnapshot = makeSnapshot({ program: { description: 'no name', duration_weeks: 4 } })
        const { client } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: badSnapshot }, error: null }],
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationSnapshotMissingError)
    })

    it('student_id mismatch does not leak via error type (also GenerationNotFoundError)', async () => {
        // Triple-filter in the helper means fetch returns null. Indistinguishable
        // from "generation does not exist at all", by design (no info leak).
        const { client } = makeSupabase({
            prescription_generations: { selectSingle: [{ data: null, error: null }] },
        })

        await expect(
            assignFromSnapshot(client, baseInput({ studentId: '00000000-0000-4000-8000-000000000000' })),
        ).rejects.toBeInstanceOf(GenerationNotFoundError)
    })

    it('isScheduled=false replaces active program; isScheduled=true does not', async () => {
        // Use a minimal valid snapshot (1 workout, 1 item). Fully empty snapshots
        // now abort with GenerationSnapshotAllItemsInvalidError.
        const snapshot = makeSnapshot({
            workouts: [
                {
                    name: 'W',
                    order_index: 1,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'exercise',
                            order_index: 0,
                            exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784',
                            exercise_name: 'Supino',
                            exercise_muscle_group: 'Peito',
                            exercise_equipment: 'barbell',
                            exercise_function: 'main',
                            sets: 4,
                            reps: '8-12',
                            rest_seconds: 90,
                            notes: null,
                        },
                    ],
                },
            ],
        })
        const validExercisesList = allSnapshotExercisesValid(snapshot)

        // Case A: immediate → update ran.
        const a = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            exercises: { selectList: [{ data: validExercisesList, error: null }] },
            assigned_programs: { insertSingle: [{ data: { id: 'p1' }, error: null }] },
            assigned_workouts: { insertSingle: [{ data: { id: 'wk-a' }, error: null }] },
        })
        await assignFromSnapshot(a.client, baseInput({ isScheduled: false }))
        expect(a.capture.updates.assigned_programs).toHaveLength(1)
        expect(a.capture.updates.assigned_programs[0]).toMatchObject({ status: 'completed' })

        // Case B: scheduled → no update.
        const b = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            exercises: { selectList: [{ data: validExercisesList, error: null }] },
            assigned_programs: { insertSingle: [{ data: { id: 'p2' }, error: null }] },
            assigned_workouts: { insertSingle: [{ data: { id: 'wk-b' }, error: null }] },
        })
        await assignFromSnapshot(b.client, baseInput({ isScheduled: true, startDate: '2026-05-01T00:00:00Z' }))
        expect(b.capture.updates.assigned_programs).toBeUndefined()
        expect(b.capture.inserts.assigned_programs[0]).toMatchObject({
            status: 'scheduled',
            scheduled_start_date: '2026-05-01T00:00:00Z',
            started_at: null,
        })
    })

    it('filters invalid UUIDs from substitute_exercise_ids and logs warn', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const snapshot = makeSnapshot({
            workouts: [
                {
                    name: 'Solo',
                    order_index: 1,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'exercise',
                            order_index: 0,
                            exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784',
                            exercise_name: 'Supino',
                            exercise_muscle_group: 'Peito',
                            exercise_equipment: 'barbell',
                            exercise_function: 'main',
                            sets: 4,
                            reps: '8-12',
                            rest_seconds: 90,
                            notes: null,
                            substitute_exercise_ids: [
                                'afbc035fc06b', // truncated (12 chars) — mirrors the prod bug from 19957cce
                                'fa921fca-3f70-4d8c-803a-2f30a03d3784', // valid
                                '', // empty string
                                null, // non-string
                                'not-a-uuid', // word string
                            ] as unknown as string[],
                        },
                    ],
                },
            ],
        })

        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [
                    {
                        data: {
                            id: GENERATION_ID,
                            status: 'pending_review',
                            output_snapshot: snapshot,
                        },
                        error: null,
                    },
                ],
            },
            exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            assigned_programs: { insertSingle: [{ data: { id: 'p-sanitized' }, error: null }] },
            assigned_workouts: { insertSingle: [{ data: { id: 'wk-sanitized' }, error: null }] },
        })

        const result = await assignFromSnapshot(client, baseInput())
        expect(result).toEqual({ programId: 'p-sanitized' })

        expect(capture.inserts.assigned_workout_items).toHaveLength(1)
        expect(capture.inserts.assigned_workout_items[0]).toMatchObject({
            substitute_exercise_ids: ['fa921fca-3f70-4d8c-803a-2f30a03d3784'],
        })

        // warnSpy may include "ghost" filter warns too if any item_id was not
        // in the pool, but in this test every exercise_id is valid, so only
        // the substitute-filter warn should fire.
        const substituteWarns = warnSpy.mock.calls.filter(
            (c) => c[0] === '[assignFromSnapshot] dropping invalid substitute_exercise_ids',
        )
        expect(substituteWarns).toHaveLength(1)
        expect(warnSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] dropping invalid substitute_exercise_ids',
            expect.objectContaining({
                generationId: GENERATION_ID,
                workoutOrderIndex: 1,
                itemOrderIndex: 0,
                dropped: ['afbc035fc06b', '', null, 'not-a-uuid'],
                kept: 1,
            }),
        )
    })

    it('drops items whose exercise_id is not in the trainer pool, keeps the rest', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const snapshot = makeSnapshot({
            workouts: [
                {
                    name: 'Mixed',
                    order_index: 1,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'exercise',
                            order_index: 0,
                            exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', // valid
                            exercise_name: 'Supino',
                            exercise_muscle_group: 'Peito',
                            exercise_equipment: 'barbell',
                            exercise_function: 'main',
                            sets: 4, reps: '8-12', rest_seconds: 90, notes: null,
                        },
                        {
                            item_type: 'exercise',
                            order_index: 1,
                            exercise_id: '55d7bfaf-a87f-4d25-ab90-d0a9ff656e1e', // ghost
                            exercise_name: 'Exercício desconhecido',
                            exercise_muscle_group: null,
                            exercise_equipment: null,
                            exercise_function: 'accessory',
                            sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        },
                    ],
                },
            ],
        })

        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            // Pool returns only the first id (ghost id is absent).
            exercises: { selectList: [{ data: [{ id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', owner_id: null }], error: null }] },
            assigned_programs: { insertSingle: [{ data: { id: 'p-mixed' }, error: null }] },
            assigned_workouts: { insertSingle: [{ data: { id: 'wk-mixed' }, error: null }] },
        })

        const result = await assignFromSnapshot(client, baseInput())
        expect(result).toEqual({ programId: 'p-mixed' })

        // Only the valid item is inserted.
        expect(capture.inserts.assigned_workout_items).toHaveLength(1)
        expect(capture.inserts.assigned_workout_items[0]).toMatchObject({
            exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784',
        })

        expect(warnSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] dropping items with ghost exercise_id',
            expect.objectContaining({
                generationId: GENERATION_ID,
                workoutOrderIndex: 1,
                droppedExerciseIds: ['55d7bfaf-a87f-4d25-ab90-d0a9ff656e1e'],
                kept: 1,
            }),
        )
    })

    it('drops entire workout when all items are ghost, keeps other workouts', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const snapshot = makeSnapshot({
            workouts: [
                {
                    name: 'GoodOne',
                    order_index: 1,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'exercise', order_index: 0,
                            exercise_id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', // valid
                            exercise_name: 'Supino', exercise_muscle_group: 'Peito',
                            exercise_equipment: 'barbell', exercise_function: 'main',
                            sets: 4, reps: '8-12', rest_seconds: 90, notes: null,
                        },
                    ],
                },
                {
                    name: 'AllGhosts',
                    order_index: 2,
                    scheduled_days: [2],
                    items: [
                        {
                            item_type: 'exercise', order_index: 0,
                            exercise_id: '00000000-0000-4000-8000-000000000001', // ghost
                            exercise_name: 'Exercício desconhecido',
                            exercise_muscle_group: null, exercise_equipment: null,
                            exercise_function: 'accessory',
                            sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        },
                    ],
                },
            ],
        })

        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            // Pool returns only the first id; second workout's only item is ghost.
            exercises: { selectList: [{ data: [{ id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', owner_id: null }], error: null }] },
            assigned_programs: { insertSingle: [{ data: { id: 'p-dropped' }, error: null }] },
            assigned_workouts: { insertSingle: [{ data: { id: 'wk-good' }, error: null }] },
        })

        await assignFromSnapshot(client, baseInput())

        // Only one workout inserted.
        expect(capture.inserts.assigned_workouts).toHaveLength(1)
        expect(capture.inserts.assigned_workouts[0]).toMatchObject({ name: 'GoodOne' })

        expect(warnSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] dropping entire workout (no valid items)',
            expect.objectContaining({
                generationId: GENERATION_ID,
                workoutOrderIndex: 2,
                originalItemCount: 1,
            }),
        )
    })

    it('throws GenerationSnapshotAllItemsInvalidError when all items are ghost across all workouts', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const snapshot = makeSnapshot({
            workouts: [
                {
                    name: 'GhostWk',
                    order_index: 1,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'exercise', order_index: 0,
                            exercise_id: '00000000-0000-4000-8000-000000000001',
                            exercise_name: 'Exercício desconhecido',
                            exercise_muscle_group: null, exercise_equipment: null,
                            exercise_function: 'main',
                            sets: 4, reps: '8-12', rest_seconds: 90, notes: null,
                        },
                    ],
                },
            ],
        })

        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            exercises: { selectList: [{ data: [], error: null }] }, // pool empty / no matches
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(
            GenerationSnapshotAllItemsInvalidError,
        )
        // Abort happens before any write.
        expect(capture.inserts.assigned_programs).toBeUndefined()
        expect(warnSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] aborting: snapshot has zero valid items across all workouts',
            expect.objectContaining({ generationId: GENERATION_ID }),
        )
    })

    it('rolls back assigned_programs when a workout insert fails', async () => {
        const snapshot = makeSnapshot()
        const { client, capture } = makeSupabase({
            prescription_generations: {
                selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
            },
            exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            assigned_programs: {
                insertSingle: [{ data: { id: 'rollback-target' }, error: null }],
            },
            assigned_workouts: {
                insertSingle: [{ data: null, error: { message: 'boom' } }],
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toMatchObject({ message: 'boom' })
        expect(capture.deletes.assigned_programs).toEqual([{ val: 'rollback-target' }])
    })
})
