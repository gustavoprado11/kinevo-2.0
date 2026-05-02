-- Index on students(coach_id) — required filter column for trainer-scoped queries.
--
-- The students table only had idx_students_trainer_id (legacy column from
-- migration 001). coach_id was introduced later (migration 084) without an
-- accompanying index, so queries filtering by coach_id were producing
-- sequential scans even when a small subset of rows matched. This was the
-- root cause of /students TTFB spiking to ~21s in production (Vercel Speed
-- Insights, P75 desktop).

CREATE INDEX IF NOT EXISTS idx_students_coach_id ON students(coach_id);
