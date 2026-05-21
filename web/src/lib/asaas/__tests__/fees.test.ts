import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    ASAAS_FEES,
    simulateNet,
    simulateAllMethods,
    formatBRL,
    formatPercent,
} from '../fees'

describe('fees — simulateNet', () => {
    let originalTake: string | undefined

    beforeEach(() => {
        originalTake = process.env.KINEVO_TAKE_RATE_PCT
        process.env.KINEVO_TAKE_RATE_PCT = '0'
    })
    afterEach(() => {
        if (originalTake === undefined) delete process.env.KINEVO_TAKE_RATE_PCT
        else process.env.KINEVO_TAKE_RATE_PCT = originalTake
    })

    it('PIX em R$ 250: trainer recebe R$ 249,01 (PIX R$ 0,99 fixo)', () => {
        const r = simulateNet(250, 'PIX')
        expect(r.asaasFee).toBeCloseTo(0.99, 2)
        expect(r.trainerNet).toBeCloseTo(249.01, 2)
        expect(r.kinevoFee).toBe(0)
        expect(r.method).toBe('PIX')
    })

    it('Cartão crédito em R$ 250: trainer recebe R$ 242,03 (250 - 2,99% - 0,49)', () => {
        const r = simulateNet(250, 'CREDIT_CARD')
        expect(r.asaasFee).toBeCloseTo(7.97, 2)
        expect(r.trainerNet).toBeCloseTo(242.03, 2)
    })

    it('Boleto em R$ 250: trainer recebe R$ 248,01 (250 - 1,99 fixo)', () => {
        const r = simulateNet(250, 'BOLETO')
        expect(r.asaasFee).toBe(1.99)
        expect(r.trainerNet).toBeCloseTo(248.01, 2)
    })

    it('Cartão débito em R$ 100: aplica 1,99% + R$ 0,49', () => {
        const r = simulateNet(100, 'DEBIT_CARD')
        expect(r.asaasFee).toBeCloseTo(2.48, 2)
        expect(r.trainerNet).toBeCloseTo(97.52, 2)
    })

    it('aplica take rate Kinevo quando setado em env', () => {
        process.env.KINEVO_TAKE_RATE_PCT = '1.5'
        const r = simulateNet(200, 'PIX')
        // Asaas PIX: R$ 0,99 fixo
        // Kinevo: 200 * 0.015 = 3.00
        // Net: 200 - 0.99 - 3.00 = 196.01
        expect(r.asaasFee).toBeCloseTo(0.99, 2)
        expect(r.kinevoFee).toBe(3)
        expect(r.trainerNet).toBeCloseTo(196.01, 2)
    })

    it('aceita override de take rate na chamada', () => {
        const r = simulateNet(100, 'PIX', { kinevoTakeOverride: 0.02 })
        expect(r.kinevoFee).toBe(2)
    })

    it('settlementLabel é string descritiva por método', () => {
        expect(simulateNet(100, 'PIX').settlementLabel).toContain('dia')
        expect(simulateNet(100, 'CREDIT_CARD').settlementLabel).toContain('30')
    })

    it('arredonda corretamente em 2 casas', () => {
        const r = simulateNet(33.33, 'PIX')
        expect(Number.isFinite(r.trainerNet)).toBe(true)
        expect(r.trainerNet.toString()).toMatch(/^\d+\.?\d{0,2}$/)
    })
})

describe('fees — simulateAllMethods', () => {
    it('retorna simulação pra cada método configurado', () => {
        const r = simulateAllMethods(100, ['PIX', 'CREDIT_CARD'])
        expect(r).toHaveLength(2)
        expect(r[0].method).toBe('PIX')
        expect(r[1].method).toBe('CREDIT_CARD')
    })

    it('default cobre PIX, Crédito, Débito e Boleto', () => {
        const r = simulateAllMethods(100)
        expect(r).toHaveLength(4)
        expect(r.map(x => x.method).sort()).toEqual(['BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX'])
    })
})

describe('fees — formatters', () => {
    it('formatBRL formata em real com 2 casas', () => {
        // toLocaleString depende do ambiente; testa que retorna string com R$ e vírgula
        const s = formatBRL(1234.5)
        expect(s).toMatch(/R\$\s?1\.?234,50/)
    })

    it('formatPercent formata em pt-BR com vírgula', () => {
        expect(formatPercent(0.0299)).toBe('2,99%')
        expect(formatPercent(0.015)).toBe('1,50%')
    })
})

describe('fees — tabela de taxas exposta', () => {
    it('expõe todas as 4 modalidades', () => {
        expect(Object.keys(ASAAS_FEES).sort()).toEqual([
            'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX',
        ])
    })
    it('cada modalidade tem percent + fixed + settlementLabel', () => {
        for (const m of Object.values(ASAAS_FEES)) {
            expect(typeof m.percent).toBe('number')
            expect(typeof m.fixed).toBe('number')
            expect(typeof m.settlementLabel).toBe('string')
        }
    })
})
