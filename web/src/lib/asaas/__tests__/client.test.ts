import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AsaasApiError, asaasRequest } from '../client'

const ORIGINAL_FETCH = globalThis.fetch

describe('asaasRequest', () => {
    beforeEach(() => {
        process.env.ASAAS_ENV = 'sandbox'
    })

    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH
        vi.restoreAllMocks()
    })

    it('builds sandbox URL with /v3 base and passes access_token', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ id: 'acc_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        )
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        const result = await asaasRequest<{ id: string }>({
            apiKey: 'TEST_KEY',
            path: '/accounts/foo',
        })

        expect(result.id).toBe('acc_1')
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://sandbox.asaas.com/api/v3/accounts/foo')
        const headers = init.headers as Record<string, string>
        expect(headers.access_token).toBe('TEST_KEY')
    })

    it('uses production URL when ASAAS_ENV=production', async () => {
        process.env.ASAAS_ENV = 'production'
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        await asaasRequest({ apiKey: 'K', path: '/x' })

        const [url] = fetchSpy.mock.calls[0] as unknown as [string]
        expect(url).toBe('https://api.asaas.com/v3/x')
    })

    it('strips an accidental leading /v3 from the path', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({}), { status: 200 })
        )
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        await asaasRequest({ apiKey: 'K', path: '/v3/payments' })

        const [url] = fetchSpy.mock.calls[0] as unknown as [string]
        expect(url).toBe('https://sandbox.asaas.com/api/v3/payments')
    })

    it('throws AsaasApiError on 4xx and exposes status + body', async () => {
        const errBody = { errors: [{ description: 'Invalid CPF', code: 'invalid_cpf' }] }
        globalThis.fetch = vi.fn(async () =>
            new Response(JSON.stringify(errBody), { status: 400, headers: { 'Content-Type': 'application/json' } })
        ) as unknown as typeof fetch

        await expect(asaasRequest({ apiKey: 'K', path: '/x' })).rejects.toMatchObject({
            name: 'AsaasApiError',
            status: 400,
        })
    })

    it('retries once on 5xx and succeeds on second attempt', async () => {
        let call = 0
        globalThis.fetch = vi.fn(async () => {
            call++
            if (call === 1) return new Response('{}', { status: 503 })
            return new Response(JSON.stringify({ ok: true }), { status: 200 })
        }) as unknown as typeof fetch

        const result = await asaasRequest<{ ok: boolean }>({ apiKey: 'K', path: '/x' })
        expect(result.ok).toBe(true)
        expect(call).toBe(2)
    })

    it('sends JSON body when body is provided and sets Content-Type', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ id: '1' }), { status: 200 })
        )
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        await asaasRequest({
            apiKey: 'K',
            path: '/customers',
            body: { name: 'Test' },
        })

        const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
        expect(init.method).toBe('POST')
        expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        expect(init.body).toBe(JSON.stringify({ name: 'Test' }))
    })

    it('attaches Asaas-Idempotency-Key when provided', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({}), { status: 200 })
        )
        globalThis.fetch = fetchSpy as unknown as typeof fetch

        await asaasRequest({
            apiKey: 'K',
            path: '/payments',
            body: {},
            idempotencyKey: 'k-1',
        })

        const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
        expect((init.headers as Record<string, string>)['Asaas-Idempotency-Key']).toBe('k-1')
    })

    it('AsaasApiError extracts message from errors array', () => {
        const err = new AsaasApiError(400, { errors: [{ description: 'Boom' }] })
        expect(err.message).toBe('Boom')
        expect(err.status).toBe(400)
    })

    it('AsaasApiError falls back to generic message on unknown body', () => {
        const err = new AsaasApiError(500, 'unparseable')
        expect(err.message).toContain('500')
    })
})
