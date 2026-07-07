import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    createSupabaseAdminStub,
    type SupabaseAdminStub,
    type RecordedQuery,
} from '@/test/supabase-admin-stub'

// Holder hoisted (factories de vi.mock não podem referenciar top-level).
const h = vi.hoisted(() => ({
    stub: null as unknown as { from: (t: string) => unknown; rpc: (fn: string, a?: unknown) => Promise<unknown> },
    asaasRequest: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (t: string) => h.stub.from(t),
        rpc: (fn: string, a?: unknown) => h.stub.rpc(fn, a),
    },
}))

// Mantém a AsaasApiError real (webhook-setup faz instanceof) e só intercepta
// asaasRequest pra registrar GET/PUT/POST sem rede.
vi.mock('../client', async () => {
    const actual = await vi.importActual<typeof import('../client')>('../client')
    return { ...actual, asaasRequest: h.asaasRequest }
})

import {
    ensureSubaccountWebhook,
    rotateSubaccountWebhook,
    revertSubaccountToGlobal,
} from '../webhook-setup'
import { hashWebhookToken } from '../webhook'

const TARGET_URL = 'https://www.kinevoapp.com/api/webhooks/asaas'
const TRAINER = 'trainer-xyz'
const GLOBAL_TOKEN = 'global-token-xyz'
const ALL_EVENTS = [
    'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH',
    'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED',
    'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
    'TRANSFER_CREATED', 'TRANSFER_PENDING', 'TRANSFER_IN_BANK_PROCESSING',
    'TRANSFER_DONE', 'TRANSFER_FAILED', 'TRANSFER_CANCELLED',
]

interface AsaasReq {
    apiKey: string
    method?: string
    path: string
    body?: Record<string, unknown>
}

const isGet = (o: AsaasReq) => !o.method || o.method === 'GET'
const writeCalls = (): AsaasReq[] =>
    h.asaasRequest.mock.calls.map((c) => c[0] as AsaasReq).filter((o) => o.method === 'PUT' || o.method === 'POST')
const updatePayloadHash = (q: RecordedQuery): unknown => (q.payload as { webhook_token_hash?: unknown }).webhook_token_hash

/** GET devolve a lista informada; qualquer write (PUT/POST) é erro inesperado. */
function getReturns(webhooks: Array<Record<string, unknown>>) {
    h.asaasRequest.mockImplementation(async (o: AsaasReq) => {
        if (isGet(o)) return { data: webhooks }
        throw new Error(`unexpected write: ${o.method} ${o.path}`)
    })
}

let stub: SupabaseAdminStub
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
    vi.clearAllMocks()
    stub = createSupabaseAdminStub()
    h.stub = stub
    for (const k of ['ASAAS_WEBHOOK_URL', 'ASAAS_WEBHOOK_TOKEN']) saved[k] = process.env[k]
    process.env.ASAAS_WEBHOOK_URL = TARGET_URL
    process.env.ASAAS_WEBHOOK_TOKEN = GLOBAL_TOKEN
    // ASAAS_WEBHOOK_EMAIL não é setado: nenhum teste asserta o email; ele cai no
    // fallback em runtime. Evita carregar um literal de email no fixture.
})

afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
    }
})

