-- ============================================================================
-- Kinevo — Ensure avatars bucket and policies (idempotent)
-- ============================================================================

-- Ensure public avatars bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Anyone can view avatars'
    ) THEN
        CREATE POLICY "Anyone can view avatars"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'avatars');
    END IF;
END
$$;

-- Authenticated users can upload inside their own folder avatars/{auth_uid}/
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can upload own avatar'
    ) THEN
        CREATE POLICY "Users can upload own avatar"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;

-- Authenticated users can update inside their own folder avatars/{auth_uid}/
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can update own avatar'
    ) THEN
        CREATE POLICY "Users can update own avatar"
        ON storage.objects FOR UPDATE TO authenticated
        USING (
            bucket_id = 'avatars'
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;
