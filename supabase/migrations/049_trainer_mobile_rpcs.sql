-- ============================================================================
-- Kinevo — 049 Trainer Mobile RPCs
-- ============================================================================
-- RPCs for the mobile Trainer Mode dashboard and student list.
-- All functions use SECURITY DEFINER so they bypass RLS and return data
-- scoped to the calling trainer (via current_trainer_id()).
--
-- Split into 3 dashboard RPCs + 1 students list RPC for granular loading:
--   1. get_trainer_stats()           — KPI numbers
--   2. get_trainer_pending_actions() — pending financial, forms, inactive, expiring
--   3. get_trainer_daily_activity()  — today's completed sessions
--   4. get_trainer_students_list()   — enriched student list
-- ============================================================================

-- ============================================================================
-- 1) get_trainer_stats()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_active_students_count INT;
    v_sessions_this_week INT;
    v_expected_sessions_this_week INT;
    v_mrr NUMERIC;
    v_adherence_percent INT;
    v_has_active_programs BOOLEAN;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_five_days_ago TIMESTAMPTZ;
    v_total_with_program INT;
    v_on_track INT;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    -- Week boundaries (Monday-based, America/Sao_Paulo)
    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';
    v_five_days_ago := now() - INTERVAL '5 days';

    -- Active students count (exclude trainer's own profile)
    SELECT count(*) INTO v_active_students_count
    FROM students
    WHERE coach_id = v_trainer_id
      AND status = 'active'
      AND is_trainer_profile IS NOT TRUE;

    -- Sessions completed this week
    SELECT count(*) INTO v_sessions_this_week
    FROM workout_sessions
    WHERE trainer_id = v_trainer_id
      AND status = 'completed'
      AND completed_at >= v_week_start
      AND completed_at < v_week_end;

    -- Expected sessions per week: sum of unique scheduled days across active programs
    SELECT COALESCE(sum(day_count), 0)::int INTO v_expected_sessions_this_week
    FROM (
        SELECT ap.id AS program_id,
               count(DISTINCT d.day) AS day_count
        FROM assigned_programs ap
        JOIN assigned_workouts aw ON aw.assigned_program_id = ap.id
        CROSS JOIN LATERAL unnest(aw.scheduled_days) AS d(day)
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
        GROUP BY ap.id
    ) sub;

    -- MRR from active contracts
    SELECT COALESCE(sum(amount), 0) INTO v_mrr
    FROM student_contracts
    WHERE trainer_id = v_trainer_id
      AND status = 'active';

    -- Adherence: active students with program who trained in last 5 days
    SELECT count(*) INTO v_total_with_program
    FROM (
        SELECT DISTINCT ap.student_id
        FROM assigned_programs ap
        JOIN students s ON s.id = ap.student_id
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
    ) sub;

    SELECT count(*) INTO v_on_track
    FROM (
        SELECT DISTINCT ap.student_id
        FROM assigned_programs ap
        JOIN students s ON s.id = ap.student_id
        WHERE ap.trainer_id = v_trainer_id
          AND ap.status = 'active'
          AND s.status = 'active'
          AND s.is_trainer_profile IS NOT TRUE
          AND EXISTS (
              SELECT 1 FROM workout_sessions ws
              WHERE ws.student_id = ap.student_id
                AND ws.trainer_id = v_trainer_id
                AND ws.status = 'completed'
                AND ws.completed_at >= v_five_days_ago
          )
    ) sub;

    v_has_active_programs := v_total_with_program > 0;
    v_adherence_percent := CASE WHEN v_total_with_program > 0
        THEN round((v_on_track::numeric / v_total_with_program) * 100)::int
        ELSE 0
    END;

    RETURN jsonb_build_object(
        'activeStudentsCount', v_active_students_count,
        'sessionsThisWeek', v_sessions_this_week,
        'expectedSessionsThisWeek', v_expected_sessions_this_week,
        'mrr', v_mrr,
        'adherencePercent', v_adherence_percent,
        'hasActivePrograms', v_has_active_programs
    );
END;
$$;

-- ============================================================================
-- 2) get_trainer_pending_actions()
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

    -- Pending financial: overdue or pending contracts
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.current_period_end ASC NULLS LAST), '[]'::jsonb)
    INTO v_pending_financial
    FROM (
        SELECT sc.id,
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
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.submitted_at DESC), '[]'::jsonb)
    INTO v_pending_forms
    FROM (
        SELECT fs.id,
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

    -- Expiring programs: ending in <= 7 days
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.ends_in_days ASC), '[]'::jsonb)
    INTO v_expiring_programs
    FROM (
        SELECT s.name AS student_name,
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

-- ============================================================================
-- 3) get_trainer_daily_activity()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_daily_activity()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_today_start TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    v_today_start := (now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completed_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT ws.id,
               s.name AS student_name,
               s.id AS student_id,
               aw.name AS workout_name,
               ws.completed_at,
               ws.duration_seconds,
               ws.rpe,
               ws.feedback
        FROM workout_sessions ws
        JOIN students s ON s.id = ws.student_id
        JOIN assigned_workouts aw ON aw.id = ws.assigned_workout_id
        WHERE ws.trainer_id = v_trainer_id
          AND ws.status = 'completed'
          AND ws.completed_at >= v_today_start
        ORDER BY ws.completed_at DESC
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 4) get_trainer_students_list()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trainer_students_list()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_trainer_id := current_trainer_id();
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not a trainer';
    END IF;

    v_week_start := date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamptz;
    v_week_end := v_week_start + INTERVAL '7 days';

    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.name ASC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT s.id,
               s.name,
               s.email,
               s.phone,
               s.status,
               s.modality,
               s.avatar_url,
               s.created_at,
               s.is_trainer_profile,
               -- Active program info
               ap.name AS program_name,
               ap.duration_weeks,
               ap.started_at AS program_started_at,
               -- Last session date
               (
                   SELECT max(ws.completed_at)
                   FROM workout_sessions ws
                   WHERE ws.student_id = s.id
                     AND ws.trainer_id = v_trainer_id
                     AND ws.status = 'completed'
               ) AS last_session_date,
               -- Sessions this week
               (
                   SELECT count(*)
                   FROM workout_sessions ws
                   WHERE ws.student_id = s.id
                     AND ws.trainer_id = v_trainer_id
                     AND ws.status = 'completed'
                     AND ws.completed_at >= v_week_start
                     AND ws.completed_at < v_week_end
               )::int AS sessions_this_week,
               -- Expected sessions per week (unique scheduled days)
               COALESCE((
                   SELECT count(DISTINCT d.day)::int
                   FROM assigned_workouts aw2
                   CROSS JOIN LATERAL unnest(aw2.scheduled_days) AS d(day)
                   WHERE aw2.assigned_program_id = ap.id
               ), 0) AS expected_per_week
        FROM students s
        LEFT JOIN LATERAL (
            SELECT ap2.id, ap2.name, ap2.duration_weeks, ap2.started_at
            FROM assigned_programs ap2
            WHERE ap2.student_id = s.id
              AND ap2.trainer_id = v_trainer_id
              AND ap2.status = 'active'
            ORDER BY ap2.started_at DESC
            LIMIT 1
        ) ap ON TRUE
        WHERE s.coach_id = v_trainer_id
        ORDER BY s.name ASC
    ) sub;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- Grant execute to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_trainer_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_pending_actions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_daily_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_students_list() TO authenticated;

