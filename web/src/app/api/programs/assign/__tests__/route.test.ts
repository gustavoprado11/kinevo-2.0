import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks declared before importing the route handler.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn(() => ({ allowed: true })),
    recordRequest: vi.fn(),
}))
vi.mock('@/lib/ai-prescription/assign-from-snapshot', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai-prescription/assign-from-snapshot')>(
        '@/lib/ai-prescription/assign-from-snapshot',
    )
    return {
        ...actual,
        assignFromSnapshot: vi.fn(),
    }
})

import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { assignFromSnapshot } from '@/lib/ai-prescription/assign-from-snapshot'
import { POST } from '../route'

const sbCreate = vi.mocked(supabaseCreateClient)
const assignHelper = vi.mocked(assignFromSnapshot)

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'
const GENERATION_ID = '19957cce-ca65-42fb-a765-d40e83aae8f1'
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111'

function makeRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/programs/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good' },
        body: JSON.stringify(body),
    } as any)
}

// Supabase client stub that resolves trainer + student lookups. Used for
// bodies that pass prelude validation; the test controls what happens after
// via either the helper mock (generationId branch) or the template stub
// (templateId branch).
function stubClientForHappyPrelude(opts: {
    trainer?: { id: string } | null
    student?: { id: string } | null
    template?: { id: string; name: string; description: string | null; duration_weeks: number } | null
    workouts?: unknown[]
} = {}) {
    const trainer = opts.trainer ?? { id: TRAINER_ID }
    const student = opts.student ?? { id: STUDENT_ID }
    const template = opts.template ?? null
    const workouts = opts.workouts ?? []

    const client: any = {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: TRAINER_AUTH_UID } }, error: null }),
        },
        from(table: string) {
            if (table === 'trainers') {
                return {
                    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: trainer, error: null }) }) }),
                }
            }
            if (table === 'students') {
                return {
                    select: () => ({
                        eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: student, error: null }) }) }),
                    }),
                }
            }
            if (table === 'program_templates') {
                return {
                    select: () => ({
                        eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: template, error: null }) }) }),
                    }),
                }
            }
            if (table === 'assigned_programs') {
                return {
                    update: () => {
                        const chain: any = {
                            eq: () => chain,
                            in: () => Promise.resolve({ error: null }),
                            then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
                        }
                        return chain
                    },
                    insert: () => ({
                        select: () => ({ single: () => Promise.resolve({ data: { id: 'stub-program' }, error: null }) }),
                    }),
                }
            }
            if (table === 'workout_templates') {
                return {
                    select: () => ({
                        eq: () => ({ order: () => Promise.resolve({ data: workouts, error: null }) }),
                    }),
                }
            }
            if (table === 'assigned_workouts') {
                return {
                    insert: () => ({
                        select: () => ({ single: () => Promise.resolve({ data: { id: 'stub-workout' }, error: null }) }),
                    }),
                }
            }
            throw new Error(`unexpected table: ${table}`)
        },
    }

    return client
}

