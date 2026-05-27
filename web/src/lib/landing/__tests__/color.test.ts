import { describe, it, expect } from 'vitest'
import { hexToRgb, mix, rgba } from '../color'

describe('hexToRgb', () => {
    it('parses 6-digit hex', () => {
        expect(hexToRgb('#7C3AED')).toEqual([0x7C, 0x3A, 0xED])
    })

    it('parses hex without leading #', () => {
        expect(hexToRgb('FFFFFF')).toEqual([255, 255, 255])
    })

    it('handles black', () => {
        expect(hexToRgb('#000000')).toEqual([0, 0, 0])
    })

    it('handles single-byte values that need zero-padding interpretation', () => {
        // 0F = 15 — não 0xF0
        expect(hexToRgb('#0F0F0F')).toEqual([15, 15, 15])
    })
})

describe('mix', () => {
    it('returns the start color at t=0', () => {
        expect(mix('#7C3AED', '#000000', 0).toLowerCase()).toBe('#7c3aed')
    })

    it('returns the target color at t=1', () => {
        expect(mix('#7C3AED', '#000000', 1)).toBe('#000000')
    })

    it('darkens to roughly half at t=0.5 toward black', () => {
        const out = mix('#7C3AED', '#000000', 0.5)
        const [r, g, b] = hexToRgb(out)
        // 0x7C/2 = 62, 0x3A/2 = 29, 0xED/2 = 118.5 (arredonda pra 119).
        // Tolerância ±1 cobre Math.round em qualquer direção.
        expect(Math.abs(r - 62)).toBeLessThanOrEqual(1)
        expect(Math.abs(g - 29)).toBeLessThanOrEqual(1)
        expect(Math.abs(b - 119)).toBeLessThanOrEqual(1)
    })

    it('matches the landing brand-dark recipe (t=0.32)', () => {
        // Garantia de regressão: tom usado no logo gradient e hover do CTA.
        const dark = mix('#F97316', '#000000', 0.32)
        expect(dark).toMatch(/^#[0-9a-f]{6}$/)
        const [r] = hexToRgb(dark)
        // Original R = 0xF9 (249). Após 32% pra preto: 249*0.68 ≈ 169.
        expect(r).toBeCloseTo(169, 0)
    })

    it('always outputs 7-char hex string', () => {
        for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
            const out = mix('#0000FF', '#FFFFFF', t)
            expect(out).toMatch(/^#[0-9a-f]{6}$/)
            expect(out.length).toBe(7)
        }
    })
})

describe('rgba', () => {
    it('formats with given alpha', () => {
        expect(rgba('#7C3AED', 0.1)).toBe('rgba(124,58,237,0.1)')
    })

    it('handles alpha=0', () => {
        expect(rgba('#FFFFFF', 0)).toBe('rgba(255,255,255,0)')
    })

    it('handles alpha=1', () => {
        expect(rgba('#000000', 1)).toBe('rgba(0,0,0,1)')
    })
})
