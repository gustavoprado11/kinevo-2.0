-- 038: Add UNIQUE constraint for incremental set_log upsert
--
-- Enables idempotent upsert of set_logs as sets are completed in real-time
-- (from phone or Apple Watch), instead of batch insert at workout finish.
-- This prevents duplicates when Watch re-sends SET_COMPLETE or FINISH_WORKOUT.

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_session_item_set_unique
  UNIQUE (workout_session_id, assigned_workout_item_id, set_number);