describe('POST /api/programs/assign', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('400 when both templateId and generationId are absent', async () => {
        sbCreate.mockReturnValue(stubClientForHappyPrelude())
        const res = await POST(makeRequest({ studentId: STUDENT_ID }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/templateId \| generationId/)
    })

    it('400 when generationId is malformed UUID', async () => {
        sbCreate.mockReturnValue(stubClientForHappyPrelude())
        const res = await POST(makeRequest({ studentId: STUDENT_ID, generationId: 'not-a-uuid' }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toBe('Invalid generationId format')
    })

    it('generationId branch: delegates to assignFromSnapshot and returns programId', async () => {
        assignHelper.mockResolvedValue({ programId: 'fresh-program-id' })
        sbCreate.mockReturnValue(stubClientForHappyPrelude())

        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID,
                generationId: GENERATION_ID,
                startDate: '2026-04-21T00:00:00Z',
            }),
        )

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({ success: true, programId: 'fresh-program-id' })
        expect(assignHelper).toHaveBeenCalledTimes(1)
        expect(assignHelper.mock.calls[0][1]).toMatchObject({
            generationId: GENERATION_ID,
            trainerId: TRAINER_ID,
            studentId: STUDENT_ID,
            startDate: '2026-04-21T00:00:00Z',
            isScheduled: false,
        })
    })

    it('outputSnapshot in body is ignored when isEdited is absent — helper sees editedSnapshot=undefined', async () => {
        assignHelper.mockResolvedValue({ programId: 'p-ignored-snap' })
        sbCreate.mockReturnValue(stubClientForHappyPrelude())

        await POST(
            makeRequest({
                studentId: STUDENT_ID,
                generationId: GENERATION_ID,
                outputSnapshot: { program: { name: 'FORJADO' }, workouts: [] },
            }),
        )

        const helperInput = assignHelper.mock.calls[0][1] as unknown as Record<string, unknown>
        // The new posture (Fase 2.5.4 §5 revisado) gates client snapshots on
        // `isEdited === true`. When the flag is absent, the snapshot is
        // dropped before reaching the helper — `editedSnapshot` stays undefined.
        expect(helperInput.editedSnapshot).toBeUndefined()
        expect(helperInput).not.toHaveProperty('outputSnapshot')
    })

    it('templateId branch: proceeds without calling assignFromSnapshot', async () => {
        sbCreate.mockReturnValue(
            stubClientForHappyPrelude({
                template: { id: TEMPLATE_ID, name: 'Web Template', description: null, duration_weeks: 4 },
                workouts: [],
            }),
        )

        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, templateId: TEMPLATE_ID, startDate: new Date().toISOString() }),
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ success: true, programId: 'stub-program' })
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('both templateId and generationId: templateId wins + warn is logged', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        sbCreate.mockReturnValue(
            stubClientForHappyPrelude({
                template: { id: TEMPLATE_ID, name: 'Web Template', description: null, duration_weeks: 4 },
                workouts: [],
            }),
        )

        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID,
                templateId: TEMPLATE_ID,
                generationId: GENERATION_ID,
                startDate: new Date().toISOString(),
            }),
        )

        expect(res.status).toBe(200)
        expect(assignHelper).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('both templateId and generationId provided'),
            expect.objectContaining({ studentId: STUDENT_ID }),
        )
    })

    it('generationId branch surfaces GenerationNotFoundError as 404', async () => {
        const { GenerationNotFoundError } = await import('@/lib/ai-prescription/assign-from-snapshot')
        assignHelper.mockRejectedValue(new GenerationNotFoundError())
        sbCreate.mockReturnValue(stubClientForHappyPrelude())

        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, generationId: GENERATION_ID }),
        )
        expect(res.status).toBe(404)
    })

    it('generationId branch surfaces GenerationAlreadyApprovedError as 409', async () => {
        const { GenerationAlreadyApprovedError } = await import('@/lib/ai-prescription/assign-from-snapshot')
        assignHelper.mockRejectedValue(new GenerationAlreadyApprovedError())
        sbCreate.mockReturnValue(stubClientForHappyPrelude())

        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, generationId: GENERATION_ID }),
        )
        expect(res.status).toBe(409)
    })

    it('generationId branch surfaces GenerationSnapshotAllItemsInvalidError as 422 (pt-BR)', async () => {
        const { GenerationSnapshotAllItemsInvalidError } = await import(
            '@/lib/ai-prescription/assign-from-snapshot'
        )
        assignHelper.mockRejectedValue(new GenerationSnapshotAllItemsInvalidError())
        sbCreate.mockReturnValue(stubClientForHappyPrelude())

        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, generationId: GENERATION_ID }),
        )
        expect(res.status).toBe(422)
        const body = await res.json()
        expect(body.error).toMatch(/prescrição gerada contém dados inválidos/i)
    })
})

// ===========================================================================
// Fase 2b — isEdited / outputSnapshot path
// ===========================================================================

const EDITED_EX_A = '11111111-2222-4333-8444-555555555555'
const EDITED_EX_B = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const FOREIGN_EX = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function makeEditedSnapshot(): unknown {
    return {
        program: {
            name: 'Programa Editado pelo Treinador',
            description: 'Editado',
            duration_weeks: 6,
        },
        workouts: [
            {
                name: 'A',
                order_index: 0,
                scheduled_days: [1, 4],
                items: [
                    { item_type: 'exercise', order_index: 0, exercise_id: EDITED_EX_A, sets: 4, reps: '8', rest_seconds: 90, notes: null },
                    { item_type: 'exercise', order_index: 1, exercise_id: EDITED_EX_B, sets: 3, reps: '10', rest_seconds: 60, notes: null },
                ],
            },
        ],
    }
}

/**
 * Stub for the Fase 2b path — adds RPC stubs for the route's ownership
 * pre-check (`prescription_generations`) and catalog pre-check (`exercises`).
 */
function stubClientFase2b(opts: {
    ownershipFound?: boolean
    catalogRows?: Array<{ id: string; owner_id: string | null }>
} = {}) {
    const ownershipFound = opts.ownershipFound ?? true
    const catalogRows = opts.catalogRows ?? [
        { id: EDITED_EX_A, owner_id: null },
        { id: EDITED_EX_B, owner_id: TRAINER_ID },
    ]

    const client: any = {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: TRAINER_AUTH_UID } }, error: null }),
        },
        from(table: string) {
            if (table === 'trainers') {
                return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: TRAINER_ID }, error: null }) }) }) }
            }
            if (table === 'students') {
                return {
                    select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: STUDENT_ID }, error: null }) }) }) }),
                }
            }
            if (table === 'prescription_generations') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({
                                        data: ownershipFound ? { id: GENERATION_ID } : null,
                                        error: ownershipFound ? null : { code: 'PGRST116' },
                                    }),
                                }),
                            }),
                        }),
                    }),
                }
            }
            if (table === 'exercises') {
                return {
                    select: () => ({ in: () => Promise.resolve({ data: catalogRows, error: null }) }),
                }
            }
            throw new Error(`unexpected table: ${table}`)
        },
    }
    return client
}

