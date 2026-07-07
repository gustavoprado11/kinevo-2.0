import { describe, it, expect, afterEach } from 'vitest'
import { isAssistantDisabled, ASSISTANT_MAINTENANCE_MESSAGE } from './kill-switch'

const original = process.env.ASSISTANT_DISABLED

afterEach(() => {
    if (original === undefined) delete process.env.ASSISTANT_DISABLED
    else process.env.ASSISTANT_DISABLED = original
})

describe('kill-switch — isAssistantDisabled', () => {
    it('desligado por padrão (env ausente)', () => {
        delete process.env.ASSISTANT_DISABLED
        expect(isAssistantDisabled()).toBe(false)
    })

    it('ASSISTANT_DISABLED=1 → desabilitado', () => {
        process.env.ASSISTANT_DISABLED = '1'
        expect(isAssistantDisabled()).toBe(true)
    })

    it('fail-safe: qualquer valor ≠ "1" mantém LIGADO (não derruba por env malformada)', () => {
        for (const v of ['0', 'true', 'yes', 'on', 'disabled', ' 1', '1 ', '']) {
            process.env.ASSISTANT_DISABLED = v
            expect(isAssistantDisabled(), `valor ${JSON.stringify(v)} não pode desabilitar`).toBe(false)
        }
    })

    it('mensagem de manutenção é amigável e não vaza detalhe técnico', () => {
        expect(ASSISTANT_MAINTENANCE_MESSAGE).toMatch(/manuten/i)
        expect(ASSISTANT_MAINTENANCE_MESSAGE.toLowerCase()).not.toMatch(/error|null|undefined|500/)
    })
})
