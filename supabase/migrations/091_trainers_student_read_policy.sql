-- ============================================================================
-- Kinevo — 091 Allow students to read their trainer's basic info
-- ============================================================================
-- The trainers_select policy only allowed trainers to see their own record.
-- Students need to read their trainer's name and avatar for the chat header.
-- ============================================================================

CREATE POLICY "Students can view their trainer" ON trainers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students s
            WHERE s.coach_id = trainers.id
              AND s.auth_user_id = auth.uid()
        )
    );