describe('POST /api/programs/assign — Fase 2b (isEdited path)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('happy path: isEdited:true with valid snapshot, ownership, and catalog → forwards editedSnapshot', async () => {
        assignHelper.mockResolvedValue({ programId: 'edited-program-id' })
        sbCreate.mockReturnValue(stubClientFase2b())

        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID,
                generationId: GENERATION_ID,
                isEdited: true,
                outputSnapshot: makeEditedSnapshot(),
            }),
        )

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({ success: true, programId: 'edited-program-id' })
        const helperInput = assignHelper.mock.calls[0][1] as any
        expect(helperInput.editedSnapshot).toBeDefined()
        expect(helperInput.editedSnapshot.program.name).toBe('Programa Editado pelo Treinador')
        expect(helperInput.editedSnapshot.workouts).toHaveLength(1)
    })

    it('400 when isEdited:true but outputSnapshot missing', async () => {
        sbCreate.mockReturnValue(stubClientFase2b())
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, generationId: GENERATION_ID, isEdited: true }),
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/isEdited.*outputSnapshot/i)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('400 when outputSnapshot has bad shape (missing workouts)', async () => {
        sbCreate.mockReturnValue(stubClientFase2b())
        const bad = { program: { name: 'X' } }
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: bad,
            }),
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/snapshot inválido/i)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('400 when outputSnapshot has bad shape (item.exercise_id is not a UUID)', async () => {
        sbCreate.mockReturnValue(stubClientFase2b())
        const bad = {
            program: { name: 'X', description: '', duration_weeks: 4 },
            workouts: [{ name: 'A', order_index: 0, items: [{ item_type: 'exercise', order_index: 0, exercise_id: 'NOT-UUID', sets: 3, reps: '10', rest_seconds: 60, notes: null }] }],
        }
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: bad,
            }),
        )
        expect(res.status).toBe(400)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('accepts permissive reasoning (empty strings, confidence_score=0) when shape is otherwise valid', async () => {
        assignHelper.mockResolvedValue({ programId: 'pid' })
        sbCreate.mockReturnValue(stubClientFase2b())
        const snap = {
            ...(makeEditedSnapshot() as Record<string, unknown>),
            reasoning: { structure_rationale: '', volume_rationale: '', workout_notes: [], attention_flags: [], confidence_score: 0 },
        }
        const res = await POST(
            makeRequest({ studentId: STUDENT_ID, generationId: GENERATION_ID, isEdited: true, outputSnapshot: snap }),
        )
        expect(res.status).toBe(200)
    })

    it('403 when generationId does not belong to the calling trainer (cross-trainer payload)', async () => {
        sbCreate.mockReturnValue(stubClientFase2b({ ownershipFound: false }))
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: makeEditedSnapshot(),
            }),
        )
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error).toMatch(/acesso negado/i)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('400 when an exercise_id is outside the trainer-accessible catalog', async () => {
        sbCreate.mockReturnValue(stubClientFase2b({
            // EDITED_EX_A is system, but EDITED_EX_B is owned by another trainer.
            catalogRows: [
                { id: EDITED_EX_A, owner_id: null },
                { id: EDITED_EX_B, owner_id: 'another-trainer-id' },
            ],
        }))
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: makeEditedSnapshot(),
            }),
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/Exercício fora do catálogo/)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('400 when an exercise_id is not in the exercises table at all (ghost id)', async () => {
        sbCreate.mockReturnValue(stubClientFase2b({
            catalogRows: [{ id: EDITED_EX_A, owner_id: null }], // EDITED_EX_B missing entirely
        }))
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: makeEditedSnapshot(),
            }),
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/Exercício fora do catálogo/)
        expect(body.error).toContain(EDITED_EX_B)
        expect(assignHelper).not.toHaveBeenCalled()
    })

    it('isEdited:false (or absent) keeps backward-compat: helper called with editedSnapshot undefined', async () => {
        assignHelper.mockResolvedValue({ programId: 'compat-id' })
        sbCreate.mockReturnValue(stubClientFase2b())
        const res = await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID, isEdited: false,
                outputSnapshot: makeEditedSnapshot(), // payload set but ignored
            }),
        )
        expect(res.status).toBe(200)
        const helperInput = assignHelper.mock.calls[0][1] as any
        expect(helperInput.editedSnapshot).toBeUndefined()
    })

    it('logs persistence (without leaking the snapshot body)', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        assignHelper.mockResolvedValue({ programId: 'logged-id' })
        sbCreate.mockReturnValue(stubClientFase2b())
        await POST(
            makeRequest({
                studentId: STUDENT_ID, generationId: GENERATION_ID,
                isEdited: true, outputSnapshot: makeEditedSnapshot(),
            }),
        )
        const calls = logSpy.mock.calls.map((c) => JSON.stringify(c))
        const persisted = calls.find((c) => c.includes('generation persisted'))
        expect(persisted).toBeDefined()
        expect(persisted).toContain('"wasEdited":true')
        // PII / payload guard: must not log the full snapshot.
        expect(persisted).not.toContain('Programa Editado pelo Treinador')
        logSpy.mockRestore()
    })
})
