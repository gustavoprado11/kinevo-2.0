import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/** Attribution first-touch (auditoria 13/jul): na PRIMEIRA visita com UTM ou
 *  referrer externo, grava um cookie de 30 dias que o signup persiste em
 *  `trainers.signup_source`. First-touch: cookie existente não é sobrescrito. */
const ATTR_COOKIE = 'kv_attr'

function captureAttribution(request: NextRequest, response: NextResponse) {
    try {
        if (request.method !== 'GET') return
        if (request.cookies.has(ATTR_COOKIE)) return

        const url = request.nextUrl
        const attrs: Record<string, string> = {}
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref']) {
            const v = url.searchParams.get(k)
            if (v) attrs[k] = v.slice(0, 120)
        }
        try {
            const referrer = request.headers.get('referer')
            const h = referrer ? new URL(referrer).hostname : ''
            if (h && !h.endsWith('kinevoapp.com') && h !== url.hostname) attrs.referrer = h
        } catch { /* referrer inválido */ }

        if (Object.keys(attrs).length === 0) return

        attrs.landing = url.pathname.slice(0, 120)
        attrs.at = new Date().toISOString()
        response.cookies.set(ATTR_COOKIE, JSON.stringify(attrs), {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        })
    } catch {
        // attribution jamais quebra a request
    }
}

export default async function proxy(request: NextRequest) {
    const response = await updateSession(request)
    captureAttribution(request, response)
    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api/webhooks, api/stripe/webhook, api/stripe/cancel-subscription
         *   (Stripe webhooks — signature-based auth, must not run cookie middleware)
         * - api/cron (protected by CRON_SECRET Bearer)
         * - api/financial, api/notifications, api/prescription/generate,
         *   api/programs/assign, api/messages/notify-trainer,
         *   api/messages/notify-student, api/stripe/portal, api/wallet
         *   (mobile-first endpoints — authenticate via
         *   `Authorization: Bearer <supabase_access_token>`, NOT cookies.
         *   Running this cookie-based middleware would redirect mobile requests
         *   to /login. SECURITY CONTRACT: every route.ts inside these folders
         *   MUST call `supabaseAdmin.auth.getUser(token)` on the Bearer token
         *   and reject with 401 if absent/invalid. Do not add cookie-auth routes
         *   here — create them elsewhere.)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|twitter-image|api/webhooks|api/stripe/webhook|api/stripe/cancel-subscription|api/cron|api/financial|api/notifications|api/prescription/generate|api/programs/assign|api/messages/notify-trainer|api/messages/notify-student|api/stripe/portal|api/wallet|api/student|api/trainer|api/mcp|oauth/register|oauth/token|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
