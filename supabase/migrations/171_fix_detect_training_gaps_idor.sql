-- Security fix (RLS audit, 2026-06): IDOR in detect_training_gaps.
-- The function is SECURITY DEFINER (bypasses RLS) and took p_trainer_id without
-- verifying the caller IS that trainer, so anyone (even anon) could read any
-- trainer's students' names + activity. Fix: bind p_trainer_id to the caller and
-- remove the anon/public EXECUTE grant.

CREATE OR REPLACE FUNCTION public.detect_training_gaps(p_trainer_id uuid)
RETURNS TABLE(student_id uuid, student_name text, last_completed_at timestamptz, days_since_last integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT
        s.id AS student_id,
        s.name AS student_name,
        MAX(ws.completed_at) AS last_completed_at,
        COALESCE(DATE_PART('day', NOW() - MAX(ws.completed_at))::int, 999) AS days_since_last
    FROM students s
    JOIN assigned_programs ap ON ap.student_id = s.id
        AND ap.trainer_id = p_trainer_id
        AND ap.status = 'active'
    LEFT JOIN workout_sessions ws ON ws.student_id = s.id
        AND ws.status = 'completed'
    WHERE s.coach_id = p_trainer_id
        AND p_trainer_id = public.current_trainer_id()   -- bind result to the calling trainer
        AND s.status = 'active'
        AND s.is_trainer_profile IS NOT TRUE
    GROUP BY s.id, s.name
    HAVING MAX(ws.completed_at) IS NULL
        OR DATE_PART('day', NOW() - MAX(ws.completed_at)) >= 7
$function$;

REVOKE EXECUTE ON FUNCTION public.detect_training_gaps(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.detect_training_gaps(uuid) TO authenticated, service_role;
