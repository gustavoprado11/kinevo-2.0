-- ============================================================================
-- Migration 058: Add agent fields to prescription_generations
-- ============================================================================
-- Adds columns to support the multi-turn Claude agent prescriber:
-- - agent_conversation: Full conversation history with the agent (JSONB)
-- - context_analysis: Agent's analysis of student context (JSONB)
-- - web_search_queries: Search queries used by the agent (TEXT[])
--
-- Also extends the ai_source check constraint to include 'agent'.
-- ============================================================================

-- Add new columns
ALTER TABLE public.prescription_generations
    ADD COLUMN IF NOT EXISTS agent_conversation JSONB,
    ADD COLUMN IF NOT EXISTS context_analysis JSONB,
    ADD COLUMN IF NOT EXISTS web_search_queries TEXT[] DEFAULT '{}';

-- Update ai_source check to include 'agent'
ALTER TABLE public.prescription_generations
    DROP CONSTRAINT IF EXISTS prescription_generations_ai_source_check;

ALTER TABLE public.prescription_generations
    ADD CONSTRAINT prescription_generations_ai_source_check
    CHECK (ai_source IN ('llm', 'heuristic', 'agent'));

-- Add comment for documentation
COMMENT ON COLUMN public.prescription_generations.agent_conversation IS 'Full conversation history between the Claude agent and the system (multi-turn messages)';
COMMENT ON COLUMN public.prescription_generations.context_analysis IS 'Agent analysis of student context including gaps identified and web search insights';
COMMENT ON COLUMN public.prescription_generations.web_search_queries IS 'Search queries used by the agent for evidence-based prescription';
