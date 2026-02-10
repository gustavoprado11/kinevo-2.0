-- Migration: Add scheduling capabilities to assigned_programs
-- Description: Updates status check constraint and adds scheduled_start_date

-- 1. Update status check constraint to include 'scheduled'
ALTER TABLE assigned_programs 
DROP CONSTRAINT assigned_programs_status_check;

ALTER TABLE assigned_programs 
ADD CONSTRAINT assigned_programs_status_check 
CHECK (status IN ('active', 'scheduled', 'completed', 'paused'));

-- 2. Add scheduled_start_date column
ALTER TABLE assigned_programs 
ADD COLUMN scheduled_start_date DATE;

-- 3. Ensure only one active program per student
-- We can't use a simple UNIQUE index because status is not unique for 'completed'
-- But we can use a partial unique index for 'active' status
-- Note: There is already an index `idx_assigned_programs_active` but it's not UNIQUE.
-- Let's drop it and recreate as UNIQUE CONTRATINT or UNIQUE INDEX.

DROP INDEX IF EXISTS idx_assigned_programs_active;

CREATE UNIQUE INDEX idx_assigned_programs_active_unique 
ON assigned_programs (student_id) 
WHERE status = 'active';

-- 4. Add index for scheduled programs for faster lookups
CREATE INDEX idx_assigned_programs_scheduled 
ON assigned_programs (student_id, scheduled_start_date) 
WHERE status = 'scheduled';
