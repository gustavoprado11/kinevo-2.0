-- ============================================================================
-- Kinevo — 047 Fix Inbox Data Leak (Critical Security Patch)
-- ============================================================================
-- Ensures RLS is enabled and student-scoped policies exist on all
-- inbox/form tables. This migration is idempotent — safe to re-run.
--
-- Problem: Students could see other students' inbox items and form
-- submissions if RLS policies were missing or not applied.
--
-- Fix: DROP + CREATE student-scoped SELECT policies to guarantee
-- they exist. Also re-enables RLS as a safety net.
-- ============================================================================

-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE student_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) student_inbox_items — student SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS student_inbox_items_student_select ON student_inbox_items;
CREATE POLICY student_inbox_items_student_select
    ON student_inbox_items FOR SELECT
    USING (student_id = current_student_id());

-- student UPDATE policy (status/read_at/completed_at only)
DROP POLICY IF EXISTS student_inbox_items_student_update_status ON student_inbox_items;
CREATE POLICY student_inbox_items_student_update_status
    ON student_inbox_items FOR UPDATE
    USING (student_id = current_student_id())
    WITH CHECK (student_id = current_student_id());

-- ============================================================================
-- 3) student_inbox_items — trainer policies (preserve trainer access)
-- ============================================================================
DROP POLICY IF EXISTS student_inbox_items_trainer_select ON student_inbox_items;
CREATE POLICY student_inbox_items_trainer_select
    ON student_inbox_items FOR SELECT
    USING (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS student_inbox_items_trainer_insert ON student_inbox_items;
CREATE POLICY student_inbox_items_trainer_insert
    ON student_inbox_items FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS student_inbox_items_trainer_update ON student_inbox_items;
CREATE POLICY student_inbox_items_trainer_update
    ON student_inbox_items FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS student_inbox_items_trainer_delete ON student_inbox_items;
CREATE POLICY student_inbox_items_trainer_delete
    ON student_inbox_items FOR DELETE
    USING (trainer_id = current_trainer_id());

-- ============================================================================
-- 4) form_submissions — student SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS form_submissions_student_select ON form_submissions;
CREATE POLICY form_submissions_student_select
    ON form_submissions FOR SELECT
    USING (student_id = current_student_id());

-- ============================================================================
-- 5) form_submissions — trainer SELECT policy (preserve trainer access)
-- ============================================================================
DROP POLICY IF EXISTS form_submissions_trainer_select ON form_submissions;
CREATE POLICY form_submissions_trainer_select
    ON form_submissions FOR SELECT
    USING (trainer_id = current_trainer_id());

-- ============================================================================
-- 6) form_templates — trainer policies (preserve trainer access)
-- ============================================================================
DROP POLICY IF EXISTS form_templates_trainer_select ON form_templates;
CREATE POLICY form_templates_trainer_select
    ON form_templates FOR SELECT
    USING (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS form_templates_trainer_insert ON form_templates;
CREATE POLICY form_templates_trainer_insert
    ON form_templates FOR INSERT
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS form_templates_trainer_update ON form_templates;
CREATE POLICY form_templates_trainer_update
    ON form_templates FOR UPDATE
    USING (trainer_id = current_trainer_id())
    WITH CHECK (trainer_id = current_trainer_id());

DROP POLICY IF EXISTS form_templates_trainer_delete ON form_templates;
CREATE POLICY form_templates_trainer_delete
    ON form_templates FOR DELETE
    USING (trainer_id = current_trainer_id());

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
