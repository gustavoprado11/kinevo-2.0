/**
 * Google Calendar — OAuth 2.0 helpers
 *
 * Escopos pedidos:
 *  - calendar         (ler + escrever eventos no calendário escolhido)
 *  - userinfo.email   (identificar a conta conectada)
 *
 * Não usamos o SDK oficial do Google pra evitar peso no bundle do Next.js.
 * A API é trivial: 2 endpoints (authorize + token).
 */

import type { GoogleOAuthTokenResponse, GoogleUserInfo } from '@kinevo/shared/types/google-calendar'

export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
] as const

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

interface OAuthEnv {
    clientId: string
    clientSecret: string
    redirectUri: string
}

/** Lê env vars. Lança se faltar algo — chamado apenas em rotas server-side. */
export function loadOAuthEnv(): OAuthEnv {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error(
            '[google-oauth] GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI não configurados',
        )
    }
    return { clientId, clientSecret, redirectUri }
}

/** Monta URL de autorização (redireciona o trainer pro Google). */
export function buildAuthorizeUrl(params: { state: string }): string {
    const env = loadOAuthEnv()
    const url = new URL(AUTH_URL)
    url.searchParams.set('client_id', env.clientId)
    url.searchParams.set('redirect_uri', env.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '))
    url.searchParams.set('access_type', 'offline') // refresh_token
    url.searchParams.set('prompt', 'consent') // garante refresh_token em re-auth
    url.searchParams.set('state', params.state)
    url.searchParams.set('include_granted_scopes', 'true')
    return url.toString()
}

/** Troca code por access_token + refresh_token. */
export async function exchangeCodeForTokens(
    code: string,
): Promise<GoogleOAuthTokenResponse> {
    const env = loadOAuthEnv()
    const body = new URLSearchParams({
        code,
        client_id: env.clientId,
        client_secret: env.clientSecret,
        redirect_uri: env.redirectUri,
        grant_type: 'authorization_code',
    })
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`[google-oauth] token exchange failed: ${res.status} ${text}`)
    }
    return (await res.json()) as GoogleOAuthTokenResponse
}

/** Refresh do access_token usando o refresh_token armazenado. */
export async function refreshAccessToken(
    refreshToken: string,
): Promise<GoogleOAuthTokenResponse> {
    const env = loadOAuthEnv()
    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.clientId,
        client_secret: env.clientSecret,
        grant_type: 'refresh_token',
    })
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`[google-oauth] refresh failed: ${res.status} ${text}`)
    }
    return (await res.json()) as GoogleOAuthTokenResponse
}

/** Busca email/nome da conta conectada. */
export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
        throw new Error(`[google-oauth] userinfo failed: ${res.status}`)
    }
    return (await res.json()) as GoogleUserInfo
}

/** Revoga explicitamente o token (usado quando trainer desconecta). */
export async function revokeToken(token: string): Promise<void> {
    // Resposta 200 indica revogado. 400 indica já inválido — tratamos como ok.
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined)
}
