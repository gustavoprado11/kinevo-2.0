-- ============================================================================
-- Migration 115: Add agent_answers to student_prescription_profiles
-- ============================================================================
-- Persists the trainer's most recent answers to the agent's clarifying
-- questions ("Refinar" step). When the panel reopens for the same student,
-- previous answers are pre-selected — the trainer just confirms or changes
-- instead of re-answering identical questions every cycle.
--
-- Storage shape: JSONB object keyed by question_id (stable identifiers like
-- 'volume_tradeoff', 'adherence_barrier', etc.). Values are structured
-- answer objects matching the AgentQuestionsPanel local state:
--   { selectedOptions: string[], textInput: string }
--
-- Example:
--   {
--     "volume_tradeoff": { "selectedOptions": ["Manter 5 exercícios"], "textInput": "" },
--     "adherence_barrier": { "selectedOptions": ["Falta de tempo"], "textInput": "agenda corrida" }
--   }
-- ============================================================================

ALTER TABLE public.student_prescription_profiles
    ADD COLUMN IF NOT EXISTS agent_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.student_prescription_profiles.agent_answers IS
    'Trainer''s most recent answers to the agent clarifying questions, keyed by stable question_id. Structured form { selectedOptions: string[], textInput: string }. Pre-fills the Refinar panel on subsequent generations so the trainer doesn''t answer the same questions every cycle.';
