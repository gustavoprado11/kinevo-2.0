import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl } from '@/lib/google-calendar/oauth'

/**
 * GET /settings/integrations/google-calendar/start
 *
 * Inicia o fluxo OAuth 2.0: gera `state` (nonce HMAC-like simples),
 * grava em cookie httpOnly e redireciona o trainer pro consentimento do
 * Google. O `callback` valida o state antes de aceitar o `code`.
 */
export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // State = random 32 bytes hex; guardamos em cookie httpOnly só pra esta sessão.
    const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const authUrl = buildAuthorizeUrl({ state })

    const res = NextResponse.redirect(authUrl)
    res.cookies.set('google_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
    })
    return res
}
