'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'

const VALID_VALUES: TrainerModalityFocus[] = [
  'presencial',
  'online',
  'ambos',
  null,
]

/**
 * Fase 17b — atualiza `trainers.modality_focus`.
 * Usado pelo Welcome Modal v2 (step 'modality') e pelo
 * Modality Inference Toast (aceita sugestão).
 */
export async function updateTrainerModality(
  focus: TrainerModalityFocus,
): Promise<{ success?: boolean; error?: string }> {
  if (!VALID_VALUES.includes(focus)) {
    return { error: 'Valor inválido para modality_focus' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('trainers')
    .update({ modality_focus: focus })
    .eq('auth_user_id', user.id)

  if (error) {
    console.error('[updateTrainerModality] error', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
