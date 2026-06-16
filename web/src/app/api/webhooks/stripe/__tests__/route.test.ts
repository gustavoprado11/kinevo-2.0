import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import {
    createSupabaseAdminStub,
    hasFilter,
    type SupabaseAdminStub,
} from '@/test/supabase-admin-stub'

// Holder mutável pro stub — factories de vi.mock são hoisted e não podem
// referenciar variáveis top-level; vi.hoisted resolve isso.
const h = vi.hoisted(() => ({
    stub: null as unknown as {
        from: (table: string) => unknown
        rpc: (fn: string, args?: unknown) => Promise<unknown>
    },
}))

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: (table: string) => h.stub.from(table),
        rpc: (fn: string, args?: unknown) => h.stub.rpc(fn, args),
    },
}))

vi.mock('@/lib/stripe', () => ({
    stripe: {
        webhooks: { constructEvent: vi.fn() },
        subscriptions: { retrieve: vi.fn() },
    },
}))

import { stripe } from '@/lib/stripe'
import { POST } from '../route'

const constructEventMock = vi.mocked(stripe.webhooks.constructEvent)
const retrieveMock = vi.mocked(stripe.subscriptions.retrieve)

const WEBHOOK_SECRET = 'whsec_test'
const TRAINER_ID = 'trainer-1'
const PERIOD_END_UNIX = 1_770_000_000
const PERIOD_END_ISO = new Date(PERIOD_END_UNIX * 1000).toISOString()
const PRICE_ID = 'price_test_123'

let stub: SupabaseAdminStub
let originalSecret: string | undefined

function makeRequest(body = 'raw-payload', signature: string | null = 't=1,v1=sig'): NextRequest {
    const headers: Record<string, string> = {}
    if (signature !== null) headers['stripe-signature'] = signature
    const init: RequestInit = { method: 'POST', headers, body }
    return new NextRequest('http://localhost/api/webhooks/stripe', init as any)
}

function stubEvent(type: string, object: Record<string, unknown>, id = 'evt_1'): Stripe.Event {
    return { id, type, data: { object } } as unknown as Stripe.Event
}

function stubSubscription(overrides: Record<string, unknown> = {}): Stripe.Response<Stripe.Subscription> {
    return {
        id: 'sub_1',
        status: 'active',
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: PERIOD_END_UNIX, price: { id: PRICE_ID } }] },
        ...overrides,
    } as unknown as Stripe.Response<Stripe.Subscription>
}

