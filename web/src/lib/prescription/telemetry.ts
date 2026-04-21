// ============================================================================
// Kinevo Prescription Engine — Telemetry persister
// ============================================================================
// Writes cost / token / retry / rules-violation breakdown to
// prescription_generations for every smart-v2 generation. Populated via
// migration 104 columns.
//
// Failures are swallowed: telemetry is informational, not load-bearing — we
// never want a telemetry write to break the generation pipeline.

import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface GenerationTelemetry {
    tokens_input_new: number
    tokens_input_cached: number
    tokens_output: number
    cost_usd: number
    model_used: string
    retry_count: number
    prompt_version: string
    rules_violations_count: number
    rules_violations_json: unknown[]
}

export async function logGenerationTelemetry(
    supabase: SupabaseClient,
    generationId: string,
    payload: GenerationTelemetry,
): Promise<void> {
    try {
        const update = {
            tokens_input_new: payload.tokens_input_new,
            tokens_input_cached: payload.tokens_input_cached,
            tokens_output: payload.tokens_output,
            cost_usd: payload.cost_usd,
            model_used: payload.model_used,
            retry_count: payload.retry_count,
            prompt_version: payload.prompt_version,
            rules_violations_count: payload.rules_violations_count,
            rules_violations_json: payload.rules_violations_json,
        }

        // @ts-ignore — prescription_generations telemetry columns from migration 104
        const { error } = await supabase
            .from('prescription_generations')
            .update(update)
            .eq('id', generationId)

        if (error) {
            console.warn('[telemetry] failed to update prescription_generations:', error.message)
        }
    } catch (err) {
        console.warn('[telemetry] unexpected error:', err)
    }
}
