import { describe, it, expect, vi, afterEach } from 'vitest'
import { isTurnstileEnabled, verifyTurnstileToken } from '../turnstile'

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    delete process.env.TURNSTILE_SECRET_KEY
    vi.restoreAllMocks()
})

describe('isTurnstileEnabled', () => {
    it('returns false when TURNSTILE_SECRET_KEY is unset', () => {
        delete process.env.TURNSTILE_SECRET_KEY
        expect(isTurnstileEnabled()).toBe(false)
    })

    it('returns true when TURNSTILE_SECRET_KEY is set', () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        expect(isTurnstileEnabled()).toBe(true)
    })
})

describe('verifyTurnstileToken — graceful degrade', () => {
    it('returns ok+disabled when secret key is missing (no network call)', async () => {
        delete process.env.TURNSTILE_SECRET_KEY
        globalThis.fetch = vi.fn(() => {
            throw new Error('network must not be hit when disabled')
        }) as any
        const r = await verifyTurnstileToken('any-token')
        expect(r.ok).toBe(true)
        expect(r.disabled).toBe(true)
    })

    it('returns ok+disabled even with empty token when disabled', async () => {
        delete process.env.TURNSTILE_SECRET_KEY
        const r = await verifyTurnstileToken('')
        expect(r.ok).toBe(true)
        expect(r.disabled).toBe(true)
    })
})

describe('verifyTurnstileToken — enforced mode', () => {
    it('rejects when token is missing', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        const r = await verifyTurnstileToken('')
        expect(r.ok).toBe(false)
        expect(r.error).toMatch(/robô/i)
    })

    it('rejects when token is null', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        const r = await verifyTurnstileToken(null)
        expect(r.ok).toBe(false)
    })

    it('passes when Cloudflare returns success: true', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify({ success: true }), { status: 200 })
        }) as any
        const r = await verifyTurnstileToken('a-valid-token')
        expect(r.ok).toBe(true)
        expect(r.disabled).toBeFalsy()
    })

    it('rejects when Cloudflare returns success: false', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        globalThis.fetch = vi.fn(async () => {
            return new Response(
                JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }),
                { status: 200 }
            )
        }) as any
        const r = await verifyTurnstileToken('a-bad-token')
        expect(r.ok).toBe(false)
        expect(r.error).toBeTruthy()
    })

    it('fails CLOSED on non-OK HTTP status', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        globalThis.fetch = vi.fn(async () => {
            return new Response('upstream error', { status: 502 })
        }) as any
        const r = await verifyTurnstileToken('a-token')
        expect(r.ok).toBe(false)
    })

    it('fails CLOSED on network error', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        globalThis.fetch = vi.fn(async () => {
            throw new Error('boom')
        }) as any
        const r = await verifyTurnstileToken('a-token')
        expect(r.ok).toBe(false)
    })

    it('passes the remoteip param when provided', async () => {
        process.env.TURNSTILE_SECRET_KEY = 'fake-secret'
        const fetchMock = vi.fn(async (_url: any, opts: any) => {
            const body = String(opts?.body || '')
            expect(body).toContain('remoteip=10.0.0.1')
            return new Response(JSON.stringify({ success: true }), { status: 200 })
        })
        globalThis.fetch = fetchMock as any
        const r = await verifyTurnstileToken('a-token', '10.0.0.1')
        expect(r.ok).toBe(true)
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
