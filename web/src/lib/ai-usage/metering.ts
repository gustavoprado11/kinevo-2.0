/**
 * Metering de uso de IA do treinador (Fase 0 — IA do Treinador).
 *
 * Duas grandezas distintas por turno:
 *   - CUSTO (verdade interna de margem): tokens → USD via PRICING do motor
 *     (reusa computeCost de lib/prescription/llm-client — NÃO toca no motor).
 *   - CRÉDITO (orçamento visível ao treinador): pesos por ação (tool-policy),
 *     piso de 1 por turno.
 *
 * Persistência atômica: RPC `increment_ai_usage` (período) + insert em
 * `ai_usage_events` (log/analytics, com `surface`). Tudo via service role.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { computeCost, type LLMModel } from '@/lib/prescription/llm-client'
import {
    computeTurnCredits,
    type ActionClass,
    type TurnToolCall,
} from '@/lib/assistant/tool-policy'

export type AiSurface =
    | 'chat'
    | 'command_bar'
    | 'workspace'
    | 'canvas'
    | 'proactive'
    | 'mobile'
    | 'voice'

export type PeriodType = 'week' | 'month'

export interface TokenUsage {
    inputTokens: number
    cachedInputTokens?: number
    outputTokens: number
}

/** USD → micros (inteiro), para a coluna bigint cost_usd_micros. */
export function usdToMicros(usd: number): number {
    return Math.round(usd * 1_000_000)
}

/** Custo em USD de um turno a partir do uso de tokens (cache-aware). */
export function turnCostUsd(model: LLMModel, usage: TokenUsage): number {
    const cached = Math.max(0, Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens))
    return computeCost(model, {
        input_new: usage.inputTokens - cached,
        input_cached: cached,
        output: usage.outputTokens,
    })
}

/** Custo em micros (para persistir). */
export function turnCostMicros(model: LLMModel, usage: TokenUsage): number {
    return usdToMicros(turnCostUsd(model, usage))
}

/** Créditos de um turno (pesos por ação, piso 1). Re-exporta a regra pura. */
export function creditsForTurn(calls: TurnToolCall[]): number {
    return computeTurnCredits(calls)
}

// ----------------------------------------------------------------------------
// Períodos
// ----------------------------------------------------------------------------
function toIsoDate(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/**
 * Início do período corrente (UTC).
 *   - 'month' → primeiro dia do mês.
 *   - 'week'  → segunda-feira (ISO; semana começa na segunda no Kinevo).
 */
export function currentPeriodStart(periodType: PeriodType, now: Date = new Date()): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    if (periodType === 'month') {
        return toIsoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))
    }
    // week: recua até segunda (getUTCDay: 0=domingo … 6=sábado).
    const dow = d.getUTCDay()
    const diff = (dow + 6) % 7 // segunda=0
    d.setUTCDate(d.getUTCDate() - diff)
    return toIsoDate(d)
}

// ----------------------------------------------------------------------------
// Persistência
// ----------------------------------------------------------------------------
type DBClient = SupabaseClient<Database>

export interface AiUsageEventInput {
    actionClass: ActionClass
    credits: number
    surface?: AiSurface
    model?: string
    inputTokens?: number
    cachedInputTokens?: number
    outputTokens?: number
    costMicros?: number
}

export interface RecordAiUsageParams {
    trainerId: string
    periodType: PeriodType
    credits: number
    costMicros: number
    events: AiUsageEventInput[]
    now?: Date
}

/**
 * Registra o uso de um turno: incrementa o período (atômico) e loga os eventos.
 * Service role (admin) — escrita não passa por RLS. Idempotência não é exigida
 * aqui (1 chamada por turno concluído).
 */
export async function recordAiUsage(
    admin: DBClient,
    params: RecordAiUsageParams,
): Promise<{ ok: boolean; error?: string }> {
    const periodStart = currentPeriodStart(params.periodType, params.now)

    const { error: rpcError } = await admin.rpc('increment_ai_usage', {
        p_trainer_id: params.trainerId,
        p_period_type: params.periodType,
        p_period_start: periodStart,
        p_credits: params.credits,
        p_cost_micros: params.costMicros,
    })

    if (rpcError) {
        console.error('[recordAiUsage] increment_ai_usage error:', rpcError)
        return { ok: false, error: rpcError.message }
    }

    if (params.events.length > 0) {
        const rows = params.events.map((e) => ({
            trainer_id: params.trainerId,
            action_class: e.actionClass,
            credits: e.credits,
            surface: e.surface ?? null,
            model: e.model ?? null,
            input_tokens: e.inputTokens ?? null,
            cached_input_tokens: e.cachedInputTokens ?? null,
            output_tokens: e.outputTokens ?? null,
            cost_usd_micros: e.costMicros ?? null,
        }))
        const { error: insertError } = await admin.from('ai_usage_events').insert(rows)
        if (insertError) {
            // O período já foi incrementado; o log é best-effort.
            console.error('[recordAiUsage] ai_usage_events insert error:', insertError)
        }
    }

    return { ok: true }
}
