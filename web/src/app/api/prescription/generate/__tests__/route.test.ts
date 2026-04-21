import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server-from-token', () => ({
    createServerClientFromToken: vi.fn(),
}))
vi.mock('@/actions/prescription/generate-program', () => ({
    generateProgram: vi.fn(),
}))
vi.mock('@/lib/rate-limit/prescription', () => ({
    checkPrescriptionRateLimit: vi.fn(async () => ({ allowed: true })),
}))

import { createServerClientFromToken } from '@/lib/supabase/server-from-token'
import { generateProgram } from '@/actions/prescription/generate-program'
import { checkPrescriptionRateLimit } from '@/lib/rate-limit/prescription'
import { POST } from '../route'
import type { PrescriptionAgentState } from '@kinevo/shared/types/prescription'

const mkClient = vi.mocked(createServerClientFromToken)
const generate = vi.mocked(generateProgram)
const rl = vi.mocked(checkPrescriptionRateLimit)

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'
const GENERATION_ID = '19957cce-ca65-42fb-a765-d40e83aae8f1'

function makeReq(body: unknown, opts: { auth?: string } = {}): NextRequest {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.auth !== undefined) headers.Authorization = opts.auth
    return new NextRequest('http://localhost/api/prescription/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    } as any)
}

function stubClient(opts: {
    user?: { id: string } | null
    trainer?: { id: string; ai_prescriptions_enabled?: boolean } | null
    student?: { id: string } | null
    snapshot?: unknown
} = {}) {
    const user = opts.user === undefined ? { id: TRAINER_AUTH_UID } : opts.user
    const trainer = opts.trainer === undefined
        ? { id: TRAINER_ID, ai_prescriptions_enabled: true }
        : opts.trainer
    const student = opts.student === undefined ? { id: STUDENT_ID } : opts.student
    const snapshot = opts.snapshot === undefined
        ? { program: { name: 'P', description: '', duration_weeks: 4 }, workouts: [], reasoning: {} }
        : opts.snapshot

    const client: any = {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : new Error('no user') }),
        },
        from(table: string) {
            if (table === 'trainers') {
                return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: trainer, error: null }) }) }) }
            }
            if (table === 'students') {
                return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: student, error: null }) }) }) }) }
            }
            if (table === 'prescription_generations') {
                return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { output_snapshot: snapshot }, error: null }) }) }) }
            }
            throw new Error(`unexpected table: ${table}`)
        },
    }
    return client
}

const VALID_AGENT_STATE: PrescriptionAgentState = {
    conversation_messages: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá' },
    ],
    context_analysis: null,
    questions: [
        { id: 'q1', question: 'Você prefere agachamento livre?', context: 'estilo', type: 'single_choice', options: ['Sim', 'Não'] },
    ],
    answers: [{ question_id: 'q1', answer: 'Sim' }],
    phase: 'generating',
}

beforeEach(() => {
    vi.clearAllMocks()
    rl.mockResolvedValue({ allowed: true })
})

describe('POST /api/prescription/generate (Fase 2a)', () => {
    it('backward compat: body without agentState calls generateProgram with (studentId, null, [])', async () => {
        mkClient.mockReturnValue(stubClient())
        generate.mockResolvedValue({ success: true, generationId: GENERATION_ID } as any)
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.generationId).toBe(GENERATION_ID)
        expect(generate).toHaveBeenCalledTimes(1)
        const [sid, agentArg, formIds, optsArg] = generate.mock.calls[0]
        expect(sid).toBe(STUDENT_ID)
        expect(agentArg).toBeNull()
        expect(formIds).toEqual([])
        expect(optsArg).toBeDefined()
    })

    it('treats explicit agentState: null as absent (backward compat with mobile parse-text path)', async () => {
        mkClient.mockReturnValue(stubClient())
        generate.mockResolvedValue({ success: true, generationId: GENERATION_ID } as any)
        const res = await POST(
            makeReq({ studentId: STUDENT_ID, agentState: null }, { auth: 'Bearer good' }),
        )
        expect(res.status).toBe(200)
        const [, agentArg] = generate.mock.calls[0]
        expect(agentArg).toBeNull()
    })

    it('forwards a valid agentState + selectedFormIds to generateProgram', async () => {
        mkClient.mockReturnValue(stubClient())
        generate.mockResolvedValue({ success: true, generationId: GENERATION_ID } as any)
        const res = await POST(
            makeReq(
                { studentId: STUDENT_ID, agentState: VALID_AGENT_STATE, selectedFormIds: ['fa', 'fb'] },
                { auth: 'Bearer good' },
            ),
        )
        expect(res.status).toBe(200)
        const [sid, agentArg, formIds] = generate.mock.calls[0]
        expect(sid).toBe(STUDENT_ID)
        expect(agentArg).toEqual(VALID_AGENT_STATE)
        expect(formIds).toEqual(['fa', 'fb'])
    })

    it('returns 400 when agentState is malformed (bad phase)', async () => {
        mkClient.mockReturnValue(stubClient())
        const bad = { ...VALID_AGENT_STATE, phase: 'not-a-phase' }
        const res = await POST(makeReq({ studentId: STUDENT_ID, agentState: bad }, { auth: 'Bearer good' }))
        expect(res.status).toBe(400)
        expect(generate).not.toHaveBeenCalled()
    })

    it('returns 400 when agentState is missing required arrays', async () => {
        mkClient.mockReturnValue(stubClient())
        const res = await POST(
            makeReq(
                { studentId: STUDENT_ID, agentState: { phase: 'questions' } },
                { auth: 'Bearer good' },
            ),
        )
        expect(res.status).toBe(400)
        expect(generate).not.toHaveBeenCalled()
    })

    it('returns 401 when Authorization header is missing', async () => {
        const res = await POST(makeReq({ studentId: STUDENT_ID }))
        expect(res.status).toBe(401)
    })

    it('returns 403 when ai_prescriptions_enabled is false', async () => {
        mkClient.mockReturnValue(stubClient({ trainer: { id: TRAINER_ID, ai_prescriptions_enabled: false } }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(403)
    })

    it('returns 404 when the student does not belong to the trainer', async () => {
        mkClient.mockReturnValue(stubClient({ student: null }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(404)
    })

    it('returns 429 when rate-limit helper blocks the call', async () => {
        mkClient.mockReturnValue(stubClient())
        rl.mockResolvedValue({ allowed: false, status: 429, error: 'Slow down' })
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(429)
        expect(generate).not.toHaveBeenCalled()
    })

    it('returns 500 when the snapshot row is empty after a successful generation', async () => {
        mkClient.mockReturnValue(stubClient({ snapshot: null }))
        generate.mockResolvedValue({ success: true, generationId: GENERATION_ID } as any)
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(500)
    })
})
