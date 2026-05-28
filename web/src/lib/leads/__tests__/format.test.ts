import { describe, it, expect } from 'vitest'
import { relativeTime, whatsappLink } from '../format'

describe('relativeTime', () => {
    const NOW = new Date('2026-05-27T12:00:00.000Z').getTime()

    it('returns "agora" for < 1 min', () => {
        const iso = new Date(NOW - 30_000).toISOString() // 30s ago
        expect(relativeTime(iso, NOW)).toBe('agora')
    })

    it('returns "agora" for future dates (clock skew safety)', () => {
        const iso = new Date(NOW + 5 * 60_000).toISOString()
        expect(relativeTime(iso, NOW)).toBe('agora')
    })

    it('returns "há N min" between 1 min and 1 hour', () => {
        const iso = new Date(NOW - 23 * 60_000).toISOString()
        expect(relativeTime(iso, NOW)).toBe('há 23 min')
    })

    it('boundary: 60 min becomes "há 1h"', () => {
        const iso = new Date(NOW - 60 * 60_000).toISOString()
        expect(relativeTime(iso, NOW)).toBe('há 1h')
    })

    it('returns "há Nh" between 1h and 24h', () => {
        const iso = new Date(NOW - 5 * 60 * 60_000).toISOString()
        expect(relativeTime(iso, NOW)).toBe('há 5h')
    })

    it('returns "há Nd" between 1d and 7d', () => {
        const iso = new Date(NOW - 3 * 24 * 60 * 60_000).toISOString()
        expect(relativeTime(iso, NOW)).toBe('há 3d')
    })

    it('falls back to short date format past 7 days', () => {
        const iso = new Date(NOW - 30 * 24 * 60 * 60_000).toISOString()
        const out = relativeTime(iso, NOW)
        // Formato pt-BR varia ("27 abr" vs "27 de abr.") — só garantimos que
        // tem dia e abreviação de mês.
        expect(out).toMatch(/\d{1,2}/)
        expect(out).not.toMatch(/há/)
    })
})

describe('whatsappLink', () => {
    it('preserves 11-digit number prefixing with 55', () => {
        const url = whatsappLink('31999064997', 'Ana')
        expect(url).toContain('https://wa.me/5531999064997')
    })

    it('preserves 10-digit (landline) prefixing with 55', () => {
        const url = whatsappLink('3133334444', 'Ana')
        expect(url).toContain('https://wa.me/553133334444')
    })

    it('strips non-digits before counting', () => {
        const url = whatsappLink('(31) 9 9906-4997', 'Ana')
        expect(url).toContain('https://wa.me/5531999064997')
    })

    it('does not double-prefix 55 when already 12 digits (with DDI)', () => {
        const url = whatsappLink('5531999064997', 'Ana')
        expect(url).toContain('https://wa.me/5531999064997')
    })

    it('includes URL-encoded greeting with first name', () => {
        const url = whatsappLink('31999064997', 'Ana')
        // "Olá, Ana!" precisa estar codificado no text=
        expect(url).toContain('text=Ol%C3%A1%2C%20Ana')
    })

    it('preserves names with accent', () => {
        const url = whatsappLink('31999064997', 'João')
        // "João" encodado = "Jo%C3%A3o"
        expect(url).toContain('Jo%C3%A3o')
    })
})
