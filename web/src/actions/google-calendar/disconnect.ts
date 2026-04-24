'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stopWatchChannel } from '@/lib/google-calendar/client'
import { revokeToken } from '@/lib/google-calendar/oauth'

export interface DisconnectResult {
    success: boolean
    error?: string
}

/**
 * Desconecta o Google Calendar do trainer:
 *  1. Para o watch channel (se houver).
 *  2. Revoga o token no Google (best-effort).
 *  3. Remove a linha em `google_calendar_connections`.
 *  4. Marca todas as rotinas do trainer como `google_sync_status='disabled'`.
 *
 * Eventos no Google Calendar NÃO são deletados — se o trainer quiser,
 * pode remover manualmente depois.
 */
export async function disconnectGoogleCalendar(): Promise<DisconnectResult> {
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

    const { data: conn } = await supabaseAdmin
        .from('google_calendar_connections')
        .select('access_token, refresh_token, watch_channel_id, watch_resource_id')
        .eq('trainer_id', trainer.id)
        .maybeSingle()
    if (!conn) {
        // Idempotente — já estava desconectado.
        return { success: true }
    }

    // Para watch channel (não falha a op se der erro)
    if (conn.watch_channel_id && conn.watch_resource_id) {
        await stopWatchChannel(
            conn.access_token,
            conn.watch_channel_id,
            conn.watch_resource_id,
        ).catch(() => undefined)
    }

    // Revoga tokens (best-effort)
    await revokeToken(conn.refresh_token).catch(() => undefined)

    // Marca rotinas como disabled
    await supabaseAdmin
        .from('recurring_appointments')
        .update({ google_sync_status: 'disabled' })
        .eq('trainer_id', trainer.id)
        .not('google_event_id', 'is', null)

    // Remove a conexão
    const { error: deleteError } = await supabaseAdmin
        .from('google_calendar_connections')
        .delete()
        .eq('trainer_id', trainer.id)
    if (deleteError) {
        console.error('[disconnectGoogleCalendar] delete error:', deleteError)
        return { success: false, error: 'Erro ao remover conexão' }
    }

    revalidatePath('/settings/integrations/google-calendar')
    return { success: true }
}
