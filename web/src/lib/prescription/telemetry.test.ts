import { describe, it, expect, vi } from 'vitest'
import { logGenerationTelemetry, type GenerationTelemetry } from './telemetry'

function makeSupabaseMock() {
    const update = vi.fn().mockReturnThis()
    const eq = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ update, eq }))
    // Chain: from().update(...).eq(...)
    return { from, update, eq, supabase: { from } as any }
}

const payload: GenerationTelemetry = {
    tokens_input_new: 900,
    tokens_input_cached: 100,
    tokens_output: 500,
    cost_usd: 0.006,
    model_used: 'gpt-4.1-mini',
    retry_count: 0,
    prompt_version: 'v2.5.0',
    rules_violations_count: 2,
    rules_violations_json: [{ rule_id: 'MAX_SETS_COMPOUND_4' }, { rule_id: 'COMPOUND_BEFORE_ACCESSORY' }],
}

describe('logGenerationTelemetry', () => {
    it('updates prescription_generations with all telemetry fields by id', async () => {
        const { from, update, eq, supabase } = makeSupabaseMock()
        await logGenerationTelemetry(supabase, 'gen-1', payload)

        expect(from).toHaveBeenCalledWith('prescription_generations')
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            tokens_input_new: 900,
            tokens_input_cached: 100,
            tokens_output: 500,
            cost_usd: 0.006,
            model_used: 'gpt-4.1-mini',
            retry_count: 0,
            prompt_version: 'v2.5.0',
            rules_violations_count: 2,
            rules_violations_json: payload.rules_violations_json,
        }))
        expect(eq).toHaveBeenCalledWith('id', 'gen-1')
    })

    it('swallows supabase errors so the caller is never interrupted', async () => {
        const update = vi.fn().mockReturnThis()
        const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
        const supabase = { from: vi.fn(() => ({ update, eq })) } as any

        await expect(
            logGenerationTelemetry(supabase, 'gen-2', payload),
        ).resolves.toBeUndefined()
    })

    it('swallows thrown exceptions from the supabase client', async () => {
        const supabase = { from: vi.fn(() => { throw new Error('network') }) } as any
        await expect(
            logGenerationTelemetry(supabase, 'gen-3', payload),
        ).resolves.toBeUndefined()
    })
})
