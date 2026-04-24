import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    exchangeCodeForTokens,
    fetchUserInfo,
    GOOGLE_SCOPES,
} from '@/lib/google-calendar/oauth'
import { listCalendars } from '@/lib/google-calendar/client'

/**
 * GET /settings/integrations/google-calendar/callback
 *
 * Recebe o redirect do Google após consentimento. Fluxo:
 *  1. Valida `state` contra o cookie setado no /start.
 *  2. Troca o `code` por access_token + refresh_token.
 *  3. Busca userinfo + calendar list.
 *  4. Persiste conexão em `google_calendar_connections` com o calendar
 *     primário como padrão. Redireciona pro settings com `?step=select`
 *     pra o trainer poder trocar o calendário destino.
 *
 * Não cria watch channel aqui — é feito quando o trainer confirma o
 * calendário (POST /select-calendar), pra evitar channel lixo se ele
 * fechar a aba antes.
 */
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const cookieState = req.cookies.get('google_oauth_state')?.value

    const errorUrl = new URL(
        '/settings/integrations/google-calendar',
        req.url,
    )

    if (error) {
        errorUrl.searchParams.set('error', error)
        return NextResponse.redirect(errorUrl)
    }
    if (!code || !state || !cookieState || state !== cookieState) {
        errorUrl.searchParams.set('error', 'invalid_state')
        return NextResponse.redirect(errorUrl)
    }

    // Busca trainer
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) {
        errorUrl.searchParams.set('error', 'trainer_not_found')
        return NextResponse.redirect(errorUrl)
    }

    // Troca code por tokens
    let tokens
    try {
        tokens = await exchangeCodeForTokens(code)
    } catch (err) {
        console.error('[google-callback] token exchange error:', err)
        errorUrl.searchParams.set('error', 'token_exchange_failed')
        return NextResponse.redirect(errorUrl)
    }

    if (!tokens.refresh_token) {
        // Pode acontecer se o trainer já deu consent antes. Force prompt=consent
        // na /start deveria prevenir; se chegar aqui, pedimos pra reconectar.
        errorUrl.searchParams.set('error', 'missing_refresh_token')
        return NextResponse.redirect(errorUrl)
    }

    const userInfo = await fetchUserInfo(tokens.access_token).catch(() => null)
    if (!userInfo) {
        errorUrl.searchParams.set('error', 'userinfo_failed')
        return NextResponse.redirect(errorUrl)
    }

    const calendarsResult = await listCalendars(tokens.access_token)
    if (!calendarsResult.ok) {
        console.error('[google-callback] list calendars error:', {
            status: calendarsResult.status,
            kind: calendarsResult.kind,
            message: calendarsResult.message,
            scope: tokens.scope,
            email: userInfo.email,
        })
        errorUrl.searchParams.set('error', 'calendar_list_failed')
        errorUrl.searchParams.set('detail', calendarsResult.message.slice(0, 200))
        return NextResponse.redirect(errorUrl)
    }
    const primaryCalendar =
        calendarsResult.data.items.find((c) => c.primary) ??
        calendarsResult.data.items[0]
    if (!primaryCalendar) {
        errorUrl.searchParams.set('error', 'no_calendars')
        return NextResponse.redirect(errorUrl)
    }

    // Upsert da conexão com o calendar primário como default.
    const expiresAt = new Date(
        Date.now() + tokens.expires_in * 1000,
    ).toISOString()
    const { error: upsertError } = await supabaseAdmin
        .from('google_calendar_connections')
        .upsert(
            {
                trainer_id: trainer.id,
                google_account_email: userInfo.email,
                calendar_id: primaryCalendar.id,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                access_token_expires_at: expiresAt,
                scope: tokens.scope ?? GOOGLE_SCOPES.join(' '),
                status: 'active',
                // Watch channel é criado no próximo passo (select-calendar)
                watch_channel_id: null,
                watch_resource_id: null,
                watch_expires_at: null,
                last_sync_error: null,
            },
            { onConflict: 'trainer_id' },
        )
    if (upsertError) {
        console.error('[google-callback] upsert error:', upsertError)
        errorUrl.searchParams.set('error', 'save_failed')
        return NextResponse.redirect(errorUrl)
    }

    // Cookie cleanup
    const redirect = new URL(
        '/settings/integrations/google-calendar?step=select',
        req.url,
    )
    const res = NextResponse.redirect(redirect)
    res.cookies.delete('google_oauth_state')
    return res
}
