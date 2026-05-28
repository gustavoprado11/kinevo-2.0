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

describe('LANDING_SCHEMA — conteúdo rico (Fase 1)', () => {
    it('aceita stats válidos', () => {
        const r = LANDING_SCHEMA.safeParse({
            stats: { students_count: 200, rating: 4.9, reviews_count: 48 },
        })
        expect(r.success).toBe(true)
    })

    it('rejeita rating acima de 5', () => {
        const r = LANDING_SCHEMA.safeParse({ stats: { rating: 5.5 } })
        expect(r.success).toBe(false)
    })

    it('aceita stats com campos nulos (limpar)', () => {
        const r = LANDING_SCHEMA.safeParse({
            stats: { students_count: null, rating: null, reviews_count: null },
        })
        expect(r.success).toBe(true)
    })

    it('aceita depoimento mínimo (name + quote)', () => {
        const r = LANDING_SCHEMA.safeParse({
            testimonials: [{ name: 'Ana', quote: 'Mudou minha rotina.' }],
        })
        expect(r.success).toBe(true)
    })

    it('rejeita depoimento sem quote', () => {
        const r = LANDING_SCHEMA.safeParse({ testimonials: [{ name: 'Ana', quote: '' }] })
        expect(r.success).toBe(false)
    })

    it('rejeita mais de 6 depoimentos', () => {
        const r = LANDING_SCHEMA.safeParse({
            testimonials: Array.from({ length: 7 }, () => ({ name: 'X', quote: 'Y' })),
        })
        expect(r.success).toBe(false)
    })

    it('rejeita photo_url inválida no depoimento', () => {
        const r = LANDING_SCHEMA.safeParse({
            testimonials: [{ name: 'Ana', quote: 'Top', photo_url: 'not-a-url' }],
        })
        expect(r.success).toBe(false)
    })

    it('aceita FAQ válido', () => {
        const r = LANDING_SCHEMA.safeParse({
            faq: [{ question: 'Quanto custa?', answer: 'A partir de R$ 350.' }],
        })
        expect(r.success).toBe(true)
    })

    it('rejeita FAQ sem resposta', () => {
        const r = LANDING_SCHEMA.safeParse({ faq: [{ question: 'Oi?', answer: '' }] })
        expect(r.success).toBe(false)
    })

    it('rejeita mais de 10 itens de FAQ', () => {
        const r = LANDING_SCHEMA.safeParse({
            faq: Array.from({ length: 11 }, () => ({ question: 'Q', answer: 'A' })),
        })
        expect(r.success).toBe(false)
    })
})

describe('LANDING_SCHEMA — planos (Fase 2)', () => {
    const plan = { name: 'Mensal', price: 'R$ 350', features: ['3 treinos/semana'] }

    it('aceita plano mínimo (name + price + features)', () => {
        const r = LANDING_SCHEMA.safeParse({ plans: [plan] })
        expect(r.success).toBe(true)
    })

    it('aceita plano completo com period e highlight', () => {
        const r = LANDING_SCHEMA.safeParse({
            plans: [{ ...plan, period: '/mês', highlight: true }],
        })
        expect(r.success).toBe(true)
    })

    it('aceita features vazio', () => {
        const r = LANDING_SCHEMA.safeParse({ plans: [{ name: 'X', price: 'Y', features: [] }] })
        expect(r.success).toBe(true)
    })

    it('rejeita plano sem nome', () => {
        const r = LANDING_SCHEMA.safeParse({ plans: [{ name: '', price: 'R$ 1', features: [] }] })
        expect(r.success).toBe(false)
    })

    it('rejeita plano sem preço', () => {
        const r = LANDING_SCHEMA.safeParse({ plans: [{ name: 'X', price: '', features: [] }] })
        expect(r.success).toBe(false)
    })

    it('rejeita mais de 4 planos', () => {
        const r = LANDING_SCHEMA.safeParse({
            plans: Array.from({ length: 5 }, () => plan),
        })
        expect(r.success).toBe(false)
    })

    it('rejeita mais de 10 features num plano', () => {
        const r = LANDING_SCHEMA.safeParse({
            plans: [{ name: 'X', price: 'Y', features: Array.from({ length: 11 }, () => 'f') }],
        })
        expect(r.success).toBe(false)
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
