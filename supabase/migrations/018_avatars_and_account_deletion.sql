-- ============================================================================
-- Kinevo 2.0 — Avatars Storage + Account Deletion
-- ============================================================================
-- Creates public storage bucket for user avatars with RLS policies,
-- and a SECURITY DEFINER function for soft-deleting student accounts.
-- ============================================================================

-- ============================================================================
-- 1. STORAGE BUCKET — avatars (public)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1.1 Policies — scoped to user's own folder: avatars/{auth_uid}/
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- 2. RPC — Soft delete student account
-- ============================================================================
-- Removes auth credentials and workout data, but preserves the student
-- record (status='inactive') so the trainer keeps historical reference.
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_student_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- Find student linked to current auth user
    SELECT id INTO v_student_id
    FROM students
    WHERE auth_user_id = v_auth_uid;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student not found for current user';
    END IF;

    -- Delete workout sessions (set_logs cascade via FK)
    DELETE FROM workout_sessions WHERE student_id = v_student_id;

    -- Delete assigned programs (assigned_workouts + items cascade via FK)
    DELETE FROM assigned_programs WHERE student_id = v_student_id;

    -- Soft-delete: deactivate student, unlink auth
    UPDATE students
    SET status = 'inactive',
        auth_user_id = NULL,
        updated_at = now()
    WHERE id = v_student_id;

    -- Delete avatar files from storage
    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = v_auth_uid::text;

    -- Hard-delete the auth user (removes login capability)
    DELETE FROM auth.users WHERE id = v_auth_uid;
END;
$$;
