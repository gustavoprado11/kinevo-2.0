import { describe, it, expect } from 'vitest'
import { buildWinbackContextBlock, type WinbackContext } from './winback-prompt'

const rich: WinbackContext = {
    studentName: 'Marina',
    planTitle: 'Consultoria Mensal',
    planPrice: 199.9,
    planInterval: 'mensal',
    expiredAt: '2026-06-01T00:00:00.000Z',
    daysSinceExpired: 14,
    tenureMonths: 8,
    hasData: true,
}

describe('buildWinbackContextBlock', () => {
    it('inclui plano, expiração e tempo de casa', () => {
        const block = buildWinbackContextBlock(rich)
        expect(block).toContain('Marina')
        expect(block).toContain('Consultoria Mensal')
        expect(block).toContain('mensal')
        expect(block).toContain('há 14 dia(s)')
        expect(block).toContain('8 mês(es)')
    })

    it('adiciona aviso de contexto pobre quando hasData=false', () => {
        const block = buildWinbackContextBlock({
            studentName: 'Aluno', planTitle: null, planPrice: null, planInterval: null,
            expiredAt: null, daysSinceExpired: null, tenureMonths: null, hasData: false,
        })
        expect(block).toContain('ATENÇÃO')
    })

    it('não vaza valor/link no bloco (o prompt proíbe; o contexto não força)', () => {
        const block = buildWinbackContextBlock(rich)
        // o valor numérico não deve ser injetado como cobrança no contexto
        expect(block).not.toContain('199')
    })
})
