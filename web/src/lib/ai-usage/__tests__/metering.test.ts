import { describe, it, expect } from 'vitest'
import {
    usdToMicros,
    turnCostUsd,
    turnCostMicros,
    creditsForTurn,
    currentPeriodStart,
    recordAiUsage,
    type RecordAiUsageParams,
} from '../metering'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
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

describe('recordAiUsage — preserva o `this` do admin.rpc (regressão do 500 no execute-tool)', () => {
    it('chama consume_ai_usage com this=admin (não desvincula o método)', async () => {
        let thisOk = false
        let calledFn: string | null = null
        // admin fake cujo rpc DEPENDE do `this`: se recordAiUsage extrair o método
        // (const x = admin.rpc), o `this` fica undefined e o metering lança — era a
        // causa-raiz do 500 ao confirmar uma ação. O fix é admin.rpc.bind(admin).
        const admin = {
            _marker: 'admin' as const,
            rpc(fn: string) {
                thisOk = (this as { _marker?: string } | undefined)?._marker === 'admin'
                calledFn = fn
                return Promise.resolve({ data: 3, error: null })
            },
            from() {
                return { insert: () => Promise.resolve({ error: null }) }
            },
        }
        const params: RecordAiUsageParams = {
            trainerId: 't1',
            periodType: 'month',
            credits: 1,
            costMicros: 0,
            creditLimit: 1000,
            events: [{ actionClass: 'write', credits: 1 }],
            now: new Date('2026-06-01T00:00:00Z'),
        }
        const res = await recordAiUsage(admin as unknown as SupabaseClient<Database>, params)
        expect(thisOk).toBe(true)
        expect(calledFn).toBe('consume_ai_usage')
        expect(res.ok).toBe(true)
    })
})
