/**
 * Onda 3 — upsertInsightByKey (lib).
 *
 * Lógica pura de gravação dedup-friendly de insights, parametrizada pelo
 * client Supabase. Existe em `lib/` (e não em `actions/`) para que tanto a
 * Server Action quanto o cron handler (que usa `supabaseAdmin`/service-role)
 * possam reutilizar — o `'use server'` em `actions/insights.ts` impede
 * exportações chamáveis a partir de route handlers/cron.
 *
 * Convenção da chave:
 * - `insightKeyPrefix` é o prefixo estável do evento (ex.: `gap_alert:{student}`).
 *   O SELECT busca por `LIKE ${prefix}%` na janela de 7 dias, com
 *   `status != 'dismissed'`. Se achar, ATUALIZA (preserva status original).
 *   Se não achar, INSERE.
 * - `insightKey` é a chave completa a gravar (geralmente termina em `:{today}`).
 *
 * Schema: snake_case.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface UpsertInsightByKeyPayload {
    trainerId: string
    studentId: string | null
    category: 'alert' | 'progression' | 'suggestion' | 'summary'
    priority: 'critical' | 'high' | 'medium' | 'low'
    insightKeyPrefix: string
    insightKey: string
    title: string
    body: string
    actionType?: string | null
    actionMetadata?: Record<string, unknown>
    source: 'rules' | 'llm' | 'trainer'
    expiresAt?: string | null
}

export interface UpsertInsightByKeyResult {
    success: boolean
    mode?: 'inserted' | 'updated'
    error?: string
}

/**
 * Aceita qualquer SupabaseClient (browser, server, admin) — o caller
 * decide o nível de privilégio. RLS continua valendo quando o client
 * for o normal; no cron passa `supabaseAdmin` pra bypass.
 */
export async function upsertInsightByKey(
    // Tipo `any` no client é proposital: SupabaseClient<Database> exigiria
    // importar Database aqui, e essa lib precisa ficar agnóstica para
    // funcionar tanto no actions quanto no cron sem type-cast no caller.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    payload: UpsertInsightByKeyPayload,
): Promise<UpsertInsightByKeyResult> {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    let findQuery = supabase
        .from('assistant_insights')
        .select('id, status')
        .eq('trainer_id', payload.trainerId)
        .like('insight_key', `${payload.insightKeyPrefix}%`)
        .gte('created_at', sevenDaysAgo)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(1)

    findQuery = payload.studentId
        ? findQuery.eq('student_id', payload.studentId)
        : findQuery.is('student_id', null)

    const { data: existing, error: findErr } = await findQuery.maybeSingle()
    if (findErr) return { success: false, error: findErr.message }

    if (existing) {
        const { error } = await supabase
            .from('assistant_insights')
            .update({
                // Status original preserva (`new`/`read`/`acted` ficam onde estão).
                category: payload.category,
                priority: payload.priority,
                title: payload.title,
                body: payload.body,
                action_type: payload.actionType ?? null,
                action_metadata: payload.actionMetadata ?? {},
                source: payload.source,
                insight_key: payload.insightKey,
                expires_at: payload.expiresAt ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

        return error
            ? { success: false, error: error.message }
            : { success: true, mode: 'updated' }
    }

    const { error } = await supabase
        .from('assistant_insights')
        .insert({
            trainer_id: payload.trainerId,
            student_id: payload.studentId,
            category: payload.category,
            priority: payload.priority,
            title: payload.title,
            body: payload.body,
            action_type: payload.actionType ?? null,
            action_metadata: payload.actionMetadata ?? {},
            status: 'new',
            source: payload.source,
            insight_key: payload.insightKey,
            expires_at: payload.expiresAt ?? null,
        })

    return error
        ? { success: false, error: error.message }
        : { success: true, mode: 'inserted' }
}
