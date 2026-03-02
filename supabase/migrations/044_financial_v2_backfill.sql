-- ============================================================================
-- Kinevo — 044 Financial v2 Backfill
-- ============================================================================
-- Creates 'student_registered' events for all existing students.
-- Idempotent: skips students that already have the event.
-- Separated from 042/043 so it can be re-run independently if it times out.
-- ============================================================================

INSERT INTO contract_events (student_id, trainer_id, event_type, metadata, created_at)
SELECT s.id, s.coach_id, 'student_registered', '{}', s.created_at
FROM students s
WHERE COALESCE(s.is_trainer_profile, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM contract_events ce
    WHERE ce.student_id = s.id AND ce.event_type = 'student_registered'
  );
