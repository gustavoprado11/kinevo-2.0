import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
    console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está configurada no arquivo .env.local')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
