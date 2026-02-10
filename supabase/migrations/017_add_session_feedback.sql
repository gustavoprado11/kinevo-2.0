-- Migration file: 017_add_session_feedback.sql

ALTER TABLE workout_sessions
ADD COLUMN rpe SMALLINT CHECK (rpe >= 1 AND rpe <= 10),
ADD COLUMN feedback TEXT;
