import { describe, it, expect } from 'vitest'
import { redactSensitive, REDACTED } from './redact'

/**
 * S6/L2 (auditoria 2026-06-22): credenciais (senha do convert_lead) e segredos NUNCA
 * podem ser persistidos em texto puro no histórico/traces. redactSensitive redige o
 * VALOR das chaves sensíveis preservando o resto da estrutura.
 */
describe('redactSensitive', () => {
    it('redige o credentials do convert_lead (cenário real S6)', () => {
        const result = {
            student_id: 'abc',
            already_existed: false,
            credentials: { name: 'Aluno', login: 'aluno1', password: 'pw' },
            message: 'Aluno criado.',
        }
        const safe = redactSensitive(result) as typeof result
        expect(safe.credentials).toBe(REDACTED)
        // resto intacto
        expect(safe.student_id).toBe('abc')
        expect(safe.message).toBe('Aluno criado.')
        // não muta o original
        expect(result.credentials).toEqual({ name: 'Aluno', login: 'aluno1', password: 'pw' })
    })

    it('redige chaves sensíveis aninhadas (password/token/secret) em qualquer nível', () => {
        const safe = redactSensitive({
            a: { b: { password: 'p', token: 't', ok: 1 } },
            list: [{ secret: 's' }, { keep: 'v' }],
            access_token: 'x',
        }) as Record<string, unknown>
        const a = (safe.a as { b: Record<string, unknown> }).b
        expect(a.password).toBe(REDACTED)
        expect(a.token).toBe(REDACTED)
        expect(a.ok).toBe(1)
        const list = safe.list as Array<Record<string, unknown>>
        expect(list[0].secret).toBe(REDACTED)
        expect(list[1].keep).toBe('v')
        expect(safe.access_token).toBe(REDACTED)
    })

    it('é case-insensitive nas chaves (Password, SENHA)', () => {
        const safe = redactSensitive({ Password: 'a', SENHA: 'b', Nome: 'c' }) as Record<string, unknown>
        expect(safe.Password).toBe(REDACTED)
        expect(safe.SENHA).toBe(REDACTED)
        expect(safe.Nome).toBe('c')
    })

    it('passa não-objetos e resultados sem segredo intactos', () => {
        expect(redactSensitive(null)).toBeNull()
        expect(redactSensitive('texto')).toBe('texto')
        expect(redactSensitive(42)).toBe(42)
        const clean = { message: 'ok', count: 3, items: ['a', 'b'] }
        expect(redactSensitive(clean)).toEqual(clean)
    })

    it('não estoura em estrutura muito profunda (depth guard)', () => {
        let deep: Record<string, unknown> = { password: 'x' }
        for (let i = 0; i < 50; i++) deep = { nested: deep }
        expect(() => redactSensitive(deep)).not.toThrow()
    })
})
