-- ============================================================================
-- Kinevo — 097 Fix pending actions: exclude pre/post_workout forms, add student_id
-- ============================================================================
-- Changes:
--   1) Pending forms: exclude pre_workout and post_workout trigger_context
--      (same as web dashboard) + add student_id for navigation
--   2) Pending financial: add student_id for navigation
--   3) Expiring programs: add student_id for navigation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_trainer_pending_actions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_pending_financial JSONB;
    v_pending_forms JSONB;
    v_inactive_students JSONB;
    v_expiring_programs JSONB;
    v_five_days_ago TIMESTAMPTZ;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    v_five_days_ago := now() - INTERVAL '5 days';

    -- Pending financial: overdue or pending contracts (+ student_id)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.current_period_end ASC NULLS LAST), '[]'::jsonb)
    INTO v_pending_financial
    FROM (
        SELECT sc.id,
               sc.student_id,
               s.name AS student_name,
               s.avatar_url AS student_avatar,
               sc.amount,
               sc.billing_type,
               sc.status,
               sc.current_period_end
        FROM student_contracts sc
        JOIN students s ON s.id = sc.student_id
        WHERE sc.trainer_id = v_trainer_id
          AND sc.status IN ('past_due', 'pending')
        ORDER BY sc.current_period_end ASC NULLS LAST
        LIMIT 10
    ) sub;

    -- Pending forms: submitted without feedback
    -- Exclude pre_workout and post_workout (filled during workout sessions, not actionable here)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.submitted_at DESC), '[]'::jsonb)
    INTO v_pending_forms
    FROM (
        SELECT fs.id,
               fs.student_id,
               s.name AS student_name,
               s.avatar_url AS student_avatar,
               ft.title AS template_title,
               fs.submitted_at
        FROM form_submissions fs
        JOIN students s ON s.id = fs.student_id
        JOIN form_templates ft ON ft.id = fs.form_template_id
        WHERE fs.trainer_id = v_trainer_id
          AND fs.status = 'submitted'
          AND fs.feedback_sent_at IS NULL
          AND fs.trigger_context NOT IN ('pre_workout', 'post_workout')
        ORDER BY fs.submitted_at DESC
        LIMIT 10
    ) sub;

    -- Inactive students: have active program but no session in 5+ days
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.days_since_last_session DESC), '[]'::jsonb)
    INTO v_inactive_students
    FROM (
        SELECT s.id,
               s.name,
               s.avatar_url,
               ap.name AS program_name,
               COALESCE(
                   EXTRACT(DAY FROM now() - (
                       SELECT max(ws.completed_at)
                       FROM workout_sessions ws
                       WHERE ws.student_id = s.id
                         AND ws.trainer_id = v_trainer_id
                         AND ws.status = 'completed'
                   ))::int,
                   999
               ) AS days_since_last_session
        FROM assigned_programs ap
        JOIN students s ON s.id = ap.student_id
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
          AND NOT EXISTS (
              SELECT 1 FROM workout_sessions ws
              WHERE ws.student_id = s.id
                AND ws.trainer_id = v_trainer_id
                AND ws.status = 'completed'
                AND ws.completed_at >= v_five_days_ago
          )
        ORDER BY days_since_last_session DESC
        LIMIT 10
    ) sub;

    -- Expiring programs: ending in <= 7 days (+ student_id)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.ends_in_days ASC), '[]'::jsonb)
    INTO v_expiring_programs
    FROM (
        SELECT ap.student_id,
               s.name AS student_name,
               s.avatar_url AS student_avatar,
               ap.name AS program_name,
               ap.duration_weeks,
               ((ap.started_at::date + (ap.duration_weeks * 7)) - CURRENT_DATE) AS ends_in_days
        FROM assigned_programs ap
        JOIN students s ON s.id = ap.student_id
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
          AND ap.started_at IS NOT NULL
          AND ap.duration_weeks IS NOT NULL
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
          AND (ap.started_at::date + (ap.duration_weeks * 7)) - CURRENT_DATE <= 7
        ORDER BY ends_in_days ASC
    ) sub;

    RETURN jsonb_build_object(
        'pendingFinancial', v_pending_financial,
        'pendingForms', v_pending_forms,
        'inactiveStudents', v_inactive_students,
        'expiringPrograms', v_expiring_programs
    );
END;
$$;
