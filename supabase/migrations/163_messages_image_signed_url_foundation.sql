-- Security fix (A2) — FOUNDATION ONLY (non-breaking; bucket stays public).
--
-- Chat images live in a PUBLIC storage bucket and messages.image_url stores the
-- full public URL, so anyone with the URL reads private trainer<->student photos
-- (often body/progress photos = PII). The real fix is a private bucket + signed
-- URLs, but flipping the bucket breaks (a) all historical public URLs and (b)
-- mobile clients already installed that read image_url directly. So we stage it:
--
--   1) [this migration] fix the dead SELECT storage policy + add an image_path
--      column and backfill it. Fully additive — nothing breaks today.
--   2) [app code] dual-write image_path on upload; new clients can read via
--      signed URL generated from image_path.
--   3) [later, after a forced mobile update] flip bucket to private and switch
--      all readers to signed URLs. See docs/security/A2-chat-images-runbook.md.

-- ---------------------------------------------------------------------------
-- 1. Fix the dead SELECT policy on storage.objects for the messages bucket.
--    The old policy compared the first path segment to auth.uid(), but the path
--    is {student_id}/..., so it matched nobody. Mirror the (correct) INSERT
--    policy: allow the student who owns the folder OR their coach. This has no
--    effect while the bucket is public, but makes the future flip a one-step,
--    already-correct change.
-- ---------------------------------------------------------------------------
ALTER POLICY messages_owner_select ON storage.objects
  USING (
    bucket_id = 'messages'
    AND (storage.foldername(name))[1] IN (
      SELECT (s.id)::text
      FROM students s
      LEFT JOIN trainers t ON t.id = s.coach_id
      WHERE s.auth_user_id = auth.uid() OR t.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Add image_path (storage object path) alongside image_url, and backfill
--    it from the existing public URLs so old photos can later be served via
--    signed URLs too.
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN public.messages.image_path IS
    'Storage object path ({student_id}/file) within the messages bucket. '
    'Source of truth for serving images via signed URLs. image_url (public URL) '
    'is kept for backward compatibility with installed mobile clients.';

UPDATE public.messages
SET image_path = regexp_replace(image_url, '^.*/storage/v1/object/public/messages/', '')
WHERE image_url IS NOT NULL
  AND image_path IS NULL
  AND image_url LIKE '%/storage/v1/object/public/messages/%';
