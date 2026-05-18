import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseWebhookEvent, verifyWebhookSecret } from '../webhook'

describe('verifyWebhookSecret', () => {
    let originalToken: string | undefined

    beforeEach(() => {
        originalToken = process.env.ASAAS_WEBHOOK_TOKEN
    })
    afterEach(() => {
        if (originalToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN
        else process.env.ASAAS_WEBHOOK_TOKEN = originalToken
    })

    it('returns true when header matches token exactly', () => {
        process.env.ASAAS_WEBHOOK_TOKEN = 'shhh-secret'
        expect(verifyWebhookSecret('shhh-secret')).toBe(true)
    })

    it('returns false on mismatch (even single char diff)', () => {
        process.env.ASAAS_WEBHOOK_TOKEN = 'shhh-secret'
        expect(verifyWebhookSecret('shhh-secrex')).toBe(false)
    })

    it('returns false when header is missing/empty/null', () => {
        process.env.ASAAS_WEBHOOK_TOKEN = 'x'
        expect(verifyWebhookSecret(null)).toBe(false)
        expect(verifyWebhookSecret(undefined)).toBe(false)
        expect(verifyWebhookSecret('')).toBe(false)
    })

    it('returns false when ASAAS_WEBHOOK_TOKEN is not set (fail closed)', () => {
        delete process.env.ASAAS_WEBHOOK_TOKEN
        expect(verifyWebhookSecret('anything')).toBe(false)
    })

    it('compares in constant time (same length, different content)', () => {
        process.env.ASAAS_WEBHOOK_TOKEN = 'abcdefgh'
        // We can't easily assert "constant time" in JS, but smoke-test correctness:
        expect(verifyWebhookSecret('zzzzzzzz')).toBe(false)
        expect(verifyWebhookSecret('abcdefgh')).toBe(true)
    })
})

describe('parseWebhookEvent', () => {
    it('accepts a well-formed event', () => {
        const ev = parseWebhookEvent({
            id: 'evt_1',
            event: 'PAYMENT_RECEIVED',
            dateCreated: '2026-05-15T10:00:00Z',
            payment: { id: 'pay_1', value: 100 },
        })
        expect(ev.id).toBe('evt_1')
        expect(ev.event).toBe('PAYMENT_RECEIVED')
    })

    it('rejects when id is missing', () => {
        expect(() => parseWebhookEvent({ event: 'X' })).toThrow()
    })

    it('rejects when body is not an object', () => {
        expect(() => parseWebhookEvent(null)).toThrow()
        expect(() => parseWebhookEvent('string')).toThrow()
        expect(() => parseWebhookEvent(42)).toThrow()
    })
})
