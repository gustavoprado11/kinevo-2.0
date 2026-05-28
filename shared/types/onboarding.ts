// ---------------------------------------------------------------------------
// Onboarding State — shared between web and any future consumer
// ---------------------------------------------------------------------------

/**
 * Modalidade de atuação declarada pelo trainer. Drives personalization no
 * onboarding v2 (welcome, checklist, tours).
 *
 * - `presencial` — atende somente presencial (Sala de Treino + captura)
 * - `online` — atende somente online (forms + Stripe + notificações)
 * - `ambos` — híbrido
 * - `null` — ainda não respondeu; UI deve tratar como "ambos" (mostra tudo)
 *
 * Mora em `trainers.modality_focus`, NÃO em `OnboardingState`. É dado
 * declarativo sobre o trainer, não estado efêmero. Fase 17a.
 */
export type TrainerModalityFocus = 'presencial' | 'online' | 'ambos' | null

export interface OnboardingMilestones {
  first_student_created: boolean
  first_program_created: boolean
  first_program_assigned: boolean
  first_exercise_added: boolean
  first_form_sent: boolean
  financial_setup: boolean
  app_link_shared: boolean
  mobile_logged_in: boolean
  first_training_room_session: boolean
  landing_published: boolean
}

export interface OnboardingState {
  welcome_tour_completed: boolean
  checklist_dismissed: boolean
  /** ISO 8601 timestamp. Null = não está em snooze. Maior que now() = está em snooze. Fase 17a. */
  checklist_snoozed_until: string | null
  tours_completed: string[]
  tips_dismissed: string[]
  milestones: OnboardingMilestones
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  welcome_tour_completed: false,
  checklist_dismissed: false,
  checklist_snoozed_until: null,
  tours_completed: [],
  tips_dismissed: [],
  milestones: {
    first_student_created: false,
    first_program_created: false,
    first_program_assigned: false,
    first_exercise_added: false,
    first_form_sent: false,
    financial_setup: false,
    app_link_shared: false,
    mobile_logged_in: false,
    first_training_room_session: false,
    landing_published: false,
  },
}

export const TOTAL_MILESTONES = 10
