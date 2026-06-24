import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be declared before importing the route handler.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }))
vi.mock('@/lib/prescription/llm-client', () => ({
    callLLM: vi.fn(),
    callWithRetry: vi.fn(),
}))
vi.mock('@/lib/assistant/student-context', () => ({ buildDraftContext: vi.fn() }))
vi.mock('@/lib/ai-usage/usage-summary', () => ({ getAiUsageSummary: vi.fn() }))
vi.mock('@/lib/ai-usage/metering', () => ({
    recordAiUsage: vi.fn(async () => ({ ok: true })),
    usdToMicros: (u: number) => Math.round(u * 1_000_000),
}))
// draft-prompt stays REAL (pure functions, already tested) — integration.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { callWithRetry } from '@/lib/prescription/llm-client'
import { buildDraftContext } from '@/lib/assistant/student-context'
import type { DraftContext } from '@/lib/assistant/student-context'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { POST } from './route'

const sbCreate = vi.mocked(createClient)
const sbAdmin = vi.mocked(supabaseAdmin)
const rateMock = vi.mocked(consumeRateLimit)
const retryMock = vi.mocked(callWithRetry)
const ctxMock = vi.mocked(buildDraftContext)
const usageMock = vi.mocked(getAiUsageSummary)

const usageOk = (over: Partial<Awaited<ReturnType<typeof getAiUsageSummary>>> = {}) => ({
    tier: 'pro_ia' as const,
    creditsUsed: 0,
    creditsTotal: 300,
    creditsRemaining: 300,
    periodStart: '2026-06-01',
    periodEnd: '2026-07-01',
    exhausted: false,
    ...over,
})

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'
const INSIGHT_ID = '22222222-2222-4222-8222-222222222222'

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/assistant/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

// Server (cookie) client: .auth.getUser() + .from('trainers').select().eq().single()
function makeServerClient(user: { id: string } | null, trainer: { id: string; name: string | null } | null) {
    return {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
        from: vi.fn(() => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: trainer, error: null }) }) }),
        })),
    } as never
}

const usageInsert = vi.fn(() => Promise.resolve({ error: null }))

// Admin client: assistant_insights (select.eq.eq.single) + assistant_llm_usage (insert)
function stubAdmin(insight: unknown) {
    sbAdmin.from.mockImplementation(((table: string) => {
        if (table === 'assistant_insights') {
            return {
                select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: insight, error: null }) }) }) }),
            }
        }
        if (table === 'assistant_llm_usage') {
            return { insert: usageInsert }
        }
        throw new Error(`unexpected table: ${table}`)
    }) as never)
}

const goodCtx: DraftContext = {
    studentName: 'João',
    sessionsLast30d: 6,
    lastSessionAt: '2026-06-10T10:00:00.000Z',
    daysSinceLast: 5,
    avgRpe: 7.5,
    checkins: [],
    hasData: true,
}

function llmOk(message = 'Oi João, vi que você sumiu faz 5 dias. Tá tudo bem?') {
    return {
        status: 'success' as const,
        data: JSON.stringify({ message, references: ['Último treino há 5 dias'], confidence: 'high' }),
        model: 'gpt-4.1-mini' as const,
        usage: { input_tokens: 320, output_tokens: 48, cached_input_tokens: 0, cost_usd: 0.000204 },
    }
}

const validBody = { insight_id: INSIGHT_ID, student_id: STUDENT_ID }
const insightRow = { id: INSIGHT_ID, title: 'Estagnação', body: 'Mesma carga há 3 semanas', action_type: 'adjust_load', action_metadata: {}, student_id: STUDENT_ID, insight_key: 'stagnation:x' }

describe('POST /api/assistant/draft-message', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rateMock.mockResolvedValue({ allowed: true })
        retryMock.mockResolvedValue(llmOk() as never)
        ctxMock.mockResolvedValue(goodCtx)
        usageInsert.mockReturnValue(Promise.resolve({ error: null }))
        usageMock.mockResolvedValue(usageOk())
    })

    it('402 quando a cota de IA está esgotada (gate de custo)', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        usageMock.mockResolvedValue(usageOk({ exhausted: true }))
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(402)
    })

    it('401 quando não autenticado', async () => {
        sbCreate.mockResolvedValue(makeServerClient(null, null))
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(401)
    })

    it('404 quando o usuário não é treinador', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, null))
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(404)
    })

    it('429 quando rate-limited', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        rateMock.mockResolvedValue({ allowed: false, error: 'devagar' })
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(429)
    })

    it('400 quando faltam ids ou não são UUID', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        expect((await POST(makeRequest({}))).status).toBe(400)
        expect((await POST(makeRequest({ insight_id: 'x', student_id: 'y' }))).status).toBe(400)
    })

    it('404 quando o insight não existe para este treinador', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(null)
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(404)
    })

    it('403 quando o insight pertence a outro aluno', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ ...insightRow, student_id: '99999999-9999-4999-8999-999999999999' })
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(403)
    })

    it('404 quando o contexto do aluno não pode ser montado (não pertence ao treinador)', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        ctxMock.mockResolvedValue(null)
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(404)
    })

    it('502 quando o LLM falha', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        retryMock.mockResolvedValue({ status: 'timeout', data: null, model: 'gpt-4.1-mini', usage: null } as never)
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(502)
    })

    it('502 quando a saída do LLM não é JSON parseável', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        retryMock.mockResolvedValue({ status: 'success', data: 'isto não é json', model: 'gpt-4.1-mini', usage: llmOk().usage } as never)
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(502)
    })

    it('200 no happy path: devolve draft + cost_usd e loga o uso por treinador', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.draft.message).toContain('João')
        expect(body.draft.references).toEqual(['Último treino há 5 dias'])
        expect(body.draft.confidence).toBe('high')
        expect(body.cost_usd).toBeCloseTo(0.000204, 6)

        // O medidor: insert em assistant_llm_usage amarrado ao trainer_id.
        expect(usageInsert).toHaveBeenCalledTimes(1)
        expect(usageInsert).toHaveBeenCalledWith(expect.objectContaining({
            trainer_id: TRAINER_ID,
            feature: 'draft_message',
            model: 'gpt-4.1-mini',
            input_tokens: 320,
            output_tokens: 48,
            cost_usd: 0.000204,
            insight_id: INSIGHT_ID,
        }))
    })

    it('força confidence=low quando o contexto é pobre, mesmo com LLM dizendo high', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        ctxMock.mockResolvedValue({ ...goodCtx, hasData: false })
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.draft.confidence).toBe('low')
    })

    it('responde 200 mesmo se o log de uso falhar (best-effort)', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin(insightRow)
        usageInsert.mockReturnValue(Promise.reject(new Error('tabela ausente')))
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(200)
    })
})
