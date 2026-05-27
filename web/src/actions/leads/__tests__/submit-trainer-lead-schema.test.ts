import { describe, it, expect } from 'vitest'
import { LEAD_SCHEMA } from '../lead-schema'

describe('LEAD_SCHEMA', () => {
    const valid = {
        slug: 'gustavo-prado',
        name: 'Ana Silva',
        email: 'ana@example.com',
        whatsapp: '31999064997',
    }

    it('aceita payload mínimo válido', () => {
        const r = LEAD_SCHEMA.safeParse(valid)
        expect(r.success).toBe(true)
    })

    it('aceita payload completo com goal/level/message', () => {
        const r = LEAD_SCHEMA.safeParse({
            ...valid,
            goal: 'Hipertrofia',
            level: 'Iniciante',
            message: 'Quero treinar 3x/semana',
        })
        expect(r.success).toBe(true)
    })

    it('rejeita name vazio', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, name: ' ' })
        expect(r.success).toBe(false)
    })

    it('rejeita name com 1 caractere', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, name: 'A' })
        expect(r.success).toBe(false)
    })

    it('rejeita email inválido', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, email: 'not-an-email' })
        expect(r.success).toBe(false)
    })

    it('rejeita slug com menos de 3 chars', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, slug: 'ab' })
        expect(r.success).toBe(false)
    })

    it('rejeita whatsapp menor que 8 caracteres', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, whatsapp: '123' })
        expect(r.success).toBe(false)
    })

    it('aceita whatsapp com máscara visual (parênteses/hífen)', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, whatsapp: '(31) 9 9906-4997' })
        expect(r.success).toBe(true)
    })

    it('aceita honeypot vazio', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, hp: '' })
        expect(r.success).toBe(true)
    })

    it('rejeita message acima de 1000 chars', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, message: 'x'.repeat(1001) })
        expect(r.success).toBe(false)
    })

    it('trim do nome é aplicado', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, name: '  Ana Silva  ' })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.name).toBe('Ana Silva')
    })

    it('aceita goal e level como null explícito', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, goal: null, level: null })
        expect(r.success).toBe(true)
    })

    it('rejeita name acima de 100 chars', () => {
        const r = LEAD_SCHEMA.safeParse({ ...valid, name: 'x'.repeat(101) })
        expect(r.success).toBe(false)
    })

    it('rejeita email acima de 200 chars', () => {
        const long = 'a'.repeat(195) + '@x.io' // 200 chars
        const r = LEAD_SCHEMA.safeParse({ ...valid, email: long + 'a' }) // 201
        expect(r.success).toBe(false)
    })
})
