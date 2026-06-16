import { describe, it, expect } from 'vitest'
import {
    usdToMicros,
    turnCostUsd,
    turnCostMicros,
    creditsForTurn,
    currentPeriodStart,
} from '../metering'
import { computeCost } from '@/lib/prescription/llm-client'
import { GENERATE_PROGRAM } from '@/lib/assistant/tool-policy'

describe('metering — tokens → custo', () => {
    it('usdToMicros arredonda para inteiro', () => {
        expect(usdToMicros(0.0165)).toBe(16500)
        expect(usdToMicros(0)).toBe(0)
    })

    it('turnCostUsd casa com computeCost (cache-aware)', () => {
        const usage = { inputTokens: 10000, cachedInputTokens: 4000, outputTokens: 1000 }
        const expected = computeCost('gpt-4.1-mini', {
            input_new: 6000,
            input_cached: 4000,
            output: 1000,
        })
        expect(turnCostUsd('gpt-4.1-mini', usage)).toBeCloseTo(expected, 10)
        expect(turnCostMicros('gpt-4.1-mini', usage)).toBe(usdToMicros(expected))
    })

    it('cached clamp: cached > input não quebra (clampa em input)', () => {
        const usage = { inputTokens: 1000, cachedInputTokens: 5000, outputTokens: 100 }
        const cost = turnCostUsd('gpt-4.1-mini', usage)
        // tudo cacheado, input_new = 0
        const expected = computeCost('gpt-4.1-mini', {
            input_new: 0,
            input_cached: 1000,
            output: 100,
        })
        expect(cost).toBeCloseTo(expected, 10)
    })
})

describe('metering — créditos (piso 1)', () => {
    it('turno só de leitura = 1; com prescrição soma os pesos', () => {
        expect(creditsForTurn([])).toBe(1)
        expect(creditsForTurn([{ tool: 'kinevo_list_students' }])).toBe(1)
        expect(creditsForTurn([{ tool: GENERATE_PROGRAM }])).toBe(5)
    })
})

describe('metering — períodos', () => {
    it('mês → primeiro dia do mês', () => {
        expect(currentPeriodStart('month', new Date('2026-06-16T12:00:00Z'))).toBe('2026-06-01')
        expect(currentPeriodStart('month', new Date('2026-01-31T23:59:59Z'))).toBe('2026-01-01')
    })

    it('semana → segunda-feira (ISO)', () => {
        // 2026-06-16 é terça → segunda = 2026-06-15
        expect(currentPeriodStart('week', new Date('2026-06-16T12:00:00Z'))).toBe('2026-06-15')
        // 2026-06-21 é domingo → segunda = 2026-06-15
        expect(currentPeriodStart('week', new Date('2026-06-21T12:00:00Z'))).toBe('2026-06-15')
        // 2026-06-15 é segunda → ela mesma
        expect(currentPeriodStart('week', new Date('2026-06-15T08:00:00Z'))).toBe('2026-06-15')
    })
})
