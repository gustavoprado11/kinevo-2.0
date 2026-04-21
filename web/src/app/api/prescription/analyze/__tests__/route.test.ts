import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server-from-token', () => ({
    createServerClientFromToken: vi.fn(),
}))
vi.mock('@/actions/prescription/analyze-context', () => ({
    analyzeStudentContext: vi.fn(),
}))
vi.mock('@/lib/rate-limit/prescription', () => ({
    checkPrescriptionRateLimit: vi.fn(async () => ({ allowed: true })),
}))

import { createServerClientFromToken } from '@/lib/supabase/server-from-token'
import { analyzeStudentContext } from '@/actions/prescription/analyze-context'
import { checkPrescriptionRateLimit } from '@/lib/rate-limit/prescription'
import { POST } from '../route'

const mkClient = vi.mocked(createServerClientFromToken)
const analyze = vi.mocked(analyzeStudentContext)
const rl = vi.mocked(checkPrescriptionRateLimit)

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = 'bbe3c04a-72cd-437e-8faa-46615b2ff9e2'

function makeReq(body: unknown, opts: { auth?: string } = {}): NextRequest {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.auth !== undefined) headers.Authorization = opts.auth
    return new NextRequest('http://localhost/api/prescription/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    } as any)
}

function stubClient(opts: {
    user?: { id: string } | null
    trainer?: { id: string; ai_prescriptions_enabled?: boolean } | null
    student?: { id: string } | null
} = {}) {
    const user = opts.user === undefined ? { id: TRAINER_AUTH_UID } : opts.user
    const trainer = opts.trainer === undefined
        ? { id: TRAINER_ID, ai_prescriptions_enabled: true }
        : opts.trainer
    const student = opts.student === undefined ? { id: STUDENT_ID } : opts.student
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
            throw new Error(`unexpected table: ${table}`)
        },
    }
    return client
}

beforeEach(() => {
    vi.clearAllMocks()
    rl.mockResolvedValue({ allowed: true })
})

describe('POST /api/prescription/analyze', () => {
    it('returns 200 and the AnalyzeContextResult on happy path', async () => {
        mkClient.mockReturnValue(stubClient())
        analyze.mockResolvedValue({
            success: true,
            agentState: { conversation_messages: [], context_analysis: null, questions: [], answers: [], phase: 'questions' },
            questions: [],
            studentName: 'João',
        })
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(analyze).toHaveBeenCalledWith(STUDENT_ID, [])
    })

    it('passes selectedFormIds through to the server action', async () => {
        mkClient.mockReturnValue(stubClient())
        analyze.mockResolvedValue({ success: true })
        const res = await POST(
            makeReq({ studentId: STUDENT_ID, selectedFormIds: ['f1', 'f2'] }, { auth: 'Bearer good' }),
        )
        expect(res.status).toBe(200)
        expect(analyze).toHaveBeenCalledWith(STUDENT_ID, ['f1', 'f2'])
    })

    it('returns 401 when Authorization header is missing', async () => {
        const res = await POST(makeReq({ studentId: STUDENT_ID }))
        expect(res.status).toBe(401)
    })

    it('returns 401 when JWT verification fails (no user)', async () => {
        mkClient.mockReturnValue(stubClient({ user: null }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer bad' }))
        expect(res.status).toBe(401)
    })

    it('returns 400 when studentId is missing', async () => {
        mkClient.mockReturnValue(stubClient())
        const res = await POST(makeReq({}, { auth: 'Bearer good' }))
        expect(res.status).toBe(400)
    })

    it('returns 403 when trainer profile is not found', async () => {
        mkClient.mockReturnValue(stubClient({ trainer: null }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(403)
    })

    it('returns 403 when trainer.ai_prescriptions_enabled is false', async () => {
        mkClient.mockReturnValue(stubClient({ trainer: { id: TRAINER_ID, ai_prescriptions_enabled: false } }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(403)
    })

    it('returns 404 when the student does not belong to the trainer', async () => {
        mkClient.mockReturnValue(stubClient({ student: null }))
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(404)
    })

    it('returns 429 when the rate-limit helper blocks the call', async () => {
        mkClient.mockReturnValue(stubClient())
        rl.mockResolvedValue({ allowed: false, status: 429, error: 'Slow down' })
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(429)
        expect(analyze).not.toHaveBeenCalled()
    })

    it('returns 500 when the server action returns success:false', async () => {
        mkClient.mockReturnValue(stubClient())
        analyze.mockResolvedValue({ success: false, error: 'boom' })
        const res = await POST(makeReq({ studentId: STUDENT_ID }, { auth: 'Bearer good' }))
        expect(res.status).toBe(500)
    })
})
