-- ============================================================================
-- Migration 135: Exercise Library Videos Bucket
-- ============================================================================
-- Creates a dedicated public-read bucket for the official Kinevo exercise
-- demonstration library (videos curated by Lucas Damiani). This bucket is
-- separate from `trainer-videos` to keep policies simple:
--   - `trainer-videos`: per-trainer uploads, path-scoped policies
--   - `exercise-library-videos`: official library, public read, service-role
--     write only
--
-- Also adds `exercises.video_source_drive_id` so the import pipeline is
-- idempotent — re-runs UPDATE existing rows instead of creating duplicates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Storage bucket
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-library-videos',
  'exercise-library-videos',
  true,                                     -- public read via /storage/v1/object/public
  104857600,                                -- 100 MB hard cap per object
  ARRAY['video/mp4', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Storage policies
-- ----------------------------------------------------------------------------
-- Public read is implicit via `public=true` and the /storage/v1/object/public
-- route, which does not consult SELECT policies. We only need to prevent
-- non-service clients from writing or listing.

DROP POLICY IF EXISTS "exercise_library_service_write" ON storage.objects;
DROP POLICY IF EXISTS "exercise_library_service_update" ON storage.objects;
DROP POLICY IF EXISTS "exercise_library_service_delete" ON storage.objects;

CREATE POLICY "exercise_library_service_write"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'exercise-library-videos');

CREATE POLICY "exercise_library_service_update"
  ON storage.objects FOR UPDATE TO service_role
  USING (bucket_id = 'exercise-library-videos')
  WITH CHECK (bucket_id = 'exercise-library-videos');

CREATE POLICY "exercise_library_service_delete"
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'exercise-library-videos');

-- Authenticated/anon clients CAN listobjects in this bucket (LIST is useful for
-- admin panels in the future). Reads are anyway public so listing names is
-- not sensitive.
DROP POLICY IF EXISTS "exercise_library_authenticated_list" ON storage.objects;
CREATE POLICY "exercise_library_authenticated_list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exercise-library-videos');

-- ----------------------------------------------------------------------------
-- 3. exercises table: idempotency key for Drive-sourced videos
-- ----------------------------------------------------------------------------

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS video_source_drive_id TEXT;

-- Partial unique index — only enforce uniqueness on non-null Drive IDs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_video_source_drive_id
  ON public.exercises (video_source_drive_id)
  WHERE video_source_drive_id IS NOT NULL;

COMMENT ON COLUMN public.exercises.video_source_drive_id IS
  'Google Drive file ID for videos sourced from the Lucas Damiani library. Used by the import pipeline for idempotent upserts.';

-- ----------------------------------------------------------------------------
-- 4. Optional: archived flag default for newly imported exercises
-- ----------------------------------------------------------------------------
-- No schema change needed — the import script writes is_archived=true
-- explicitly for new system exercises so they require manual review before
-- publication.