describe('POST /api/webhooks/stripe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stub = createSupabaseAdminStub()
        h.stub = stub
        originalSecret = process.env.STRIPE_WEBHOOK_SECRET
        process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    })

    afterEach(() => {
        if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
        else process.env.STRIPE_WEBHOOK_SECRET = originalSecret
    })

    describe('signature verification', () => {
        it('returns 400 when the stripe-signature header is missing', async () => {
            const res = await POST(makeRequest('body', null))
            expect(res.status).toBe(400)
            expect(constructEventMock).not.toHaveBeenCalled()
        })

        it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
            delete process.env.STRIPE_WEBHOOK_SECRET
            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
        })

        it('returns 400 when constructEvent rejects the signature', async () => {
            constructEventMock.mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature')
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(400)
            expect(stub.queries.length).toBe(0)
        })

        it('passes the raw body, signature and secret to constructEvent', async () => {
            constructEventMock.mockReturnValue(stubEvent('some.event', {}))
            await POST(makeRequest('the-raw-body', 'sig-header'))
            expect(constructEventMock).toHaveBeenCalledWith('the-raw-body', 'sig-header', WEBHOOK_SECRET)
        })
    })

    describe('idempotency', () => {
        it('stores the event id before processing', async () => {
            constructEventMock.mockReturnValue(stubEvent('some.event', {}, 'evt_77'))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            const inserts = stub.calls('webhook_events', 'insert')
            expect(inserts.length).toBe(1)
            expect(inserts[0].payload).toMatchObject({ event_id: 'evt_77', event_type: 'some.event' })
        })

        it('returns 200 and skips the handler on duplicate delivery (unique violation)', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', {
                mode: 'subscription', metadata: { trainer_id: TRAINER_ID }, subscription: 'sub_1',
            }))
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '23505', message: 'duplicate key' } }
                }
                return undefined
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.queries.length).toBe(1)
        })

        it('returns 500 when the idempotency store is unavailable so Stripe retries', async () => {
            constructEventMock.mockReturnValue(stubEvent('some.event', {}))
            stub.onQuery((q) => {
                if (q.table === 'webhook_events' && q.op === 'insert') {
                    return { error: { code: '08006', message: 'connection failure' } }
                }
                return undefined
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
        })
    })

    describe('checkout.session.completed', () => {
        it('retrieves the subscription and upserts it keyed by trainer_id', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', {
                mode: 'subscription',
                metadata: { trainer_id: TRAINER_ID },
                subscription: 'sub_1',
                customer: 'cus_1',
            }))
            retrieveMock.mockResolvedValue(stubSubscription())

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).toHaveBeenCalledWith('sub_1', { expand: ['items.data'] })

            const upserts = stub.calls('subscriptions', 'upsert')
            expect(upserts.length).toBe(1)
            expect(upserts[0].payload).toEqual({
                trainer_id: TRAINER_ID,
                stripe_customer_id: 'cus_1',
                stripe_subscription_id: 'sub_1',
                status: 'active',
                current_period_end: PERIOD_END_ISO,
                cancel_at_period_end: false,
                stripe_price_id: PRICE_ID,
            })
            expect(upserts[0].options).toEqual({ onConflict: 'trainer_id' })
        })

        it('skips the session when trainer_id metadata is missing', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', {
                mode: 'subscription', metadata: {}, subscription: 'sub_1',
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.calls('subscriptions').length).toBe(0)
        })

        it('skips the session when mode is payment (one-off)', async () => {
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', {
                mode: 'payment', metadata: { trainer_id: TRAINER_ID },
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
        })

        it('releases the idempotency row and returns 500 when the handler fails (clean Stripe retry)', async () => {
            // Handler falhando NÃO pode devolver 200 com o event_id já gravado:
            // o retry do Stripe pularia o evento para sempre. O handler desfaz
            // a linha de webhook_events e devolve 500 — mesmo padrão do
            // stripe-connect.
            constructEventMock.mockReturnValue(stubEvent('checkout.session.completed', {
                mode: 'subscription', metadata: { trainer_id: TRAINER_ID }, subscription: 'sub_1', customer: 'cus_1',
            }))
            retrieveMock.mockResolvedValue(stubSubscription())
            stub.onQuery((q) => {
                if (q.table === 'subscriptions' && q.op === 'upsert') {
                    return { error: { code: '23503', message: 'fk violation' } }
                }
                return undefined
            })
            const res = await POST(makeRequest())
            expect(res.status).toBe(500)
            const deletes = stub.calls('webhook_events', 'delete')
            expect(deletes.length).toBe(1)
            expect(hasFilter(deletes[0], 'eq', 'event_id', 'evt_1')).toBe(true)
        })
    })

    describe('invoice events', () => {
        it('payment_succeeded refreshes status and period end by stripe_subscription_id', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_succeeded', {
                parent: { subscription_details: { subscription: 'sub_2' } },
            }))
            retrieveMock.mockResolvedValue(stubSubscription({ id: 'sub_2' }))

            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).toHaveBeenCalledWith('sub_2', { expand: ['items.data'] })

            const updates = stub.calls('subscriptions', 'update')
            expect(updates.length).toBe(1)
            expect(updates[0].payload).toEqual({ status: 'active', current_period_end: PERIOD_END_ISO, stripe_price_id: PRICE_ID })
            expect(hasFilter(updates[0], 'eq', 'stripe_subscription_id', 'sub_2')).toBe(true)
        })

        it('payment_succeeded ignores invoices without a subscription', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_succeeded', {}))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()
            expect(stub.calls('subscriptions').length).toBe(0)
        })

        it('payment_failed marks the subscription past_due without calling Stripe', async () => {
            constructEventMock.mockReturnValue(stubEvent('invoice.payment_failed', {
                parent: { subscription_details: { subscription: 'sub_3' } },
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)
            expect(retrieveMock).not.toHaveBeenCalled()

            const updates = stub.calls('subscriptions', 'update')
            expect(updates[0].payload).toEqual({ status: 'past_due' })
            expect(hasFilter(updates[0], 'eq', 'stripe_subscription_id', 'sub_3')).toBe(true)
        })
    })

    describe('customer.subscription events', () => {
        it('subscription.updated syncs status, period end and cancel flag', async () => {
            constructEventMock.mockReturnValue(stubEvent('customer.subscription.updated', {
                id: 'sub_4',
                status: 'past_due',
                cancel_at_period_end: true,
                items: { data: [{ current_period_end: PERIOD_END_UNIX, price: { id: PRICE_ID } }] },
            }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const updates = stub.calls('subscriptions', 'update')
            expect(updates[0].payload).toEqual({
                status: 'past_due',
                current_period_end: PERIOD_END_ISO,
                cancel_at_period_end: true,
                stripe_price_id: PRICE_ID,
            })
            expect(hasFilter(updates[0], 'eq', 'stripe_subscription_id', 'sub_4')).toBe(true)
        })

        it('subscription.updated falls back to trial_end when there is no subscription item', async () => {
            const trialEnd = 1_780_000_000
            constructEventMock.mockReturnValue(stubEvent('customer.subscription.updated', {
                id: 'sub_trial',
                status: 'trialing',
                cancel_at_period_end: false,
                items: { data: [] },
                trial_end: trialEnd,
            }))
            await POST(makeRequest())
            const updates = stub.calls('subscriptions', 'update')
            expect(updates[0].payload).toMatchObject({
                current_period_end: new Date(trialEnd * 1000).toISOString(),
            })
        })

        it('subscription.deleted marks the subscription canceled', async () => {
            constructEventMock.mockReturnValue(stubEvent('customer.subscription.deleted', { id: 'sub_5' }))
            const res = await POST(makeRequest())
            expect(res.status).toBe(200)

            const updates = stub.calls('subscriptions', 'update')
            expect(updates[0].payload).toEqual({ status: 'canceled' })
            expect(hasFilter(updates[0], 'eq', 'stripe_subscription_id', 'sub_5')).toBe(true)
        })
    })

    it('returns 200 for unhandled event types', async () => {
        constructEventMock.mockReturnValue(stubEvent('charge.refunded', {}))
        const res = await POST(makeRequest())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ received: true })
        expect(stub.calls('subscriptions').length).toBe(0)
    })
})
