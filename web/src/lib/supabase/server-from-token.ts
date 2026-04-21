import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase server-side client authenticated via a Bearer JWT.
 *
 * Used by API route handlers invoked from the mobile app, which doesn't
 * carry cookies. Mirrors the pattern in:
 *   - web/src/app/api/prescription/generate/route.ts (pre-2.5.1)
 *   - web/src/app/api/programs/assign/route.ts
 *
 * RLS is respected identically to the cookie-based server client: the JWT
 * resolves to `auth.uid()` on the server, which is what `current_trainer_id()`
 * and the other RLS helpers use.
 */
export function createServerClientFromToken(token: string): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        throw new Error(
            'createServerClientFromToken: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
        )
    }
    if (!token) {
        throw new Error('createServerClientFromToken: token is required')
    }

    return createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    })
}
