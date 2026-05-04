import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkPasswordPwned } from '../hibp-check'

const ORIGINAL_FETCH = globalThis.fetch

describe('checkPasswordPwned — bundled common-password blocklist', () => {
    beforeEach(() => {
        // The bundled blocklist runs before any network call; mock fetch
        // so we don't accidentally hit HIBP when running these.
        globalThis.fetch = vi.fn(() => {
            throw new Error('network must not be hit when bundled list matches')
        }) as any
    })
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH
    })

    it('rejects "123456"', async () => {
        const r = await checkPasswordPwned('123456')
        expect(r.safe).toBe(false)
        expect(r.error).toMatch(/comum/i)
    })

    it('rejects "password" (English)', async () => {
        const r = await checkPasswordPwned('password')
        expect(r.safe).toBe(false)
    })

    it('rejects "senha123" (PT-BR)', async () => {
        const r = await checkPasswordPwned('senha123')
        expect(r.safe).toBe(false)
    })

    it('rejects case variations of common passwords', async () => {
        const r = await checkPasswordPwned('PASSWORD')
        expect(r.safe).toBe(false)
    })

    it('rejects empty password with friendly error', async () => {
        const r = await checkPasswordPwned('')
        expect(r.safe).toBe(false)
        expect(r.error).toBeTruthy()
    })
})

describe('checkPasswordPwned — HIBP API integration', () => {
    afterEach(() => {
        globalThis.fetch = ORIGINAL_FETCH
        vi.restoreAllMocks()
    })

    it('rejects when HIBP returns the password hash suffix with count > 0', async () => {
        // SHA1 of 'TestPwn99!' (a non-common password we'll fake as breached)
        const sha1 = (await import('crypto'))
            .createHash('sha1').update('TestPwn99!').digest('hex').toUpperCase()
        const prefix = sha1.slice(0, 5)
        const suffix = sha1.slice(5)

        globalThis.fetch = vi.fn(async (url: any) => {
            expect(String(url)).toContain(prefix)
            return new Response(`${suffix}:42\nFAKEHASH:1`, { status: 200 })
        }) as any

        const r = await checkPasswordPwned('TestPwn99!')
        expect(r.safe).toBe(false)
        expect(r.pwnCount).toBe(42)
        expect(r.error).toMatch(/vazamento/i)
    })

    it('passes when HIBP returns suffix with count=0 (padding entry)', async () => {
        const sha1 = (await import('crypto'))
            .createHash('sha1').update('UniqueSafePassword!2026').digest('hex').toUpperCase()
        const suffix = sha1.slice(5)

        globalThis.fetch = vi.fn(async () => {
            return new Response(`${suffix}:0\nOTHER:5`, { status: 200 })
        }) as any

        const r = await checkPasswordPwned('UniqueSafePassword!2026')
        expect(r.safe).toBe(true)
    })

    it('passes when the suffix is not in the response', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response('AAAAA:1\nBBBBB:2', { status: 200 })
        }) as any

        const r = await checkPasswordPwned('NeverBreachedPassword2026!')
        expect(r.safe).toBe(true)
    })

    it('fails open on HIBP non-OK response', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response('rate limited', { status: 429 })
        }) as any

        const r = await checkPasswordPwned('SomeRandomPassword!')
        expect(r.safe).toBe(true) // fail-open
    })

    it('fails open on network error', async () => {
        globalThis.fetch = vi.fn(async () => {
            throw new Error('boom')
        }) as any

        const r = await checkPasswordPwned('SomeRandomPassword!')
        expect(r.safe).toBe(true) // fail-open
    })
})
