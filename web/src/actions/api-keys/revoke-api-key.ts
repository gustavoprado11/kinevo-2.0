'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function revokeApiKey(keyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Não autorizado' }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!trainer) return { success: false as const, error: 'Treinador não encontrado' }

  const { error } = await supabaseAdmin
    .from('trainer_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('trainer_id', trainer.id)
    .is('revoked_at', null)

  if (error) return { success: false as const, error: error.message }

  return { success: true as const }
}
