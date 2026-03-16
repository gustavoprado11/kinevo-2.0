-- ============================================================================
-- Kinevo — 053 Mobile Trainer Phase 3 RPCs
-- ============================================================================
-- RPCs for Forms management, Student profile detail, Program templates,
-- and Prescription profile upsert. Used by the mobile Trainer Mode
-- Phase 3 (Gestao Remota).
--
-- Functions:
--   1. get_trainer_form_templates()        — List form templates
--   2. get_trainer_form_submissions()      — List submissions with student info
--   3. get_form_submission_detail()        — Full submission with answers + schema
--   4. get_student_profile_detail()        — Rich student profile
--   5. get_trainer_program_templates()     — Program templates for assignment
--   6. upsert_prescription_profile()      — Create/update prescription profile
-- ============================================================================

-- ============================================================================
-- 1) get_trainer_form_templates()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_form_templates()
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

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT ft.id,
               ft.title,
               ft.description,
               ft.category,
               ft.version,
               ft.is_active,
               ft.created_at,
               -- Count questions in schema_json
               COALESCE(jsonb_array_length(ft.schema_json -> 'questions'), 0) AS question_count,
               -- Count submissions
               (
                   SELECT count(*)
                   FROM form_submissions fs
                   WHERE fs.form_template_id = ft.id
                     AND fs.status IN ('submitted', 'reviewed')
               )::int AS response_count
        FROM form_templates ft
        WHERE ft.trainer_id = v_trainer_id
          AND ft.is_active = true
        ORDER BY ft.created_at DESC
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 2) get_trainer_form_submissions()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_form_submissions()
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

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.submitted_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT fs.id,
               fs.student_id,
               s.name AS student_name,
               s.avatar_url AS student_avatar,
               fs.form_template_id AS template_id,
               ft.title AS template_title,
               ft.category AS template_category,
               fs.status,
               fs.submitted_at,
               fs.feedback_sent_at,
               fs.created_at
        FROM form_submissions fs
        JOIN students s ON s.id = fs.student_id
        JOIN form_templates ft ON ft.id = fs.form_template_id
        WHERE fs.trainer_id = v_trainer_id
          AND fs.status IN ('submitted', 'reviewed')
        ORDER BY fs.submitted_at DESC NULLS LAST
        LIMIT 200
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 3) get_form_submission_detail(p_submission_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_form_submission_detail(p_submission_id UUID)
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

    SELECT jsonb_build_object(
        'id', fs.id,
        'student_id', fs.student_id,
        'student_name', s.name,
        'student_avatar', s.avatar_url,
        'template_id', fs.form_template_id,
        'template_title', ft.title,
        'template_category', ft.category,
        'status', fs.status,
        'submitted_at', fs.submitted_at,
        'feedback_sent_at', fs.feedback_sent_at,
        'trainer_feedback', fs.trainer_feedback,
        'answers_json', fs.answers_json,
        'schema_snapshot_json', fs.schema_snapshot_json,
        'created_at', fs.created_at
    )
    INTO v_result
    FROM form_submissions fs
    JOIN students s ON s.id = fs.student_id
    JOIN form_templates ft ON ft.id = fs.form_template_id
    WHERE fs.id = p_submission_id
      AND fs.trainer_id = v_trainer_id;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Submission not found for current trainer';
    END IF;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 4) get_student_profile_detail(p_student_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_profile_detail(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_student JSONB;
    v_active_program JSONB;
    v_program_history JSONB;
    v_recent_sessions JSONB;
    v_form_submissions JSONB;
    v_prescription_profile JSONB;
    v_ai_enabled BOOLEAN;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_sessions_this_week INT;
    v_expected_per_week INT;
    v_total_sessions INT;
    v_last_session_date TIMESTAMPTZ;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Verify ownership
    SELECT jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'email', s.email,
        'phone', s.phone,
        'status', s.status,
        'modality', s.modality,
        'avatar_url', s.avatar_url,
        'is_trainer_profile', s.is_trainer_profile,
        'created_at', s.created_at
    )
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id
      AND s.coach_id = v_trainer_id;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student not found for current trainer';
    END IF;

    -- Week boundaries
    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';

    -- Sessions this week
    SELECT count(*) INTO v_sessions_this_week
    FROM workout_sessions ws
    WHERE ws.student_id = p_student_id
      AND ws.trainer_id = v_trainer_id
      AND ws.status = 'completed'
      AND ws.completed_at >= v_week_start
      AND ws.completed_at < v_week_end;

    -- Total sessions
    SELECT count(*), max(ws.completed_at)
    INTO v_total_sessions, v_last_session_date
    FROM workout_sessions ws
    WHERE ws.student_id = p_student_id
      AND ws.trainer_id = v_trainer_id
      AND ws.status = 'completed';

    -- Active program with workouts
    SELECT jsonb_build_object(
        'id', ap.id,
        'name', ap.name,
        'description', ap.description,
        'duration_weeks', ap.duration_weeks,
        'started_at', ap.started_at,
        'current_week', ap.current_week,
        'ai_generated', ap.ai_generated,
        'workouts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', aw.id,
                'name', aw.name,
                'order_index', aw.order_index,
                'scheduled_days', COALESCE(to_jsonb(aw.scheduled_days), '[]'::jsonb)
            ) ORDER BY aw.order_index)
            FROM assigned_workouts aw
            WHERE aw.assigned_program_id = ap.id
        ), '[]'::jsonb)
    )
    INTO v_active_program
    FROM assigned_programs ap
    WHERE ap.student_id = p_student_id
      AND ap.trainer_id = v_trainer_id
      AND ap.status = 'active'
    ORDER BY ap.started_at DESC
    LIMIT 1;

    -- Expected per week from active program
    IF v_active_program IS NOT NULL THEN
        SELECT COALESCE(count(DISTINCT d.day), 0)::int
        INTO v_expected_per_week
        FROM assigned_workouts aw
        CROSS JOIN LATERAL unnest(aw.scheduled_days) AS d(day)
        WHERE aw.assigned_program_id = (v_active_program ->> 'id')::uuid;
    ELSE
        v_expected_per_week := 0;
    END IF;

    -- Program history (completed/paused, last 10)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_program_history
    FROM (
        SELECT ap.id, ap.name, ap.duration_weeks, ap.status,
               ap.started_at, ap.completed_at, ap.ai_generated
        FROM assigned_programs ap
        WHERE ap.student_id = p_student_id
          AND ap.trainer_id = v_trainer_id
          AND ap.status IN ('completed', 'paused')
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

    -- Form submissions (last 10)
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
        LIMIT 10
    ) sub;

    -- Prescription profile
    SELECT jsonb_build_object(
        'id', spp.id,
        'training_level', spp.training_level,
        'goal', spp.goal,
        'available_days', spp.available_days,
        'session_duration_minutes', spp.session_duration_minutes,
        'available_equipment', spp.available_equipment,
        'medical_restrictions', spp.medical_restrictions,
        'ai_mode', spp.ai_mode,
        'updated_at', spp.updated_at
    )
    INTO v_prescription_profile
    FROM student_prescription_profiles spp
    WHERE spp.student_id = p_student_id
      AND spp.trainer_id = v_trainer_id;

    -- AI enabled flag
    SELECT t.ai_prescriptions_enabled INTO v_ai_enabled
    FROM trainers t WHERE t.id = v_trainer_id;

    RETURN jsonb_build_object(
        'student', v_student,
        'activeProgram', v_active_program,
        'programHistory', v_program_history,
        'recentSessions', v_recent_sessions,
        'formSubmissions', v_form_submissions,
        'prescriptionProfile', v_prescription_profile,
        'aiEnabled', COALESCE(v_ai_enabled, false),
        'sessionsThisWeek', v_sessions_this_week,
        'expectedPerWeek', v_expected_per_week,
        'totalSessions', v_total_sessions,
        'lastSessionDate', v_last_session_date
    );
