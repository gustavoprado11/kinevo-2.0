// Defense-in-depth: garante que este módulo (service-role, bypassa RLS) NUNCA
// seja importado por um Client Component. Se algum 'use client' importar isto
// (direta ou indiretamente), o build FALHA — em vez de embarcar a service-role
// key no bundle do navegador.
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
    console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está configurada no arquivo .env.local')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
