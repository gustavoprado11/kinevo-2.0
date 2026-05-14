'use server'

import { createClient } from '@/lib/supabase/server'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'

interface InferResult {
  inferred: TrainerModalityFocus
  dominantRatio: number
  totalStudents: number
  error?: string
}

/**
 * Fase 17b — infere `modality_focus` provável do trainer com base na
 * distribuição de `students.modality`. Sugere uma modalidade quando uma
 * delas representa >= 80% dos alunos do trainer e há pelo menos 3 alunos.
 *
 * IMPORTANTE: valores reais em prod são `'online'` e `'presential'` (inglês).
 * A função normaliza pra `'presencial'` antes de comparar (spec §6.6).
 */
function normalizeStudentModality(
  raw: string | null,
): TrainerModalityFocus {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  if (lower === 'presential' || lower === 'presencial') return 'presencial'
  if (lower === 'online') return 'online'
  return null
}

export async function inferModality(): Promise<InferResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      inferred: null,
      dominantRatio: 0,
      totalStudents: 0,
      error: 'Não autenticado',
    }
  }

  // Pega o trainer.id do trainers table
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!trainer) {
    return {
      inferred: null,
      dominantRatio: 0,
      totalStudents: 0,
      error: 'Trainer não encontrado',
    }
  }

  const { data: students, error } = await supabase
    .from('students')
    .select('modality')
    .eq('coach_id', trainer.id)

  if (error) {
    return {
      inferred: null,
      dominantRatio: 0,
      totalStudents: 0,
      error: error.message,
    }
  }

  const total = students?.length ?? 0
  if (total < 3) {
    return { inferred: null, dominantRatio: 0, totalStudents: total }
  }

  let presencial = 0
  let online = 0
  for (const s of students ?? []) {
    const norm = normalizeStudentModality((s as { modality: string | null }).modality)
    if (norm === 'presencial') presencial += 1
    else if (norm === 'online') online += 1
  }

  const presencialRatio = presencial / total
  const onlineRatio = online / total

  let inferred: TrainerModalityFocus = null
  let dominantRatio = 0
  if (presencialRatio >= 0.8) {
    inferred = 'presencial'
    dominantRatio = presencialRatio
  } else if (onlineRatio >= 0.8) {
    inferred = 'online'
    dominantRatio = onlineRatio
  }

  return { inferred, dominantRatio, totalStudents: total }
}
