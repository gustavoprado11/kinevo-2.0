-- ============================================================================
-- Migration 151: Add usage_count to get_trainer_program_templates()
-- ============================================================================
-- The mobile Program Template Library (Fase 1) needs to show how many students
-- are using each template — same "Usado Nx" metric the web /programs page shows.
-- We extend the existing RPC with a usage_count column derived from
-- assigned_programs.source_template_id (FK added in migration 001).
--
-- Backward-compat: additive only. Existing callers ignoring usage_count keep
-- working; the new field is appended to each row.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_trainer_program_templates()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_result JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.name ASC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT pt.id,
               pt.name,
               pt.description,
               pt.duration_weeks,
               pt.created_at,
               (
                   SELECT count(*)
                   FROM workout_templates wt
                   WHERE wt.program_template_id = pt.id
               )::int AS workout_count,
               (
                   SELECT count(*)
                   FROM assigned_programs ap
                   WHERE ap.source_template_id = pt.id
               )::int AS usage_count
        FROM program_templates pt
        WHERE pt.trainer_id = v_trainer_id
          AND pt.is_archived = false
          AND pt.is_template = true
        ORDER BY pt.name ASC
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
