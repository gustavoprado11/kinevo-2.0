'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@kinevo/shared/types/database'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'

// Client debounces at 800ms, so legitimate flow is <=~75 calls/min in the
// worst case. Anything beyond that is abuse or a runaway loop.
const MAX_TOUR_ENTRIES = 100
const MAX_TIP_ENTRIES = 200
const MAX_STRING_LEN = 100

function sanitizeIds(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= MAX_STRING_LEN)
}

// Snooze do checklist: aceita ISO 8601 válido ou null. Rejeita garbage e datas
// >1 ano no passado (sinal de bug de cliente). Fase 17a.
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
function sanitizeSnoozedUntil(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return null
  if (ts < Date.now() - ONE_YEAR_MS) return null
  return new Date(ts).toISOString()
}

function sanitizeBool(value: unknown): boolean {
  return value === true
}

export async function updateOnboardingState(
  newState: OnboardingState,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: 'Not authenticated' }
    }

    const rateLimitKey = `onboarding:update:${user.id}`
    const limit = checkRateLimit(rateLimitKey, { perMinute: 60, perDay: 1000 })
    if (!limit.allowed) {
      return { error: limit.error || 'Rate limit exceeded' }
    }
    recordRequest(rateLimitKey)

    // Fetch current state to ensure we have the trainer
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .select('id, onboarding_state')
      .eq('auth_user_id', user.id)
      .single()

    if (trainerError || !trainer) {
      return { error: 'Trainer not found' }
    }

    // Deep merge: incoming state takes precedence, but we union arrays.
    //
    // BUGFIX: `current` (estado salvo no DB) pode ser legado/parcial — trainers
    // antigos têm onboarding_state sem os arrays tours_completed/tips_dismissed.
    // O spread direto (`...current.tours_completed`) lançava TypeError quando o
    // campo era undefined → a action caía no catch e retornava { error } de forma
    // SILENCIOSA (o cliente só trata exceções, não o { error } retornado) →
    // NENHUMA dispensa de banner/onboarding persistia e tudo reaparecia a cada
    // load. Normalizamos os arrays (sanitizeIds tolera não-array → []) para nunca
    // lançar. Os demais campos já são tolerantes (sanitizeBool/sanitizeSnoozedUntil
    // e milestones via ?? {}).
    const rawCurrent =
      (trainer.onboarding_state as unknown as Partial<OnboardingState>) ?? {}
    const current: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      ...rawCurrent,
      tours_completed: sanitizeIds(rawCurrent.tours_completed),
      tips_dismissed: sanitizeIds(rawCurrent.tips_dismissed),
      milestones: {
        ...DEFAULT_ONBOARDING_STATE.milestones,
        ...(rawCurrent.milestones ?? {}),
      },
    }

    const incomingTours = sanitizeIds(newState.tours_completed)
    const incomingTips = sanitizeIds(newState.tips_dismissed)

    // Milestones do cliente legado podem vir sem os campos novos (mobile_logged_in,
    // first_training_room_session). Defesa via ?? false. Mesma defesa pro current
    // — DB de trainers antigos não tem esses campos no JSON.
    const incomingMilestones = newState.milestones ?? ({} as Partial<OnboardingState['milestones']>)
    const currentMilestones = current.milestones ?? ({} as Partial<OnboardingState['milestones']>)

    // checklist_snoozed_until: server-wins se existir e ainda for futuro; senão usa
    // o sanitizado do cliente. Não é union/OR — é "último valor válido vence".
    const incomingSnooze = sanitizeSnoozedUntil(newState.checklist_snoozed_until)
    const currentSnooze = sanitizeSnoozedUntil(current.checklist_snoozed_until)
    const mergedSnoozedUntil = incomingSnooze ?? currentSnooze

    const merged: OnboardingState = {
      welcome_tour_completed:
        sanitizeBool(newState.welcome_tour_completed) || sanitizeBool(current.welcome_tour_completed),
      checklist_dismissed:
        sanitizeBool(newState.checklist_dismissed) || sanitizeBool(current.checklist_dismissed),
      checklist_snoozed_until: mergedSnoozedUntil,
      tours_completed: Array.from(
        new Set([...current.tours_completed, ...incomingTours]),
      ).slice(0, MAX_TOUR_ENTRIES),
      tips_dismissed: Array.from(
        new Set([...current.tips_dismissed, ...incomingTips]),
      ).slice(0, MAX_TIP_ENTRIES),
      milestones: {
        first_student_created:
          sanitizeBool(incomingMilestones.first_student_created) ||
          sanitizeBool(currentMilestones.first_student_created),
        first_program_created:
          sanitizeBool(incomingMilestones.first_program_created) ||
          sanitizeBool(currentMilestones.first_program_created),
        first_program_assigned:
          sanitizeBool(incomingMilestones.first_program_assigned) ||
          sanitizeBool(currentMilestones.first_program_assigned),
        first_exercise_added:
          sanitizeBool(incomingMilestones.first_exercise_added) ||
          sanitizeBool(currentMilestones.first_exercise_added),
        first_form_sent:
          sanitizeBool(incomingMilestones.first_form_sent) ||
          sanitizeBool(currentMilestones.first_form_sent),
        financial_setup:
          sanitizeBool(incomingMilestones.financial_setup) ||
          sanitizeBool(currentMilestones.financial_setup),
        app_link_shared:
          sanitizeBool(incomingMilestones.app_link_shared) ||
          sanitizeBool(currentMilestones.app_link_shared),
        mobile_logged_in:
          sanitizeBool(incomingMilestones.mobile_logged_in) ||
          sanitizeBool(currentMilestones.mobile_logged_in),
        first_training_room_session:
          sanitizeBool(incomingMilestones.first_training_room_session) ||
          sanitizeBool(currentMilestones.first_training_room_session),
        landing_published:
          sanitizeBool(incomingMilestones.landing_published) ||
          sanitizeBool(currentMilestones.landing_published),
      },
    }

    const { error: updateError } = await supabase
      .from('trainers')
      .update({ onboarding_state: merged as unknown as Json })
      .eq('id', trainer.id)

    if (updateError) {
      return { error: updateError.message }
    }

    // Garante que páginas que recebem trainer.onboarding_state via getTrainerWithSubscription
    // (ex.: /forms, /avaliacoes, /dashboard) leiam o valor mais recente após F5.
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (error) {
    console.error('[updateOnboardingState] Unexpected error:', error)
    return { error: 'Unexpected error' }
  }
}
