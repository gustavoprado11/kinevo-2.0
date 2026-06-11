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
// The helper issues these calls in order (happy path):
//   1) from('prescription_generations').select().eq(id).eq(trainerId).eq(studentId).single()
//   2) from('exercises').select('id, owner_id').in('id', [...])  — catalog pool
//   3) rpc('assign_program_from_snapshot', { ...filtered snapshot... })
//
// All writes (complete current program, insert program/workouts/items,
// approve generation) live inside the RPC (migration 188) — the mock only
// needs to script the two reads and the rpc outcome. `capture.rpcCalls`
// records every rpc invocation for payload assertions.

interface TableScript {
    /** Ordered list of responses for `.select(...).eq(...).single()`. */
    selectSingle?: Array<{ data: unknown; error?: unknown }>
    /** For `.select(...).in(...)` list queries (e.g. exercises pool check). */
    selectList?: Array<{ data: unknown[] | null; error?: unknown }>
}

interface MockScript {
    tables?: Record<string, TableScript>
    /** Ordered list of rpc outcomes. Defaults to `{ data: 'rpc-program-id', error: null }`. */
    rpc?: Array<{ data: unknown; error?: { message: string } | null }>
}

interface MockCapture {
    rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>
}

function makeSupabase(script: MockScript): { client: any; capture: MockCapture } {
    const capture: MockCapture = { rpcCalls: [] }
    const indexes = new Map<string, number>()

    const nextIndex = (key: string) => {
        const i = indexes.get(key) ?? 0
        indexes.set(key, i + 1)
        return i
    }

    const client = {
        from(table: string) {
            const t = script.tables?.[table] ?? {}

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
            }
        },
        rpc(fn: string, args: Record<string, unknown>) {
            capture.rpcCalls.push({ fn, args })
            const i = nextIndex('rpc')
            return Promise.resolve(script.rpc?.[i] ?? { data: 'rpc-program-id', error: null })
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

    it('happy path: calls the transactional RPC with program + 2 workouts + 3 items', async () => {
        const snapshot = makeSnapshot()
        const { client, capture } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [
                        { data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot, student_id: STUDENT_ID, trainer_id: TRAINER_ID }, error: null },
                    ],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
            rpc: [{ data: 'new-program-id', error: null }],
        })

        const result = await assignFromSnapshot(client, baseInput())

        expect(result).toEqual({ programId: 'new-program-id' })

        expect(capture.rpcCalls).toHaveLength(1)
        const { fn, args } = capture.rpcCalls[0]
        expect(fn).toBe('assign_program_from_snapshot')
        expect(args).toMatchObject({
            p_generation_id: GENERATION_ID,
            p_trainer_id: TRAINER_ID,
            p_student_id: STUDENT_ID,
            p_is_scheduled: false,
            p_start_date: null,
            p_bump_edits: false,
        })

        const payload = args.p_snapshot as {
            program: Record<string, unknown>
            workouts: Array<{ name: string; order_index: number; scheduled_days: number[]; items: Array<Record<string, unknown>> }>
        }
        expect(payload.program).toEqual({
            name: 'Programa Hipertrofia Intermediário 5x Semana',
            description: 'Programa de hipertrofia para aluno intermediário.',
            duration_weeks: 8,
        })

        // 2 workouts, 3 items total (2 + 1), scheduled_days from the snapshot.
        expect(payload.workouts).toHaveLength(2)
        expect(payload.workouts[0]).toMatchObject({ name: 'Push', order_index: 1, scheduled_days: [1, 4] })
        expect(payload.workouts[1]).toMatchObject({ name: 'Pull', order_index: 2, scheduled_days: [2, 5] })
        expect(payload.workouts[0].items).toHaveLength(2)
        expect(payload.workouts[1].items).toHaveLength(1)
        expect(payload.workouts[0].items[0]).toEqual({
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
            item_config: {},
        })
    })

    it('throws GenerationNotFoundError when fetch returns null (no RPC call)', async () => {
        const { client, capture } = makeSupabase({
            tables: {
                prescription_generations: { selectSingle: [{ data: null, error: null }] },
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationNotFoundError)
        expect(capture.rpcCalls).toHaveLength(0)
    })

    it('throws GenerationAlreadyApprovedError when status is already approved (no RPC call)', async () => {
        const { client, capture } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'approved', output_snapshot: makeSnapshot() }, error: null }],
                },
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationAlreadyApprovedError)
        expect(capture.rpcCalls).toHaveLength(0)
    })

    it('throws GenerationSnapshotMissingError when output_snapshot is null', async () => {
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: null }, error: null }],
                },
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationSnapshotMissingError)
    })

    it('throws GenerationSnapshotMissingError when snapshot.program.name is missing', async () => {
        const badSnapshot = makeSnapshot({ program: { description: 'no name', duration_weeks: 4 } })
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: badSnapshot }, error: null }],
                },
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationSnapshotMissingError)
    })

    it('student_id mismatch does not leak via error type (also GenerationNotFoundError)', async () => {
        // Triple-filter in the helper means fetch returns null. Indistinguishable
        // from "generation does not exist at all", by design (no info leak).
        const { client } = makeSupabase({
            tables: {
                prescription_generations: { selectSingle: [{ data: null, error: null }] },
            },
        })

        await expect(
            assignFromSnapshot(client, baseInput({ studentId: '00000000-0000-4000-8000-000000000000' })),
        ).rejects.toBeInstanceOf(GenerationNotFoundError)
    })

    it('isScheduled=false sends p_start_date=null; isScheduled=true forwards the start date', async () => {
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

        // Case A: immediate → p_is_scheduled=false, p_start_date=null. The
        // "complete current program" UPDATE happens inside the RPC.
        const a = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: validExercisesList, error: null }] },
            },
            rpc: [{ data: 'p1', error: null }],
        })
        await assignFromSnapshot(a.client, baseInput({ isScheduled: false, startDate: '2026-05-01T00:00:00Z' }))
        expect(a.capture.rpcCalls[0].args).toMatchObject({
            p_is_scheduled: false,
            p_start_date: null,
        })

        // Case B: scheduled → p_is_scheduled=true with the start date.
        const b = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: validExercisesList, error: null }] },
            },
            rpc: [{ data: 'p2', error: null }],
        })
        await assignFromSnapshot(b.client, baseInput({ isScheduled: true, startDate: '2026-05-01T00:00:00Z' }))
        expect(b.capture.rpcCalls[0].args).toMatchObject({
            p_is_scheduled: true,
            p_start_date: '2026-05-01T00:00:00Z',
        })
    })

    it('workoutSchedule override replaces snapshot scheduled_days in the RPC payload', async () => {
        const snapshot = makeSnapshot()
        const { client, capture } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
        })

        await assignFromSnapshot(client, baseInput({ workoutSchedule: { 1: [0, 3] } }))

        const payload = capture.rpcCalls[0].args.p_snapshot as {
            workouts: Array<{ order_index: number; scheduled_days: number[] }>
        }
        // order_index 1 overridden; order_index 2 keeps the snapshot days.
        expect(payload.workouts[0]).toMatchObject({ order_index: 1, scheduled_days: [0, 3] })
        expect(payload.workouts[1]).toMatchObject({ order_index: 2, scheduled_days: [2, 5] })
    })

    it('editedSnapshot sets p_bump_edits=true', async () => {
        const snapshot = makeSnapshot()
        const { client, capture } = makeSupabase({
            tables: {
                prescription_generations: {
                    // editedSnapshot path still re-fetches for ownership/status.
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: null, trainer_edits_count: 2 }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
        })

        await assignFromSnapshot(client, baseInput({ editedSnapshot: snapshot as never }))

        expect(capture.rpcCalls[0].args).toMatchObject({ p_bump_edits: true })
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
            tables: {
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
            },
            rpc: [{ data: 'p-sanitized', error: null }],
        })

        const result = await assignFromSnapshot(client, baseInput())
        expect(result).toEqual({ programId: 'p-sanitized' })

        const payload = capture.rpcCalls[0].args.p_snapshot as {
            workouts: Array<{ items: Array<{ substitute_exercise_ids: string[] }> }>
        }
        expect(payload.workouts[0].items).toHaveLength(1)
        expect(payload.workouts[0].items[0]).toMatchObject({
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
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                // Pool returns only the first id (ghost id is absent).
                exercises: { selectList: [{ data: [{ id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', owner_id: null }], error: null }] },
            },
            rpc: [{ data: 'p-mixed', error: null }],
        })

        const result = await assignFromSnapshot(client, baseInput())
        expect(result).toEqual({ programId: 'p-mixed' })

        // Only the valid item makes it into the RPC payload.
        const payload = capture.rpcCalls[0].args.p_snapshot as {
            workouts: Array<{ items: Array<{ exercise_id: string }> }>
        }
        expect(payload.workouts[0].items).toHaveLength(1)
        expect(payload.workouts[0].items[0]).toMatchObject({
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
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                // Pool returns only the first id; second workout's only item is ghost.
                exercises: { selectList: [{ data: [{ id: 'fa921fca-3f70-4d8c-803a-2f30a03d3784', owner_id: null }], error: null }] },
            },
            rpc: [{ data: 'p-dropped', error: null }],
        })

        await assignFromSnapshot(client, baseInput())

        // Only one workout in the RPC payload.
        const payload = capture.rpcCalls[0].args.p_snapshot as {
            workouts: Array<{ name: string }>
        }
        expect(payload.workouts).toHaveLength(1)
        expect(payload.workouts[0]).toMatchObject({ name: 'GoodOne' })

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
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: [], error: null }] }, // pool empty / no matches
            },
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(
            GenerationSnapshotAllItemsInvalidError,
        )
        // Abort happens before any write.
        expect(capture.rpcCalls).toHaveLength(0)
        expect(warnSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] aborting: snapshot has zero valid items across all workouts',
            expect.objectContaining({ generationId: GENERATION_ID }),
        )
    })

    // -----------------------------------------------------------------------
    // RPC error mapping — stable messages raised inside migration 188 are
    // translated back to the typed errors the route handles. This covers the
    // race window between the TS pre-check and the locked re-check in the DB.
    // -----------------------------------------------------------------------

    it('maps RPC error generation_not_found to GenerationNotFoundError', async () => {
        const snapshot = makeSnapshot()
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
            rpc: [{ data: null, error: { message: 'generation_not_found' } }],
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationNotFoundError)
    })

    it('maps RPC error generation_already_approved to GenerationAlreadyApprovedError (double-tap race)', async () => {
        const snapshot = makeSnapshot()
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    // Pre-check passes (status still pending) — the race is
                    // lost at the DB, which raises under the row lock.
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
            rpc: [{ data: null, error: { message: 'generation_already_approved' } }],
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toBeInstanceOf(GenerationAlreadyApprovedError)
    })

    it('rethrows unknown RPC errors as-is and logs them', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const snapshot = makeSnapshot()
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
            rpc: [{ data: null, error: { message: 'boom' } }],
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toMatchObject({ message: 'boom' })
        expect(errorSpy).toHaveBeenCalledWith(
            '[assignFromSnapshot] assign_program_from_snapshot RPC failed',
            expect.objectContaining({ generationId: GENERATION_ID }),
        )
    })

    it('throws when the RPC returns no program id', async () => {
        const snapshot = makeSnapshot()
        const { client } = makeSupabase({
            tables: {
                prescription_generations: {
                    selectSingle: [{ data: { id: GENERATION_ID, status: 'pending_review', output_snapshot: snapshot }, error: null }],
                },
                exercises: { selectList: [{ data: allSnapshotExercisesValid(snapshot), error: null }] },
            },
            rpc: [{ data: null, error: null }],
        })

        await expect(assignFromSnapshot(client, baseInput())).rejects.toMatchObject({
            message: 'assign_program_from_snapshot returned no program id',
        })
    })
})
