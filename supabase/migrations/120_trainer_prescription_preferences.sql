-- Migration 120: Add prescription preferences to trainers
-- Purely additive: new JSONB column with DEFAULT. No existing data affected.
-- All existing trainers receive the Kinevo default preferences and will see
-- the onboarding wizard banner on the program builder until completed/dismissed.

ALTER TABLE trainers
ADD COLUMN IF NOT EXISTS prescription_preferences JSONB DEFAULT '{
  "wizard_completed": false,
  "wizard_dismissed": false,
  "visualization": {
    "default_view": "preview",
    "library_open_on_enter": true
  },
  "set_defaults": {
    "sets": "3-4",
    "reps": "8-12",
    "rest_compound_seconds": 90,
    "rest_isolation_seconds": 60,
    "tempo": null,
    "load_method": "kg",
    "visible_fields": ["sets", "reps", "load", "rest"]
  },
  "add_exercise": {
    "open_mode": "simplified",
    "auto_warmup": false
  },
  "quick_blocks": {
    "warmup_template": null,
    "aerobic_template": null,
    "note_template": null
  },
  "program_structure": {
    "default_weeks": 4,
    "default_workout_count": 3,
    "naming_convention": "letter"
  },
  "ai": {
    "focus": "hypertrophy",
    "variation": "moderate"
  }
}'::jsonb;

-- GIN index for any future queries filtering by prescription preferences
CREATE INDEX IF NOT EXISTS idx_trainers_prescription_preferences
ON trainers USING gin (prescription_preferences);