END;
$$;

-- ============================================================================
-- 5) get_trainer_program_templates()
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
        ORDER BY pt.name ASC
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 6) upsert_prescription_profile()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_prescription_profile(
    p_student_id UUID,
    p_training_level TEXT DEFAULT 'beginner',
    p_goal TEXT DEFAULT 'hypertrophy',
    p_available_days INTEGER[] DEFAULT '{}',
    p_session_duration_minutes INTEGER DEFAULT 60,
    p_available_equipment TEXT[] DEFAULT '{}',
    p_medical_restrictions JSONB DEFAULT '[]',
    p_ai_mode TEXT DEFAULT 'copilot'
)
RETURNS JSONB
LANGUAGE plpgsql
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

    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = p_student_id AND s.coach_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student not found for current trainer';
    END IF;

    INSERT INTO student_prescription_profiles (
        student_id, trainer_id, training_level, goal,
        available_days, session_duration_minutes, available_equipment,
        medical_restrictions, ai_mode
    ) VALUES (
        p_student_id, v_trainer_id, p_training_level, p_goal,
        p_available_days, p_session_duration_minutes, p_available_equipment,
        p_medical_restrictions, p_ai_mode
    )
    ON CONFLICT (student_id) DO UPDATE SET
        training_level = EXCLUDED.training_level,
        goal = EXCLUDED.goal,
        available_days = EXCLUDED.available_days,
        session_duration_minutes = EXCLUDED.session_duration_minutes,
        available_equipment = EXCLUDED.available_equipment,
        medical_restrictions = EXCLUDED.medical_restrictions,
        ai_mode = EXCLUDED.ai_mode,
        updated_at = now()
    RETURNING jsonb_build_object(
        'id', id,
        'student_id', student_id,
        'training_level', training_level,
        'goal', goal,
        'available_days', available_days,
        'session_duration_minutes', session_duration_minutes,
        'available_equipment', available_equipment,
        'medical_restrictions', medical_restrictions,
        'ai_mode', ai_mode,
        'updated_at', updated_at
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_trainer_form_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_form_submissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_form_submission_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_profile_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_program_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_prescription_profile(UUID, TEXT, TEXT, INTEGER[], INTEGER, TEXT[], JSONB, TEXT) TO authenticated;

-- ============================================================================
-- Realtime for form_submissions (for badge updates)
-- ============================================================================
ALTER TABLE form_submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'form_submissions'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.form_submissions;
        END IF;
    END IF;
END
$$;

-- ============================================================================
-- SQL Tests
-- ============================================================================
DO $test$
DECLARE
    v_templates JSONB;
    v_submissions JSONB;
    v_programs JSONB;
BEGIN
    -- Test 1: get_trainer_form_templates() compiles and returns array
    BEGIN
        v_templates := public.get_trainer_form_templates();
        IF jsonb_typeof(v_templates) != 'array' THEN
            RAISE EXCEPTION 'get_trainer_form_templates() should return array, got: %', jsonb_typeof(v_templates);
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_form_templates()';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_form_templates() rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 2: get_trainer_form_submissions() compiles and returns array
    BEGIN
        v_submissions := public.get_trainer_form_submissions();
        IF jsonb_typeof(v_submissions) != 'array' THEN
            RAISE EXCEPTION 'get_trainer_form_submissions() should return array, got: %', jsonb_typeof(v_submissions);
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_form_submissions()';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_form_submissions() rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 3: get_trainer_program_templates() compiles and returns array
    BEGIN
        v_programs := public.get_trainer_program_templates();
        IF jsonb_typeof(v_programs) != 'array' THEN
            RAISE EXCEPTION 'get_trainer_program_templates() should return array, got: %', jsonb_typeof(v_programs);
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_program_templates()';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_program_templates() rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 4: Verify all functions are granted to authenticated
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_trainer_form_templates'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_trainer_form_templates not granted to authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_trainer_form_submissions'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_trainer_form_submissions not granted to authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_form_submission_detail'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_form_submission_detail not granted to authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_student_profile_detail'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_student_profile_detail not granted to authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_trainer_program_templates'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_trainer_program_templates not granted to authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'upsert_prescription_profile'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'upsert_prescription_profile not granted to authenticated';
    END IF;

    RAISE NOTICE 'TEST PASS: All functions granted to authenticated role';
    RAISE NOTICE '=== ALL TESTS PASSED ===';
END;
$test$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