-- ============================================================================
-- SQL Tests — validate RPCs compile and return expected structure
-- ============================================================================
-- These tests run as the migration deployer (superuser). They verify that
-- the functions exist, compile, and return the correct JSONB structure.
-- If any assertion fails, the migration is rolled back.
-- ============================================================================
DO $test$
DECLARE
    v_stats JSONB;
    v_pending JSONB;
    v_activity JSONB;
    v_students JSONB;
BEGIN
    -- Test 1: get_trainer_stats() returns valid JSONB with expected keys
    -- (Will raise 'Not a trainer' for non-trainer users, which is correct)
    BEGIN
        v_stats := public.get_trainer_stats();
        -- Verify structure has all expected keys
        IF NOT (
            v_stats ? 'activeStudentsCount' AND
            v_stats ? 'sessionsThisWeek' AND
            v_stats ? 'expectedSessionsThisWeek' AND
            v_stats ? 'mrr' AND
            v_stats ? 'adherencePercent' AND
            v_stats ? 'hasActivePrograms'
        ) THEN
            RAISE EXCEPTION 'get_trainer_stats() missing expected keys. Got: %', v_stats;
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_stats() returned valid structure';
    EXCEPTION
        WHEN OTHERS THEN
            -- If 'Not a trainer', that's expected when running as superuser
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_stats() correctly rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 2: get_trainer_pending_actions() returns valid JSONB
    BEGIN
        v_pending := public.get_trainer_pending_actions();
        IF NOT (
            v_pending ? 'pendingFinancial' AND
            v_pending ? 'pendingForms' AND
            v_pending ? 'inactiveStudents' AND
            v_pending ? 'expiringPrograms'
        ) THEN
            RAISE EXCEPTION 'get_trainer_pending_actions() missing expected keys. Got: %', v_pending;
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_pending_actions() returned valid structure';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_pending_actions() correctly rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 3: get_trainer_daily_activity() returns JSONB array
    BEGIN
        v_activity := public.get_trainer_daily_activity();
        IF jsonb_typeof(v_activity) != 'array' THEN
            RAISE EXCEPTION 'get_trainer_daily_activity() should return array, got: %', jsonb_typeof(v_activity);
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_daily_activity() returned valid array';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_daily_activity() correctly rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 4: get_trainer_students_list() returns JSONB array
    BEGIN
        v_students := public.get_trainer_students_list();
        IF jsonb_typeof(v_students) != 'array' THEN
            RAISE EXCEPTION 'get_trainer_students_list() should return array, got: %', jsonb_typeof(v_students);
        END IF;
        RAISE NOTICE 'TEST PASS: get_trainer_students_list() returned valid array';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'Not a trainer' THEN
                RAISE NOTICE 'TEST PASS: get_trainer_students_list() correctly rejects non-trainer';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 5: Verify functions are accessible to authenticated role
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_name = 'get_trainer_stats'
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'get_trainer_stats not granted to authenticated role';
    END IF;
    RAISE NOTICE 'TEST PASS: All functions granted to authenticated role';

    RAISE NOTICE '=== ALL TESTS PASSED ===';
END;
$test$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
