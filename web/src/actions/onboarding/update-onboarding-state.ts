'use server'

import { createClient } from '@/lib/supabase/server'
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

    // Deep merge: incoming state takes precedence, but we union arrays
    const current = (trainer.onboarding_state as OnboardingState) ?? DEFAULT_ONBOARDING_STATE

    const incomingTours = sanitizeIds(newState.tours_completed)
    const incomingTips = sanitizeIds(newState.tips_dismissed)

    const merged: OnboardingState = {
      welcome_tour_completed:
        newState.welcome_tour_completed || current.welcome_tour_completed,
      checklist_dismissed:
        newState.checklist_dismissed || current.checklist_dismissed,
      tours_completed: Array.from(
        new Set([...current.tours_completed, ...incomingTours]),
      ).slice(0, MAX_TOUR_ENTRIES),
      tips_dismissed: Array.from(
        new Set([...current.tips_dismissed, ...incomingTips]),
      ).slice(0, MAX_TIP_ENTRIES),
      milestones: {
        first_student_created:
          newState.milestones.first_student_created ||
          current.milestones.first_student_created,
        first_program_created:
          newState.milestones.first_program_created ||
          current.milestones.first_program_created,
        first_program_assigned:
          newState.milestones.first_program_assigned ||
          current.milestones.first_program_assigned,
        first_exercise_added:
          newState.milestones.first_exercise_added ||
          current.milestones.first_exercise_added,
        first_form_sent:
          newState.milestones.first_form_sent ||
          current.milestones.first_form_sent,
        financial_setup:
          newState.milestones.financial_setup ||
          current.milestones.financial_setup,
        app_link_shared:
          newState.milestones.app_link_shared ||
          current.milestones.app_link_shared,
      },
    }

    const { error: updateError } = await supabase
      .from('trainers')
      .update({ onboarding_state: merged })
      .eq('id', trainer.id)

    if (updateError) {
      return { error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[updateOnboardingState] Unexpected error:', error)
    return { error: 'Unexpected error' }
  }
}
