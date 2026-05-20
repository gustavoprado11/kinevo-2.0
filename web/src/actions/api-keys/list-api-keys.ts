'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function listApiKeys() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Não autorizado' }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!trainer) return { success: false as const, error: 'Treinador não encontrado' }

  const { data, error } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('trainer_id', trainer.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return { success: false as const, error: error.message }

  return { success: true as const, data: data ?? [] }
}
