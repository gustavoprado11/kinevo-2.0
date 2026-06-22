/**
 * Idempotência de ações confirmadas (HITL) — C6 (auditoria 2026-06-22).
 *
 * Um 2º clique no card de confirmação (ou um retry de rede) com a MESMA
 * idempotency_key não pode executar a ação de novo — senão vira contrato/pagamento
 * duplicado. O fluxo:
 *   1. claim: reserva a key atomicamente (INSERT ... ON CONFLICT DO NOTHING).
 *      - inseriu → somos o "dono", segue pra execução;
 *      - conflito + status 'done' → REPLAY: devolve o resultado salvo, NÃO executa;
 *      - conflito + status 'processing' → outra requisição está executando agora → 409.
 *   2. finish: grava o resultado (REDIGIDO) e marca 'done'.
 *   3. release: em caso de FALHA da execução, remove a reserva p/ permitir retry.
 *
 * Tabela `ai_action_idempotency` (migration 217). Como ainda não está nos tipos
 * gerados, este módulo usa um client genérico (mesmo padrão de conversations.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type IdempotencyClaim =
    | { outcome: 'claimed' }
    | { outcome: 'replay'; result: unknown }
    | { outcome: 'processing' }

/**
 * Reserva a key. Atômico via upsert ignoreDuplicates (INSERT ... ON CONFLICT DO
 * NOTHING). Em conflito, lê a linha existente para decidir replay vs processing.
 */
export async function claimActionIdempotency(
    sb: SupabaseClient,
    key: string,
    trainerId: string,
    toolName: string,
): Promise<IdempotencyClaim> {
    const { data, error } = await sb
        .from('ai_action_idempotency')
        .upsert(
            { idempotency_key: key, trainer_id: trainerId, tool_name: toolName, status: 'processing' },
            { onConflict: 'idempotency_key', ignoreDuplicates: true },
        )
        .select('idempotency_key')
    if (error) throw error

    // Inseriu (sem conflito) → somos o dono.
    if (data && data.length > 0) return { outcome: 'claimed' }

    // Conflito: a key já existe. Lê o estado (escopo por trainer — defesa em profundidade).
    const { data: existing } = await sb
        .from('ai_action_idempotency')
        .select('status, result')
        .eq('idempotency_key', key)
        .eq('trainer_id', trainerId)
        .maybeSingle()

    const row = existing as { status?: string; result?: unknown } | null
    if (row?.status === 'done') return { outcome: 'replay', result: row.result ?? null }
    return { outcome: 'processing' }
}

/** Marca a key como concluída com o resultado (já REDIGIDO pelo caller). */
export async function finishActionIdempotency(
    sb: SupabaseClient,
    key: string,
    trainerId: string,
    result: unknown,
): Promise<void> {
    const { error } = await sb
        .from('ai_action_idempotency')
        .update({ status: 'done', result: result ?? null })
        .eq('idempotency_key', key)
        .eq('trainer_id', trainerId)
    if (error) console.error('[finishActionIdempotency] error:', error)
}

/**
 * Libera a reserva (só se ainda 'processing') — usado quando a execução FALHA, para
 * que um retry legítimo com a mesma key possa rodar de novo.
 */
export async function releaseActionIdempotency(
    sb: SupabaseClient,
    key: string,
    trainerId: string,
): Promise<void> {
    const { error } = await sb
        .from('ai_action_idempotency')
        .delete()
        .eq('idempotency_key', key)
        .eq('trainer_id', trainerId)
        .eq('status', 'processing')
    if (error) console.error('[releaseActionIdempotency] error:', error)
}
