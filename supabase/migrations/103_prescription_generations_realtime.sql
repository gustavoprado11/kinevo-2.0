-- Phase 1.5 — Perceived streaming for AI prescription generation.
--
-- Adds public.prescription_generations to the supabase_realtime publication so
-- the builder client can subscribe to UPDATEs on the row being generated and
-- reveal workouts progressively as the pipeline finishes.
--
-- Idempotent: re-applying this migration in an environment where the table is
-- already in the publication is a no-op. We catch only the specific
-- `duplicate_object` exception so real errors (missing publication, missing
-- table, etc.) still surface.
--
-- RLS is unchanged. The existing policy on prescription_generations
-- (trainer_id = current_trainer_id()) is what filters rows delivered to a
-- given client. Supabase Realtime respects RLS for postgres_changes events.

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prescription_generations;
EXCEPTION
    WHEN duplicate_object THEN
        -- Already in publication; nothing to do.
        NULL;
END $$;
