// Defense-in-depth: garante que este módulo (service-role, bypassa RLS) NUNCA
// seja importado por um Client Component. Se algum 'use client' importar isto
// (direta ou indiretamente), o build FALHA — em vez de embarcar a service-role
// key no bundle do navegador.
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

// This client bypasses RLS. Use ONLY on the server, in trusted environments.
export function createAdminClient() {
    return createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
