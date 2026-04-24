'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createWatchChannel } from '@/lib/google-calendar/client'
import { getFreshAccessToken } from '@/lib/google-calendar/token-refresh'

export interface SelectCalendarResult {
    success: boolean
    error?: string
}

/**
 * Fecha o fluxo de conexão: grava o `calendar_id` escolhido pelo trainer,
 * registra um watch channel pra receber push notifications de mudanças
 * externas e marca a conexão como ativa.
 *
 * Se o watch channel falhar (raro, mas pode rolar com URL bloqueada),
 * a conexão ainda fica ativa — só sem notificações em tempo real. Débito
 * técnico aceitável: trainer vai ver mudanças ao re-carregar a página.
 */
export async function selectGoogleCalendar(
    calendarId: string,
): Promise<SelectCalendarResult> {
    if (!calendarId) return { success: false, error: 'calendarId vazio' }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    const creds = await getFreshAccessToken(trainer.id)
    if (!creds) return { success: false, error: 'Conexão Google indisponível' }

    // Se trocou de calendar_id, para o watch antigo
    const { data: existing } = await supabaseAdmin
        .from('google_calendar_connections')
        .select('watch_channel_id, watch_resource_id, calendar_id')
        .eq('trainer_id', trainer.id)
        .maybeSingle()

    if (
        existing?.watch_channel_id &&
        existing.watch_resource_id &&
        existing.calendar_id !== calendarId
    ) {
        // ignore errors on stop — watch pode já ter expirado
        await (
            await import('@/lib/google-calendar/client')
        ).stopWatchChannel(
            creds.accessToken,
            existing.watch_channel_id,
            existing.watch_resource_id,
        )
    }

    // Atualiza calendar_id (sempre — mesmo se for o mesmo, não custa)
    await supabaseAdmin
        .from('google_calendar_connections')
        .update({ calendar_id: calendarId })
        .eq('trainer_id', trainer.id)

    // Cria watch channel novo
    const webhookUrl =
        process.env.GOOGLE_WEBHOOK_URL ||
        `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kinevoapp.com'}/api/webhooks/google-calendar`
    const channelId = crypto.randomUUID()
    const watchResult = await createWatchChannel(
        creds.accessToken,
        calendarId,
        {
            id: channelId,
            address: webhookUrl,
            token: trainer.id, // passamos o trainer_id como validação mínima
            ttlSeconds: 604800, // 7 dias
        },
    )

    if (watchResult.ok) {
        const expiresAt = new Date(
            parseInt(watchResult.data.expiration, 10),
        ).toISOString()
        await supabaseAdmin
            .from('google_calendar_connections')
            .update({
                watch_channel_id: watchResult.data.id,
                watch_resource_id: watchResult.data.resourceId,
                watch_expires_at: expiresAt,
            })
            .eq('trainer_id', trainer.id)
    } else {
        console.warn(
            '[selectGoogleCalendar] watch channel failed:',
            watchResult.message,
        )
        // Não abortamos — conexão continua utilizável sem webhook.
        await supabaseAdmin
            .from('google_calendar_connections')
            .update({
                last_sync_error: `watch: ${watchResult.message}`,
            })
            .eq('trainer_id', trainer.id)
    }

    revalidatePath('/settings/integrations/google-calendar')
    return { success: true }
}
