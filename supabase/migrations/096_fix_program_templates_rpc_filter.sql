-- ============================================================================
-- Migration 096: Fix get_trainer_program_templates() to filter by is_template
-- ============================================================================
-- The RPC was missing the is_template = true filter, causing the mobile app
-- to show non-template programs (e.g. one-off programs) in the assignment list.
-- The web version already filters correctly via get-trainer-programs.ts.
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
               )::int AS workout_count
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
