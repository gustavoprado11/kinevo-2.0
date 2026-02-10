-- Fix: Add INSERT policy for trainers table
-- This allows authenticated users to create their own trainer record

CREATE POLICY trainers_insert ON trainers
    FOR INSERT 
    WITH CHECK (auth_user_id = auth.uid());

-- Also add INSERT policy for students (trainer can create students)
-- The existing policy uses "FOR ALL" but let's be explicit
