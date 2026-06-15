'use server'

import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function generateApiKey(name?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Não autorizado' }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!trainer) return { success: false as const, error: 'Treinador não encontrado' }

  // Check limit: max 5 active keys
  const { count } = await supabaseAdmin
    .from('trainer_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainer.id)
    .is('revoked_at', null)

  if (count && count >= 5) {
    return { success: false as const, error: 'Limite de 5 API Keys ativas atingido. Revogue uma key existente.' }
  }

  const rawKey = `kinevo_trainer_${randomUUID()}`
  const keyHash = await bcrypt.hash(rawKey, 12)
  // Prefixo indexado de 23 chars = "kinevo_trainer_" (15) + 8 hex do uuid, que
  // varia por chave. Antes era slice(0,12) = sempre "kinevo_train" (constante),
  // o que fazia o lookup casar TODAS as keys e rodar N×bcrypt por token inválido.
  const keyPrefix = rawKey.slice(0, 23)

  const { data, error } = await supabaseAdmin
    .from('trainer_api_keys')
    .insert({
      trainer_id: trainer.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name?.trim() || 'Minha API Key',
    })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) return { success: false as const, error: error.message }

  return { success: true as const, data: { ...data, raw_key: rawKey } }
}
