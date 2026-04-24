/**
 * Google Calendar — Token management
 *
 * getFreshAccessToken(trainerId) carrega a conexão do trainer via admin
 * client (tokens protegidos por RLS), renova se estiver perto de expirar
 * (< 2 min), persiste o novo access_token, retorna. Se o refresh falhar
 * com invalid_grant (usuário revogou), marca conexão como `status='revoked'`.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { refreshAccessToken } from './oauth'

const EXPIRY_BUFFER_SECONDS = 120

export interface LoadedConnection {
    trainerId: string
    calendarId: string
    accessToken: string
    refreshToken: string
    status: 'active' | 'revoked' | 'error'
    watchChannelId: string | null
    watchResourceId: string | null
    watchExpiresAt: string | null
}

/** Busca a conexão COM tokens (usa admin client pra driblar RLS). */
export async function loadConnection(
    trainerId: string,
): Promise<LoadedConnection | null> {
    const { data } = await supabaseAdmin
        .from('google_calendar_connections')
        .select(
            'trainer_id, calendar_id, access_token, refresh_token, access_token_expires_at, status, watch_channel_id, watch_resource_id, watch_expires_at',
        )
        .eq('trainer_id', trainerId)
        .maybeSingle()
    if (!data) return null
    return {
        trainerId: data.trainer_id,
        calendarId: data.calendar_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        status: data.status as 'active' | 'revoked' | 'error',
        watchChannelId: data.watch_channel_id,
        watchResourceId: data.watch_resource_id,
        watchExpiresAt: data.watch_expires_at,
    }
}

/**
 * Carrega a conexão e renova o access_token se próximo do vencimento.
 * Retorna null se o trainer não tem conexão ativa (ou foi revogada).
 */
export async function getFreshAccessToken(
    trainerId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
    const { data } = await supabaseAdmin
        .from('google_calendar_connections')
        .select('access_token, refresh_token, access_token_expires_at, calendar_id, status')
        .eq('trainer_id', trainerId)
        .maybeSingle()
    if (!data || data.status !== 'active') return null

    const expiresAt = new Date(data.access_token_expires_at).getTime()
    const needsRefresh = expiresAt - Date.now() < EXPIRY_BUFFER_SECONDS * 1000

    if (!needsRefresh) {
        return { accessToken: data.access_token, calendarId: data.calendar_id }
    }

    try {
        const refreshed = await refreshAccessToken(data.refresh_token)
        const newExpiresAt = new Date(
            Date.now() + refreshed.expires_in * 1000,
        ).toISOString()
        await supabaseAdmin
            .from('google_calendar_connections')
            .update({
                access_token: refreshed.access_token,
                access_token_expires_at: newExpiresAt,
            })
            .eq('trainer_id', trainerId)
        return {
            accessToken: refreshed.access_token,
            calendarId: data.calendar_id,
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // invalid_grant = usuário revogou ou trocou senha
        if (/invalid_grant/i.test(msg)) {
            await markRevoked(trainerId, 'refresh_token inválido')
            return null
        }
        await supabaseAdmin
            .from('google_calendar_connections')
            .update({ last_sync_error: msg })
            .eq('trainer_id', trainerId)
        return null
    }
}

export async function markRevoked(
    trainerId: string,
    reason: string,
): Promise<void> {
    await supabaseAdmin
        .from('google_calendar_connections')
        .update({ status: 'revoked', last_sync_error: reason })
        .eq('trainer_id', trainerId)
    // Marca todas as rotinas do trainer como disabled no Google.
    await supabaseAdmin
        .from('recurring_appointments')
        .update({ google_sync_status: 'disabled' })
        .eq('trainer_id', trainerId)
        .not('google_event_id', 'is', null)
}
