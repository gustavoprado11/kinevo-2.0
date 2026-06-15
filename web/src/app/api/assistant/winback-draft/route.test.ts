import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }))
vi.mock('@/lib/prescription/llm-client', () => ({ callLLM: vi.fn(), callWithRetry: vi.fn() }))
vi.mock('@/lib/asaas/wallet-service', () => ({
    getWalletRow: vi.fn(),
    summarizeWallet: vi.fn(),
}))
// draft-prompt (parseDraftOutput) and winback-prompt stay REAL.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { callWithRetry } from '@/lib/prescription/llm-client'
import { getWalletRow, summarizeWallet } from '@/lib/asaas/wallet-service'
import { POST } from './route'

const sbCreate = vi.mocked(createClient)
const sbAdmin = vi.mocked(supabaseAdmin)
const rateMock = vi.mocked(consumeRateLimit)
const retryMock = vi.mocked(callWithRetry)
const walletRowMock = vi.mocked(getWalletRow)
const summarizeMock = vi.mocked(summarizeWallet)

const TRAINER_AUTH_UID = '00000000-0000-4000-8000-000000000001'
const TRAINER_ID = '7aec3555-600c-4e7c-966e-028116921683'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'
const PLAN_ID = '33333333-3333-4333-8333-333333333333'

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/assistant/winback-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function makeServerClient(user: { id: string } | null, trainer: { id: string; name: string | null } | null) {
    return {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
        from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: trainer, error: null }) }) }) })),
    } as never
}

const usageInsert = vi.fn(() => Promise.resolve({ error: null }))

function stubAdmin(opts: { student?: unknown; plan?: unknown; contract?: unknown }) {
    sbAdmin.from.mockImplementation(((table: string) => {
        if (table === 'students') {
            return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: opts.student ?? null, error: null }) }) }) }
        }
        if (table === 'trainer_plans') {
            return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: opts.plan ?? null, error: null }) }) }) }
        }
        if (table === 'student_contracts') {
            return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: opts.contract ?? null, error: null }) }) }) }) }) }) }) }
        }
        if (table === 'assistant_llm_usage') return { insert: usageInsert }
        throw new Error(`unexpected table: ${table}`)
    }) as never)
}

function llmOk() {
    return {
        status: 'success' as const,
        data: JSON.stringify({ message: 'Oi Marina, senti sua falta por aqui! Bora retomar?', references: ['Plano: Consultoria Mensal'], confidence: 'high' }),
        model: 'gpt-4.1-mini' as const,
        usage: { input_tokens: 280, output_tokens: 40, cached_input_tokens: 0, cost_usd: 0.000176 },
    }
}

const student = { id: STUDENT_ID, name: 'Marina', coach_id: TRAINER_ID }
const plan = { id: PLAN_ID, title: 'Consultoria Mensal', price: 199.9, interval: 'month', trainer_id: TRAINER_ID }
const contract = { current_period_end: '2026-06-01T00:00:00.000Z', start_date: '2025-10-01T00:00:00.000Z', created_at: '2025-10-01T00:00:00.000Z' }
const validBody = { student_id: STUDENT_ID, plan_id: PLAN_ID }

describe('POST /api/assistant/winback-draft', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rateMock.mockResolvedValue({ allowed: true })
        retryMock.mockResolvedValue(llmOk() as never)
        walletRowMock.mockResolvedValue({ status: 'approved' } as never)
        summarizeMock.mockReturnValue({ canReceivePayments: true } as never)
        usageInsert.mockReturnValue(Promise.resolve({ error: null }))
    })

    it('401 sem usuário', async () => {
        sbCreate.mockResolvedValue(makeServerClient(null, null))
        expect((await POST(makeRequest(validBody))).status).toBe(401)
    })

    it('404 sem trainer', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, null))
        expect((await POST(makeRequest(validBody))).status).toBe(404)
    })

    it('429 rate-limited', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        rateMock.mockResolvedValue({ allowed: false, error: 'devagar' })
        expect((await POST(makeRequest(validBody))).status).toBe(429)
    })

    it('400 body inválido', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        expect((await POST(makeRequest({}))).status).toBe(400)
        expect((await POST(makeRequest({ student_id: 'x', plan_id: 'y' }))).status).toBe(400)
    })

    it('404 aluno de outro treinador', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student: { ...student, coach_id: 'outro' }, plan })
        expect((await POST(makeRequest(validBody))).status).toBe(404)
    })

    it('404 plano de outro treinador', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student, plan: { ...plan, trainer_id: 'outro' } })
        expect((await POST(makeRequest(validBody))).status).toBe(404)
    })

    it('502 quando o LLM falha', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student, plan, contract })
        retryMock.mockResolvedValue({ status: 'timeout', data: null, model: 'gpt-4.1-mini', usage: null } as never)
        expect((await POST(makeRequest(validBody))).status).toBe(502)
    })

    it('200 happy: draft + can_attach_link=true + loga uso', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student, plan, contract })
        const res = await POST(makeRequest(validBody))
        expect(res.status).toBe(200)
        const b = await res.json()
        expect(b.draft.message).toContain('Marina')
        expect(b.can_attach_link).toBe(true)
        expect(b.cost_usd).toBeCloseTo(0.000176, 6)
        expect(usageInsert).toHaveBeenCalledWith(expect.objectContaining({
            trainer_id: TRAINER_ID, feature: 'winback_draft', model: 'gpt-4.1-mini', cost_usd: 0.000176,
        }))
    })

    it('can_attach_link=false quando carteira Asaas não recebe pagamentos', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student, plan, contract })
        summarizeMock.mockReturnValue({ canReceivePayments: false } as never)
        const b = await (await POST(makeRequest(validBody))).json()
        expect(b.can_attach_link).toBe(false)
    })

    it('can_attach_link=false quando o plano não tem preço', async () => {
        sbCreate.mockResolvedValue(makeServerClient({ id: TRAINER_AUTH_UID }, { id: TRAINER_ID, name: 'Carlos' }))
        stubAdmin({ student, plan: { ...plan, price: 0 }, contract })
        const b = await (await POST(makeRequest(validBody))).json()
        expect(b.can_attach_link).toBe(false)
    })
})
