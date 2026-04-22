import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export default async function proxy(request: NextRequest) {
    return await updateSession(request)
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
         *   api/messages/notify-student, api/stripe/portal
         *   (mobile-first endpoints — authenticate via
         *   `Authorization: Bearer <supabase_access_token>`, NOT cookies.
         *   Running this cookie-based middleware would redirect mobile requests
         *   to /login. SECURITY CONTRACT: every route.ts inside these folders
         *   MUST call `supabaseAdmin.auth.getUser(token)` on the Bearer token
         *   and reject with 401 if absent/invalid. Do not add cookie-auth routes
         *   here — create them elsewhere.)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/webhooks|api/stripe/webhook|api/stripe/cancel-subscription|api/cron|api/financial|api/notifications|api/prescription/generate|api/programs/assign|api/messages/notify-trainer|api/messages/notify-student|api/stripe/portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
