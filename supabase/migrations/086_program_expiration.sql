-- Migration 086: Program Expiration
-- Adds 'expired' status, expires_at column, and backfills existing data.

-- 1. Add 'expired' to the status CHECK constraint
ALTER TABLE public.assigned_programs
    DROP CONSTRAINT assigned_programs_status_check;

ALTER TABLE public.assigned_programs
    ADD CONSTRAINT assigned_programs_status_check
    CHECK (status IN ('draft', 'active', 'scheduled', 'completed', 'paused', 'expired'));

-- 2. Add expires_at column
ALTER TABLE public.assigned_programs
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Backfill expires_at for existing programs with started_at and duration_weeks
UPDATE public.assigned_programs
SET expires_at = started_at + (duration_weeks * INTERVAL '7 days')
WHERE started_at IS NOT NULL
  AND duration_weeks IS NOT NULL
  AND expires_at IS NULL;

-- 4. Mark zombie programs as 'expired' — active but past their end date
UPDATE public.assigned_programs
SET status = 'expired', updated_at = now()
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < now();

-- 5. Update the program history RPC to include 'expired' in history
-- (migration 053 — get_student_detail_v2 filters by 'completed', 'paused')
-- We need expired programs to show in history too.
CREATE OR REPLACE FUNCTION get_student_detail_v2(p_student_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trainer_id UUID;
    v_student jsonb;
    v_active_program jsonb;
    v_program_history jsonb;
    v_recent_sessions jsonb;
    v_form_submissions jsonb;
    v_prescription_profile jsonb;
    v_expected_per_week INT;
BEGIN
    -- Caller must be the trainer
    SELECT id INTO v_trainer_id
    FROM trainers
    WHERE auth_user_id = auth.uid();

    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Student info
    SELECT row_to_json(sub)::jsonb INTO v_student
    FROM (
        SELECT s.id, s.name, s.email, s.phone, s.status, s.modality,
               s.avatar_url, s.is_trainer_profile, s.created_at
        FROM students s
        WHERE s.id = p_student_id AND s.coach_id = v_trainer_id
    ) sub;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- Active program with workouts
    SELECT row_to_json(sub)::jsonb INTO v_active_program
    FROM (
        SELECT ap.id, ap.name, ap.description, ap.duration_weeks,
               ap.started_at, ap.current_week, ap.ai_generated,
               COALESCE(
                   (SELECT jsonb_agg(row_to_json(w)::jsonb ORDER BY w.order_index)
                    FROM (
                        SELECT aw.id, aw.name, aw.order_index, aw.scheduled_days
                        FROM assigned_workouts aw
                        WHERE aw.assigned_program_id = ap.id
                    ) w),
                   '[]'::jsonb
               ) AS workouts
        FROM assigned_programs ap
        WHERE ap.student_id = p_student_id
          AND ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
        LIMIT 1
    ) sub;

    -- Expected sessions per week (count scheduled_days)
    IF v_active_program IS NOT NULL THEN
        SELECT COALESCE(SUM(jsonb_array_length(aw.scheduled_days::jsonb)), 0)::INT
        INTO v_expected_per_week
        FROM assigned_workouts aw
        WHERE aw.assigned_program_id = (v_active_program->>'id')::UUID;
    ELSE
        v_expected_per_week := 0;
    END IF;

    -- Program history (completed/paused/expired, last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_program_history
    FROM (
        SELECT ap.id, ap.name, ap.duration_weeks, ap.status,
               ap.started_at, ap.completed_at, ap.ai_generated
        FROM assigned_programs ap
        WHERE ap.student_id = p_student_id
          AND ap.trainer_id = v_trainer_id
          AND ap.status IN ('completed', 'paused', 'expired')
        ORDER BY ap.completed_at DESC NULLS LAST
        LIMIT 10
    ) sub;

    -- Recent sessions (last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC), '[]'::jsonb)
    INTO v_recent_sessions
    FROM (
        SELECT ws.id, aw.name AS workout_name,
               ws.completed_at, ws.duration_seconds, ws.rpe, ws.feedback
        FROM workout_sessions ws
        LEFT JOIN assigned_workouts aw ON aw.id = ws.assigned_workout_id
        WHERE ws.student_id = p_student_id
          AND ws.trainer_id = v_trainer_id
          AND ws.status = 'completed'
        ORDER BY ws.completed_at DESC
        LIMIT 10
    ) sub;

    -- Form submissions (last 20)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.submitted_at DESC), '[]'::jsonb)
    INTO v_form_submissions
    FROM (
        SELECT fs.id, ft.title AS template_title, ft.category,
               fs.status, fs.submitted_at, fs.feedback_sent_at
        FROM form_submissions fs
        JOIN form_templates ft ON ft.id = fs.form_template_id
        WHERE fs.student_id = p_student_id
          AND fs.trainer_id = v_trainer_id
          AND fs.status IN ('submitted', 'reviewed')
        ORDER BY fs.submitted_at DESC
        LIMIT 20
    ) sub;

    -- Prescription profile
    SELECT row_to_json(sub)::jsonb INTO v_prescription_profile
    FROM (
        SELECT pp.id, pp.training_level, pp.goal, pp.available_days,
               pp.injuries, pp.preferences, pp.available_equipment
        FROM prescription_profiles pp
        WHERE pp.student_id = p_student_id
          AND pp.trainer_id = v_trainer_id
        LIMIT 1
    ) sub;

    RETURN jsonb_build_object(
        'student', v_student,
        'activeProgram', v_active_program,
        'programHistory', v_program_history,
        'recentSessions', v_recent_sessions,
        'formSubmissions', v_form_submissions,
        'prescriptionProfile', v_prescription_profile,
        'expectedPerWeek', v_expected_per_week
    );
END;
$$;