describe('ensureSubaccountWebhook — Design 1: automático nunca escreve token em subconta existente', () => {
    it('drift (interrupted): NÃO escreve — needsRepair:true, zero PUT/POST, hash intocado', async () => {
        getReturns([{ id: 'wh_1', url: TARGET_URL, enabled: true, interrupted: true, events: ALL_EVENTS, hasAuthToken: true }])
        const res = await ensureSubaccountWebhook('sk-sub', { trainerId: TRAINER })
        expect(res).toEqual({ created: false, updated: false, webhookId: 'wh_1', needsRepair: true })
        // A prova de que o bug morreu: o caminho de drift não emite PUT NENHUM.
        expect(writeCalls().length).toBe(0)
        expect(stub.calls('trainer_payment_accounts', 'update').length).toBe(0)
    })

    it('drift (eventos incompletos): também só sinaliza, sem escrever', async () => {
        getReturns([{ id: 'wh_1', url: TARGET_URL, enabled: true, interrupted: false, events: ['PAYMENT_RECEIVED'], hasAuthToken: true }])
        const res = await ensureSubaccountWebhook('sk-sub', { trainerId: TRAINER })
        expect(res.needsRepair).toBe(true)
        expect(writeCalls().length).toBe(0)
    })

    it('em sincronia: no-op (sem escrita, sem needsRepair)', async () => {
        getReturns([{ id: 'wh_1', url: TARGET_URL, enabled: true, interrupted: false, events: ALL_EVENTS, hasAuthToken: true }])
        const res = await ensureSubaccountWebhook('sk-sub', { trainerId: TRAINER })
        expect(res).toEqual({ created: false, updated: false, webhookId: 'wh_1' })
        expect(res.needsRepair).toBeUndefined()
        expect(writeCalls().length).toBe(0)
    })

    it('create (sem webhook): grava o hash ANTES do POST, e o POST carrega o token por-subconta', async () => {
        const order: string[] = []
        let postedToken: string | undefined
        stub.onQuery((q) => {
            if (q.table === 'trainer_payment_accounts' && q.op === 'update') order.push('store')
            return undefined
        })
        h.asaasRequest.mockImplementation(async (o: AsaasReq) => {
            if (isGet(o)) return { data: [] }
            if (o.method === 'POST') {
                order.push('post')
                postedToken = o.body?.authToken as string
                return { id: 'wh_new' }
            }
            throw new Error(`unexpected ${o.method}`)
        })
        const res = await ensureSubaccountWebhook('sk-sub', { trainerId: TRAINER })
        expect(res).toMatchObject({ created: true, updated: false, webhookId: 'wh_new' })
        expect(order).toEqual(['store', 'post']) // hash ANTES do POST
        expect(postedToken).toBeTruthy()
        // o hash gravado corresponde ao token que foi pro Asaas
        const stored = updatePayloadHash(stub.calls('trainer_payment_accounts', 'update')[0])
        expect(stored).toBe(hashWebhookToken(postedToken as string))
    })
})

describe('rotateSubaccountWebhook (gated)', () => {
    it('grava o hash ANTES do PUT, e o PUT carrega o token novo explícito (não o global)', async () => {
        const order: string[] = []
        let putToken: string | undefined
        stub.onQuery((q) => {
            if (q.table === 'trainer_payment_accounts' && q.op === 'update') order.push('store')
            return undefined
        })
        h.asaasRequest.mockImplementation(async (o: AsaasReq) => {
            if (isGet(o)) return { data: [{ id: 'wh_1', url: TARGET_URL, enabled: true, interrupted: false, events: ALL_EVENTS }] }
            if (o.method === 'PUT') {
                order.push('put')
                putToken = o.body?.authToken as string
                return { id: 'wh_1' }
            }
            throw new Error(`unexpected ${o.method}`)
        })
        const res = await rotateSubaccountWebhook('sk-sub', TRAINER)
        expect(res).toEqual({ webhookId: 'wh_1', created: false })
        expect(order).toEqual(['store', 'put']) // store-before-write
        expect(putToken).toBeTruthy()
        expect(putToken).not.toBe(GLOBAL_TOKEN)
        const stored = updatePayloadHash(stub.calls('trainer_payment_accounts', 'update')[0])
        expect(stored).toBe(hashWebhookToken(putToken as string))
    })
})

describe('revertSubaccountToGlobal (rollback gated)', () => {
    it('PUTa o token GLOBAL ANTES de zerar o hash, e nunca omite o token', async () => {
        const order: string[] = []
        let putBody: Record<string, unknown> | undefined
        stub.onQuery((q) => {
            if (q.table === 'trainer_payment_accounts' && q.op === 'update' && updatePayloadHash(q) === null) order.push('clear-hash')
            return undefined
        })
        h.asaasRequest.mockImplementation(async (o: AsaasReq) => {
            if (isGet(o)) return { data: [{ id: 'wh_1', url: TARGET_URL }] }
            if (o.method === 'PUT') {
                order.push('put-global')
                putBody = o.body
                return { id: 'wh_1' }
            }
            throw new Error(`unexpected ${o.method}`)
        })
        const res = await revertSubaccountToGlobal('sk-sub', TRAINER)
        expect(res).toEqual({ webhookId: 'wh_1' })
        // Ordem invertida: global PRIMEIRO, zera DEPOIS (cobre a janela em qualquer chegada).
        expect(order).toEqual(['put-global', 'clear-hash'])
        expect(putBody?.authToken).toBe(GLOBAL_TOKEN) // explícito, nunca omite
    })

    it('lança se ASAAS_WEBHOOK_TOKEN faltar — não toca Asaas nem o hash (sem meio-rollback)', async () => {
        delete process.env.ASAAS_WEBHOOK_TOKEN
        await expect(revertSubaccountToGlobal('sk-sub', TRAINER)).rejects.toThrow(/ASAAS_WEBHOOK_TOKEN missing/)
        expect(h.asaasRequest).not.toHaveBeenCalled()
        expect(stub.calls('trainer_payment_accounts', 'update').length).toBe(0)
    })
})
