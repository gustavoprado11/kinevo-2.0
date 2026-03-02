-- ============================================================================
-- Kinevo — 042 Financial v2 Schema
-- ============================================================================
-- Adds canceled_by/canceled_at to student_contracts and creates the
-- contract_events audit trail table with indexes and RLS.
-- Part of the financial module v2 redesign (student-centered model).
-- ============================================================================

-- ============================================================================
-- 1. NEW COLUMNS ON student_contracts
-- ============================================================================

ALTER TABLE public.student_contracts
  ADD COLUMN IF NOT EXISTS canceled_by TEXT
    CHECK (canceled_by IN ('trainer', 'student', 'system')),
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- ============================================================================
-- 2. TABLE: contract_events (audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.student_contracts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
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
      'access_unblocked'
    )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contract_events_student
  ON contract_events(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_events_trainer
  ON contract_events(trainer_id, event_type, created_at DESC);

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_events_trainer_select ON public.contract_events
  FOR SELECT TO authenticated
  USING (trainer_id = public.current_trainer_id());

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT SELECT ON public.contract_events TO authenticated;
GRANT ALL ON public.contract_events TO service_role;
