-- ============================================================================
-- Kinevo — 090 Async messaging between trainer and student
-- ============================================================================
-- Each student-trainer pair has an implicit conversation (via students.coach_id).
-- No separate conversations table needed — student_id identifies the thread.
-- ============================================================================

CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('trainer', 'student')),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT,
    image_url TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT message_has_content CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

-- Performance indexes
CREATE INDEX idx_messages_student_created ON messages(student_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(student_id, sender_type, read_at) WHERE read_at IS NULL;

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Trainer policies (via students.coach_id → trainers.auth_user_id)
CREATE POLICY "Trainers can view messages of their students" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN trainers t ON t.id = s.coach_id
            WHERE s.id = messages.student_id
              AND t.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Trainers can insert messages to their students" ON messages
    FOR INSERT WITH CHECK (
        sender_type = 'trainer'
        AND sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM students s
            JOIN trainers t ON t.id = s.coach_id
            WHERE s.id = messages.student_id
              AND t.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Trainers can mark messages as read" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM students s
            JOIN trainers t ON t.id = s.coach_id
            WHERE s.id = messages.student_id
              AND t.auth_user_id = auth.uid()
        )
    );

-- Student policies (via students.auth_user_id)
CREATE POLICY "Students can view their own messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = messages.student_id
              AND s.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Students can insert their own messages" ON messages
    FOR INSERT WITH CHECK (
        sender_type = 'student'
        AND sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = messages.student_id
              AND s.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Students can mark messages as read" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.id = messages.student_id
              AND s.auth_user_id = auth.uid()
        )
    );

-- Service role full access (for server actions, cron, etc.)
CREATE POLICY "Service role full access" ON messages
    FOR ALL USING (auth.role() = 'service_role');

-- Realtime (for live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Storage bucket for message images
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload message images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'messages' AND auth.role() = 'authenticated');

CREATE POLICY "Public read access for message images"
ON storage.objects FOR SELECT
USING (bucket_id = 'messages');
