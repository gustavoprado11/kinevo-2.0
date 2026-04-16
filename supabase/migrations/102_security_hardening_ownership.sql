-- ============================================================================
-- Migration 102: Ownership hardening for student_contracts, assigned_workouts,
-- and program_form_triggers
-- ----------------------------------------------------------------------------
-- Fixes 3 HIGH findings from the 2026-04-16 security audit. Previous policies
-- enforced `trainer_id = current_trainer_id()` but did not validate that the
-- foreign-keyed records (student, workout_template, program_template,
-- form_template) also belong to the acting trainer. Effect: a trainer could
-- create or edit rows that reference another trainer's records.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- A. student_contracts — INSERT/UPDATE must reference the trainer's own student
--
-- Before: INSERT only checked trainer_id; a trainer could create a contract
-- for another trainer's student. UPDATE had no WITH CHECK so trainer_id
-- could be mutated to transfer contracts.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS student_contracts_trainer_insert ON public.student_contracts;

CREATE POLICY student_contracts_trainer_insert ON public.student_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    trainer_id = public.current_trainer_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.coach_id = public.current_trainer_id()
    )
  );

DROP POLICY IF EXISTS student_contracts_trainer_update ON public.student_contracts;

CREATE POLICY student_contracts_trainer_update ON public.student_contracts
  FOR UPDATE
  TO authenticated
  USING (trainer_id = public.current_trainer_id())
  WITH CHECK (
    trainer_id = public.current_trainer_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.coach_id = public.current_trainer_id()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- B. assigned_workouts — source_template_id must belong to the trainer
--
-- Before: USING checked the parent assigned_program's trainer but WITH CHECK
-- was implicit (mirroring USING). source_template_id from another trainer's
-- workout_templates was accepted. Audit note: source_template_id points to
-- workout_templates which chain ownership via program_templates.trainer_id.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS assigned_workouts_trainer_all ON public.assigned_workouts;

CREATE POLICY assigned_workouts_trainer_all ON public.assigned_workouts
  FOR ALL
  TO authenticated
  USING (
    assigned_program_id IN (
      SELECT id FROM public.assigned_programs
      WHERE trainer_id = public.current_trainer_id()
    )
  )
  WITH CHECK (
    assigned_program_id IN (
      SELECT id FROM public.assigned_programs
      WHERE trainer_id = public.current_trainer_id()
    )
    AND (
      source_template_id IS NULL
      OR source_template_id IN (
        SELECT wt.id
        FROM public.workout_templates wt
        JOIN public.program_templates pt ON pt.id = wt.program_template_id
        WHERE pt.trainer_id = public.current_trainer_id()
      )
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- C. program_form_triggers — validate both template ownerships
--
-- Before: INSERT/UPDATE only checked trainer_id = current_trainer_id(). The
-- referenced program_template_id and form_template_id could point to records
-- owned by other trainers. form_templates with a NULL trainer_id represent
-- system-provided templates and are allowed; anything else must belong to
-- the acting trainer.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS program_form_triggers_trainer_insert ON public.program_form_triggers;

CREATE POLICY program_form_triggers_trainer_insert ON public.program_form_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    trainer_id = public.current_trainer_id()
    AND EXISTS (
      SELECT 1 FROM public.program_templates pt
      WHERE pt.id = program_template_id
        AND pt.trainer_id = public.current_trainer_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.form_templates ft
      WHERE ft.id = form_template_id
        AND (ft.trainer_id = public.current_trainer_id() OR ft.trainer_id IS NULL)
    )
  );

DROP POLICY IF EXISTS program_form_triggers_trainer_update ON public.program_form_triggers;

CREATE POLICY program_form_triggers_trainer_update ON public.program_form_triggers
  FOR UPDATE
  TO authenticated
  USING (trainer_id = public.current_trainer_id())
  WITH CHECK (
    trainer_id = public.current_trainer_id()
    AND EXISTS (
      SELECT 1 FROM public.program_templates pt
      WHERE pt.id = program_template_id
        AND pt.trainer_id = public.current_trainer_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.form_templates ft
      WHERE ft.id = form_template_id
        AND (ft.trainer_id = public.current_trainer_id() OR ft.trainer_id IS NULL)
    )
  );
