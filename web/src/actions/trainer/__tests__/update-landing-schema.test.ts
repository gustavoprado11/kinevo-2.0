import { describe, it, expect } from 'vitest'
import { LANDING_SCHEMA, emptyToNull } from '../landing-schema'

describe('LANDING_SCHEMA', () => {
    it('aceita payload vazio (rascunho)', () => {
        const r = LANDING_SCHEMA.safeParse({})
        expect(r.success).toBe(true)
    })

    it('aceita todos os campos preenchidos', () => {
        const r = LANDING_SCHEMA.safeParse({
            headline: 'Treine com método.',
            subheadline: 'Sem desculpa.',
            bio: 'Há 8 anos transformo o treino em parte da rotina.',
            city: 'Belo Horizonte',
            cref: '123456-G/MG',
            certifications: ['Pós em Fisiologia', 'Curso X'],
            specializations: ['Hipertrofia', 'Mobilidade'],
            yearStarted: 2018,
            priceLabel: 'A partir de R$ 350/mês',
        })
        expect(r.success).toBe(true)
    })

    it('rejeita headline acima de 200 chars', () => {
        const r = LANDING_SCHEMA.safeParse({ headline: 'x'.repeat(201) })
        expect(r.success).toBe(false)
    })

    it('rejeita bio acima de 800 chars', () => {
        const r = LANDING_SCHEMA.safeParse({ bio: 'x'.repeat(801) })
        expect(r.success).toBe(false)
    })

    it('rejeita yearStarted antes de 1970', () => {
        const r = LANDING_SCHEMA.safeParse({ yearStarted: 1969 })
        expect(r.success).toBe(false)
    })

    it('rejeita yearStarted no futuro', () => {
        const next = new Date().getFullYear() + 1
        const r = LANDING_SCHEMA.safeParse({ yearStarted: next })
        expect(r.success).toBe(false)
    })

    it('aceita yearStarted no ano corrente', () => {
        const r = LANDING_SCHEMA.safeParse({ yearStarted: new Date().getFullYear() })
        expect(r.success).toBe(true)
    })

    it('rejeita mais de 8 certifications', () => {
        const r = LANDING_SCHEMA.safeParse({
            certifications: Array.from({ length: 9 }, (_, i) => `Cert ${i}`),
        })
        expect(r.success).toBe(false)
    })

    it('rejeita mais de 8 specializations', () => {
        const r = LANDING_SCHEMA.safeParse({
            specializations: Array.from({ length: 9 }, (_, i) => `Spec ${i}`),
        })
        expect(r.success).toBe(false)
    })

    it('rejeita certificação string vazia', () => {
        const r = LANDING_SCHEMA.safeParse({ certifications: ['Ok', ''] })
        expect(r.success).toBe(false)
    })

    it('aceita arrays vazios (limpar)', () => {
        const r = LANDING_SCHEMA.safeParse({ certifications: [], specializations: [] })
        expect(r.success).toBe(true)
    })

    it('trim aplicado nos textos', () => {
        const r = LANDING_SCHEMA.safeParse({ headline: '  Treine.  ' })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.headline).toBe('Treine.')
    })
})

describe('emptyToNull', () => {
    it('retorna null pra undefined', () => {
        expect(emptyToNull(undefined)).toBeNull()
    })

    it('retorna null pra null', () => {
        expect(emptyToNull(null)).toBeNull()
    })

    it('retorna null pra string vazia', () => {
        expect(emptyToNull('')).toBeNull()
    })

    it('retorna null pra whitespace puro', () => {
        expect(emptyToNull('   \t\n')).toBeNull()
    })

    it('retorna string trimada quando tem conteúdo', () => {
        expect(emptyToNull('  hello  ')).toBe('hello')
    })

    it('preserva acentos/unicode', () => {
        expect(emptyToNull('João')).toBe('João')
    })
})
