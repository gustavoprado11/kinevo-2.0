-- Migration 039: Add onboarding state to trainers
-- Purely additive: new JSONB column with DEFAULT. No existing data affected.
-- All existing trainers receive the default (fresh onboarding state) so they
-- also go through the onboarding flow on next login.

ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS onboarding_state JSONB DEFAULT '{
  "welcome_tour_completed": false,
  "checklist_dismissed": false,
  "tours_completed": [],
  "tips_dismissed": [],
  "milestones": {
    "first_student_created": false,
    "first_program_created": false,
    "first_program_assigned": false,
    "first_exercise_added": false,
    "first_form_sent": false,
    "financial_setup": false,
    "app_link_shared": false
  }
}'::jsonb;

-- GIN index for any future queries filtering by onboarding state
CREATE INDEX IF NOT EXISTS idx_trainers_onboarding_state
ON trainers USING gin (onboarding_state);
