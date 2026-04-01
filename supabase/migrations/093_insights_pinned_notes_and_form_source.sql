-- Add 'pinned_note' category and 'trainer' source to assistant_insights
-- This allows trainers to pin manual notes alongside AI-generated insights,
-- and enables form-based insight extraction.

ALTER TABLE public.assistant_insights DROP CONSTRAINT IF EXISTS assistant_insights_category_check;
ALTER TABLE public.assistant_insights ADD CONSTRAINT assistant_insights_category_check
    CHECK (category IN ('alert', 'progression', 'suggestion', 'summary', 'pinned_note'));

ALTER TABLE public.assistant_insights DROP CONSTRAINT IF EXISTS assistant_insights_source_check;
ALTER TABLE public.assistant_insights ADD CONSTRAINT assistant_insights_source_check
    CHECK (source IN ('rules', 'llm', 'trainer'));
