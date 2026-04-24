import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { listUpdatedEvents } from '@/lib/google-calendar/client'
import { getFreshAccessToken } from '@/lib/google-calendar/token-refresh'
import type { GoogleEvent } from '@kinevo/shared/types/google-calendar'

/**
 * POST /api/webhooks/google-calendar
 *
 * Recebe Push Notifications do Google Calendar. Headers importantes:
 *   - X-Goog-Channel-Id       → identifica o trainer (matching com watch_channel_id)
 *   - X-Goog-Resource-State   → 'sync' (primeira subscription) ou 'exists' (mudança)
 *   - X-Goog-Channel-Token    → validação (enviamos trainer_id como token)
 *
 * Responde rápido (<30s é o SLA do Google). Cria `trainer_notifications`
 * pras mudanças relevantes — processa mínimo no handler e deixa o trainer
 * revisar no banner.
 */
export async function POST(req: NextRequest) {
    const channelId = req.headers.get('x-goog-channel-id')
    const resourceState = req.headers.get('x-goog-resource-state')
    const channelToken = req.headers.get('x-goog-channel-token')

    if (!channelId) {
        return NextResponse.json({ error: 'missing channel id' }, { status: 400 })
    }

    // Google manda 'sync' logo após criar o channel; ignoramos.
    if (resourceState === 'sync') {
        return NextResponse.json({ ok: true, ignored: 'sync ping' })
    }

    // Localiza o trainer dono do channel
    const { data: conn } = await supabaseAdmin
        .from('google_calendar_connections')
        .select('trainer_id, calendar_id, last_sync_at')
        .eq('watch_channel_id', channelId)
        .maybeSingle()
    if (!conn) {
        // Channel desconhecido — provavelmente resíduo. Responde 200 pra o
        // Google parar de retentar, mas loga.
        console.warn('[google-webhook] unknown channel:', channelId)
        return NextResponse.json({ ok: true, ignored: 'unknown channel' })
    }

    // Validação mínima: token deve bater com trainer_id
    if (channelToken && channelToken !== conn.trainer_id) {
        console.warn('[google-webhook] invalid token for channel:', channelId)
        return NextResponse.json({ ok: true, ignored: 'token mismatch' })
    }

    const creds = await getFreshAccessToken(conn.trainer_id)
    if (!creds) {
        // Conexão revogada — não há o que fazer aqui
        return NextResponse.json({ ok: true, ignored: 'no active connection' })
    }

    // Janela de updatedMin: desde o último sync ou 24h atrás
    const updatedMin =
        conn.last_sync_at ?? new Date(Date.now() - 24 * 3600_000).toISOString()

    const listResult = await listUpdatedEvents(
        creds.accessToken,
        creds.calendarId,
        updatedMin,
    )
    if (!listResult.ok) {
        console.error('[google-webhook] list updated events error:', listResult.message)
        return NextResponse.json({ ok: false, error: listResult.message })
    }

    const items = listResult.data.items ?? []
    let appliedDeletes = 0
    let flaggedEdits = 0

    for (const ev of items) {
        const relevant = await classifyExternalChange(conn.trainer_id, ev)
        if (relevant.kind === 'ignore') continue

        if (relevant.kind === 'delete_applied') {
            appliedDeletes++
        } else if (relevant.kind === 'edit_needs_confirmation') {
            flaggedEdits++
        }
    }

    await supabaseAdmin
        .from('google_calendar_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('trainer_id', conn.trainer_id)

    return NextResponse.json({
        ok: true,
        applied_deletes: appliedDeletes,
        flagged_edits: flaggedEdits,
    })
}

type Classification =
    | { kind: 'ignore' }
    | { kind: 'delete_applied' }
    | { kind: 'edit_needs_confirmation' }

/**
 * Para cada evento retornado, decide se:
 *  - Ignora (criado pelo Kinevo e não é uma mudança relevante).
 *  - Aplica direto (deleted = intenção clara).
 *  - Pede confirmação (edit em horário/título).
 */
async function classifyExternalChange(
    trainerId: string,
    event: GoogleEvent,
): Promise<Classification> {
    if (!event.id) return { kind: 'ignore' }

    // Busca a rotina que tem esse google_event_id
    const { data: rule } = await supabaseAdmin
        .from('recurring_appointments')
        .select(
            'id, student_id, start_time, day_of_week, google_event_id, status, students:student_id(name)',
        )
        .eq('trainer_id', trainerId)
        .eq('google_event_id', event.recurringEventId ?? event.id)
        .maybeSingle()

    if (!rule) return { kind: 'ignore' }

    // Evento deletado externamente
    if (event.status === 'cancelled') {
        // Se é uma single instance (tem recurringEventId), cria exceção canceled
        if (event.recurringEventId) {
            const occurrenceDate = event.originalStartTime?.dateTime?.slice(0, 10)
            if (occurrenceDate) {
                await supabaseAdmin
                    .from('appointment_exceptions')
                    .upsert(
                        {
                            recurring_appointment_id: rule.id,
                            trainer_id: trainerId,
                            occurrence_date: occurrenceDate,
                            kind: 'canceled',
                            notes: 'Cancelado no Google Calendar',
                        },
                        {
                            onConflict:
                                'recurring_appointment_id,occurrence_date',
                        },
                    )
            }
        } else if (rule.status === 'active') {
            // Evento recorrente inteiro foi deletado → encerra rotina
            await supabaseAdmin
                .from('recurring_appointments')
                .update({
                    status: 'canceled',
                    ends_on: new Date().toISOString().slice(0, 10),
                })
                .eq('id', rule.id)
        }

        const studentName =
            (rule.students as { name?: string } | null)?.name ?? 'aluno'
        await supabaseAdmin.from('trainer_notifications').insert({
            trainer_id: trainerId,
            type: 'google_calendar_external_delete',
            category: 'integration',
            title: 'Agendamento cancelado no Google',
            body: `${studentName}: cancelamos também no Kinevo.`,
            data: {
                recurring_appointment_id: rule.id,
                google_event_id: event.id,
            },
        })
        return { kind: 'delete_applied' }
    }

    // Edit externo (horário ou título) — pede confirmação do trainer
    // Detecção mínima: sempre que vem 'exists' com dateTime diferente do
    // Kinevo, cria notificação. Refinamento fica pra V2.
    await supabaseAdmin.from('trainer_notifications').insert({
        trainer_id: trainerId,
        type: 'google_calendar_external_edit',
        category: 'integration',
        title: 'Evento editado no Google',
        body:
            'Um agendamento foi modificado direto no Google Calendar. Verifique se deseja refletir a mudança no Kinevo.',
        data: {
            recurring_appointment_id: rule.id,
            google_event_id: event.id,
            google_updated: event.updated,
        },
    })
    return { kind: 'edit_needs_confirmation' }
}

/** Health check opcional. */
export async function GET() {
    return NextResponse.json({ ok: true, service: 'google-calendar-webhook' })
}
