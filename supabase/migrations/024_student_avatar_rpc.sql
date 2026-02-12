-- ============================================================================
-- Kinevo — Student Avatar Update RPC
-- ============================================================================
-- Adds a SECURITY DEFINER function so students can update their own avatar_url
-- without needing a broad UPDATE RLS policy on the students table.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_student_avatar(p_avatar_url TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE students
    SET avatar_url = p_avatar_url,
        updated_at = now()
    WHERE auth_user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_student_avatar(TEXT) TO authenticated;
