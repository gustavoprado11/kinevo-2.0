-- Migration: Add frequency to workout_templates
-- Description: Adds a column to store the intended schedule (frequency) of a workout template.

ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS frequency text[];

COMMENT ON COLUMN workout_templates.frequency IS 'Array of days (mon, tue, wed, thu, fri, sat, sun) indicating the intended schedule.';
