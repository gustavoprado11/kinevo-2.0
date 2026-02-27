// ---------------------------------------------------------------------------
// Onboarding State — shared between web and any future consumer
// ---------------------------------------------------------------------------

export interface OnboardingMilestones {
  first_student_created: boolean
  first_program_created: boolean
  first_program_assigned: boolean
  first_exercise_added: boolean
  first_form_sent: boolean
  financial_setup: boolean
  app_link_shared: boolean
}

export interface OnboardingState {
  welcome_tour_completed: boolean
  checklist_dismissed: boolean
  tours_completed: string[]
  tips_dismissed: string[]
  milestones: OnboardingMilestones
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  welcome_tour_completed: false,
  checklist_dismissed: false,
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
  },
}

export const TOTAL_MILESTONES = 7
