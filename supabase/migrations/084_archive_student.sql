-- ============================================================================
-- Kinevo — 084 Archive Student
-- ============================================================================
-- Allows trainers to archive students by setting coach_id = NULL.
-- Student keeps app access (status stays 'active'), but disappears from
-- trainer views via RLS (coach_id = current_trainer_id()).
-- ============================================================================

BEGIN;

-- 1. Allow coach_id to be NULL (archived students have no trainer)
ALTER TABLE public.students ALTER COLUMN coach_id DROP NOT NULL;

-- 2. Create trainer_student_links table for relationship audit trail
CREATE TABLE IF NOT EXISTS public.trainer_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended')),
  is_current BOOLEAN NOT NULL DEFAULT true,
  end_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsl_student ON trainer_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_tsl_coach ON trainer_student_links(coach_id);
CREATE INDEX IF NOT EXISTS idx_tsl_current ON trainer_student_links(student_id, is_current)
  WHERE is_current = true;

-- RLS
ALTER TABLE public.trainer_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY tsl_trainer_select ON trainer_student_links
  FOR SELECT TO authenticated
  USING (coach_id = public.current_trainer_id());

CREATE POLICY tsl_service_all ON trainer_student_links
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Expand contract_events event_type CHECK to include 'student_archived'
ALTER TABLE public.contract_events DROP CONSTRAINT contract_events_event_type_check;

ALTER TABLE public.contract_events ADD CONSTRAINT contract_events_event_type_check
  CHECK (event_type IN (
    'student_registered',
    'contract_created',
    'contract_migrated',
    'payment_received',
    'payment_failed',
    'contract_canceled',
    'contract_overdue',
    'plan_changed',
    'access_blocked',
    'access_unblocked',
    'student_archived'
  ));

-- 4. Backfill: create active links for all current student-trainer pairs
INSERT INTO trainer_student_links (student_id, coach_id, status, is_current, started_at)
SELECT s.id, s.coach_id, 'active', true, s.created_at
FROM students s
WHERE s.coach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM trainer_student_links tsl
    WHERE tsl.student_id = s.id AND tsl.coach_id = s.coach_id
  );

COMMIT;
