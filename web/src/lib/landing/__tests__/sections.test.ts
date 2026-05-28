import { describe, it, expect } from 'vitest'
import { isSectionVisible, LANDING_SECTION_DEFS } from '../sections'

describe('isSectionVisible', () => {
    it('visível quando sections é null (default backward-compat)', () => {
        expect(isSectionVisible(null, 'faq')).toBe(true)
    })

    it('visível quando sections é {} (trainer existente)', () => {
        expect(isSectionVisible({}, 'metodo')).toBe(true)
    })

    it('visível quando chave ausente', () => {
        expect(isSectionVisible({ faq: false }, 'metodo')).toBe(true)
    })

    it('visível quando explicitamente true', () => {
        expect(isSectionVisible({ planos: true }, 'planos')).toBe(true)
    })

    it('escondido apenas quando explicitamente false', () => {
        expect(isSectionVisible({ planos: false }, 'planos')).toBe(false)
    })
})

describe('LANDING_SECTION_DEFS', () => {
    it('tem 7 seções togláveis com chaves únicas', () => {
        const keys = LANDING_SECTION_DEFS.map((s) => s.key)
        expect(keys.length).toBe(7)
        expect(new Set(keys).size).toBe(7)
    })

    it('não inclui hero/form/footer (espinha dorsal)', () => {
        const keys = LANDING_SECTION_DEFS.map((s) => s.key) as string[]
        expect(keys).not.toContain('hero')
        expect(keys).not.toContain('form')
        expect(keys).not.toContain('footer')
    })
})
