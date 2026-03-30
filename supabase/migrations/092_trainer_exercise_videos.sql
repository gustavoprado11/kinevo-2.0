-- Migration 092: Trainer custom exercise videos
-- Allows trainers to attach their own videos to any exercise (upload or external URL)

-- 1. Create table
CREATE TABLE trainer_exercise_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    video_type TEXT NOT NULL CHECK (video_type IN ('upload', 'external_url')),
    video_url TEXT NOT NULL,
    storage_path TEXT,            -- filled only when video_type = 'upload'
    original_filename TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(trainer_id, exercise_id)
);

CREATE INDEX idx_trainer_exercise_videos_trainer ON trainer_exercise_videos(trainer_id);
CREATE INDEX idx_trainer_exercise_videos_exercise ON trainer_exercise_videos(exercise_id);

-- Reuse existing update_updated_at() function from migration 001
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON trainer_exercise_videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Enable RLS
ALTER TABLE trainer_exercise_videos ENABLE ROW LEVEL SECURITY;

-- Trainer: full CRUD on own records
CREATE POLICY trainer_exercise_videos_trainer_all
    ON trainer_exercise_videos
    FOR ALL
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

-- Student: read-only access to their trainer's videos
CREATE POLICY trainer_exercise_videos_student_select
    ON trainer_exercise_videos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.coach_id = trainer_exercise_videos.trainer_id
            AND s.auth_user_id = auth.uid()
        )
    );

-- 3. Storage bucket for trainer videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-videos', 'trainer-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: trainer can upload to their own folder
CREATE POLICY "Trainers can upload own videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'trainer-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Trainers can update own videos"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'trainer-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Trainers can delete own videos"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'trainer-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access for all authenticated users
CREATE POLICY "Anyone can view trainer videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'trainer-videos');
