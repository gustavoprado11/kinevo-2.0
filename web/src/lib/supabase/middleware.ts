import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    // Strip any client-supplied x-user-id: downstream code trusts this header as
    // the authenticated user id, so it must ONLY ever be set by us (below) from
    // the verified session — never forwarded from the incoming request.
    // request.headers is immutable in middleware, so we thread a sanitized copy.
    const sanitizedHeaders = new Headers(request.headers)
    sanitizedHeaders.delete('x-user-id')

    let supabaseResponse = NextResponse.next({
        request: { headers: sanitizedHeaders },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request: { headers: sanitizedHeaders },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Use getSession() instead of getUser() — reads from cookie locally
    // without a roundtrip to Supabase Auth API (~100-200ms saved per navigation).
    // Pages that need fresh user data still call getUser() in their own server code.
    const {
        data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    // Protected routes - redirect to login if not authenticated
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/signup') &&
        !request.nextUrl.pathname.startsWith('/estudio') &&
        !request.nextUrl.pathname.startsWith('/com/') &&
        !request.nextUrl.pathname.startsWith('/privacy') &&
        !request.nextUrl.pathname.startsWith('/terms') &&
        !request.nextUrl.pathname.startsWith('/docs') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/android') &&
        !request.nextUrl.pathname.startsWith('/strava-callback') &&
        !request.nextUrl.pathname.startsWith('/oura-callback') &&
        !request.nextUrl.pathname.startsWith('/sitemap') &&
        !request.nextUrl.pathname.startsWith('/robots') &&
        !request.nextUrl.pathname.startsWith('/api/webhooks') &&
        !request.nextUrl.pathname.startsWith('/api/stripe/webhook') &&
        !request.nextUrl.pathname.startsWith('/api/stripe/cancel-subscription') &&
        !request.nextUrl.pathname.startsWith('/api/cron') &&
        !request.nextUrl.pathname.startsWith('/api/financial') &&
        !request.nextUrl.pathname.startsWith('/api/notifications') &&
        !request.nextUrl.pathname.startsWith('/api/prescription/generate') &&
        !request.nextUrl.pathname.startsWith('/api/programs/assign') &&
        !request.nextUrl.pathname.startsWith('/api/messages/notify-trainer') &&
        !request.nextUrl.pathname.startsWith('/api/messages/notify-student') &&
        !request.nextUrl.pathname.startsWith('/api/stripe/portal') &&
        !request.nextUrl.pathname.startsWith('/subscription') &&
        request.nextUrl.pathname !== '/'
    ) {
        // Preserve the originally-requested path (+query) so the login page can
        // send the user back after authenticating. Critical for the OAuth flow:
        // an unauthenticated reviewer hitting /oauth/authorize?... must return to
        // the consent screen, not /dashboard, or the auth code is never issued.
        const intended = request.nextUrl.pathname + request.nextUrl.search
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        url.searchParams.set('redirect', intended)
        return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from login/signup pages
    if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // Redirect root to dashboard if authenticated
    if (request.nextUrl.pathname === '/') {
        if (user) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }
        // If not authenticated, allow the request to proceed (show landing page)
    }

    // Propagate the resolved auth user id to downstream Server Components via a
    // request header so getTrainerWithSubscription() can skip another getUser()
    // roundtrip to Supabase Auth (~100-300ms saved per authenticated navigation).
    if (user) {
        // Build from the sanitized copy (client x-user-id already removed),
        // then set the authoritative value from the verified session.
        sanitizedHeaders.set('x-user-id', user.id)
        const finalResponse = NextResponse.next({ request: { headers: sanitizedHeaders } })
        // Carry forward any cookies Supabase set during the session refresh above
        supabaseResponse.cookies.getAll().forEach(c => finalResponse.cookies.set(c))
        return finalResponse
    }

    return supabaseResponse
}
