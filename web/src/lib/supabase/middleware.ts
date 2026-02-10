import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
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
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and supabase.auth.getUser()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protected routes - redirect to login if not authenticated
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/signup') &&
        !request.nextUrl.pathname.startsWith('/privacy') &&
        !request.nextUrl.pathname.startsWith('/terms') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/api/webhooks') &&
        !request.nextUrl.pathname.startsWith('/subscription') &&
        request.nextUrl.pathname !== '/'
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
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

    return supabaseResponse
}
