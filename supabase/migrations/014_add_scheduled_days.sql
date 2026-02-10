-- Add scheduled_days column to assigned_workouts
-- This allows trainers to specify which days of the week a workout should be performed.
-- Format: integer array where 0 = Sunday, 1 = Monday, ..., 6 = Saturday.

ALTER TABLE assigned_workouts 
ADD COLUMN IF NOT EXISTS scheduled_days integer[] DEFAULT '{}';

COMMENT ON COLUMN assigned_workouts.scheduled_days IS 'Days of the week this workout is scheduled for (0=Sun, 6=Sat). Empty means flexible schedule.';
