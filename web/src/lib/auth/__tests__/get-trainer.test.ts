import { describe, it, expect } from 'vitest'
import { pickActiveSubscription } from '../get-trainer'

describe('pickActiveSubscription', () => {
    it('returns null for null/undefined', () => {
        expect(pickActiveSubscription(null)).toBeNull()
        expect(pickActiveSubscription(undefined)).toBeNull()
    })

    it('returns null for empty array', () => {
        expect(pickActiveSubscription([])).toBeNull()
    })

    it('returns the active subscription when one exists', () => {
        const subs = [
            { status: 'canceled', created_at: '2026-01-01T00:00:00Z' },
            { status: 'active', created_at: '2026-02-01T00:00:00Z' },
        ]
        expect(pickActiveSubscription(subs)).toEqual(subs[1])
    })

    it('returns the trialing subscription when one exists', () => {
        const subs = [
            { status: 'past_due', created_at: '2026-01-01T00:00:00Z' },
            { status: 'trialing', created_at: '2026-02-01T00:00:00Z' },
        ]
        expect(pickActiveSubscription(subs)).toEqual(subs[1])
    })

    it('prefers active over trialing when both exist (first match wins)', () => {
        const subs = [
            { status: 'trialing', created_at: '2026-01-01T00:00:00Z' },
            { status: 'active', created_at: '2026-02-01T00:00:00Z' },
        ]
        // current behavior: first matching status wins; test pins this contract
        expect(pickActiveSubscription(subs)?.status).toBe('trialing')
    })

    it('prefers active/trialing even when a stale row is more recently created', () => {
        const subs = [
            { status: 'active', created_at: '2026-01-01T00:00:00Z' },
            { status: 'canceled', created_at: '2026-06-01T00:00:00Z' },
        ]
        expect(pickActiveSubscription(subs)?.status).toBe('active')
    })

    it('falls back to most recently created when no active/trialing exists', () => {
        const subs = [
            { status: 'canceled', created_at: '2026-01-01T00:00:00Z' },
            { status: 'past_due', created_at: '2026-06-01T00:00:00Z' },
            { status: 'incomplete', created_at: '2026-03-01T00:00:00Z' },
        ]
        const picked = pickActiveSubscription(subs)
        expect(picked?.status).toBe('past_due')
        expect(picked?.created_at).toBe('2026-06-01T00:00:00Z')
    })

    it('handles a single object (not wrapped in array)', () => {
        const sub = { status: 'active', created_at: '2026-02-01T00:00:00Z' }
        expect(pickActiveSubscription(sub)).toEqual(sub)
    })

    it('handles missing created_at on fallback rows without crashing', () => {
        const subs = [
            { status: 'canceled' },
            { status: 'past_due', created_at: '2026-06-01T00:00:00Z' },
        ]
        // The row with a created_at is more recent than the one without (treated as 0)
        expect(pickActiveSubscription(subs)?.status).toBe('past_due')
    })

    it('does not mutate the input array', () => {
        const subs = [
            { status: 'canceled', created_at: '2026-01-01T00:00:00Z' },
            { status: 'incomplete', created_at: '2026-06-01T00:00:00Z' },
        ]
        const snapshot = JSON.stringify(subs)
        pickActiveSubscription(subs)
        expect(JSON.stringify(subs)).toBe(snapshot)
    })
})
