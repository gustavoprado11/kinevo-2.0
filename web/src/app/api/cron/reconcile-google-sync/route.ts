import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    syncDeleteAppointment,
    syncUpdateAppointment,
} from '@/lib/google-calendar/sync-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * CRON: reconcilia rotinas com `google_sync_status` em 'pending'/'error' (AG2).
 *
 * O sync inline roda via after(), mas timeouts/rate-limits marcam 'pending'
 * contando com retries in-process que morrem com a lambda. Este cron é a
 * "fila real" que o header do sync-service prometia pra V2:
 *
 *   - rotina ativa   → syncUpdateAppointment (cai pra create sem event_id;
 *                      recria em not_found)
 *   - rotina cancelada com google_event_id → syncDeleteAppointment
 *
 * Só reconcilia trainers com conexão Google ATIVA (sem conexão, retentar é
 * inócuo e eterno) e linhas paradas há >10min (não disputa com after() em voo).
 * Instâncias (exceções remarcadas/canceladas) não têm coluna de status — fora
 * do escopo deste cron.
 *
 * Roda 1×/dia (11:45 UTC): o plano Hobby do Vercel só aceita crons diários —
 * expressão mais frequente REPROVA o deployment inteiro na criação. O caminho
 * primário é o after() inline; este cron é a rede de segurança pros pendings.
 */
export async function GET(request: Request) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { data: connections } = await supabaseAdmin
            .from('google_calendar_connections')
            .select('trainer_id')
            .eq('status', 'active')

        const trainerIds = (connections ?? []).map((c) => c.trainer_id)
        if (trainerIds.length === 0) {
            return NextResponse.json({ reconciled: 0, reason: 'sem conexões ativas' })
        }

        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const { data: stale, error } = await supabaseAdmin
            .from('recurring_appointments')
            .select('id, status, google_event_id, google_sync_status')
            .in('google_sync_status', ['pending', 'error'])
            .in('trainer_id', trainerIds)
            .lt('updated_at', tenMinAgo)
            .order('updated_at', { ascending: true })
            .limit(25)

        if (error) {
            console.error('[reconcile-google-sync] fetch error:', error)
            return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
        }
        if (!stale || stale.length === 0) {
            return NextResponse.json({ reconciled: 0 })
        }

        let synced = 0
        let failed = 0
        let skipped = 0
        for (const rule of stale) {
            const outcome =
                rule.status === 'canceled'
                    ? rule.google_event_id
                        ? await syncDeleteAppointment(rule.id)
                        : null
                    : await syncUpdateAppointment(rule.id)

            if (outcome === null) {
                // Cancelada sem event_id: nunca chegou ao Google — nada a fazer.
                await supabaseAdmin
                    .from('recurring_appointments')
                    .update({ google_sync_status: 'not_synced' })
                    .eq('id', rule.id)
                skipped++
                continue
            }
            if (outcome.synced) synced++
            else if (outcome.skipped) skipped++
            else failed++
        }

        console.log(
            `[reconcile-google-sync] processed=${stale.length} synced=${synced} skipped=${skipped} failed=${failed}`,
        )
        return NextResponse.json({
            processed: stale.length,
            synced,
            skipped,
            failed,
        })
    } catch (err) {
        console.error('[reconcile-google-sync] unexpected error:', err)
        return NextResponse.json({ error: 'unexpected' }, { status: 500 })
    }
}
