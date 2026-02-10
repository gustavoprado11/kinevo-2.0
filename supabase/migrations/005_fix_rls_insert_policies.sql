-- ============================================================================
-- Fix: RLS INSERT policy for program_templates and workout_templates
-- ============================================================================
-- Problem: FOR ALL policy with USING only doesn't work well for INSERT
-- because the trainer_id is NULL at policy check time (before trigger runs).
-- Solution: Add specific INSERT policy with WITH CHECK that validates after insert.
-- ============================================================================

-- Drop the existing ALL policy and recreate with separate policies
DROP POLICY IF EXISTS program_templates_trainer_all ON program_templates;

-- SELECT, UPDATE, DELETE use trainer_id check
CREATE POLICY program_templates_trainer_select ON program_templates
    FOR SELECT USING (trainer_id = current_trainer_id());

CREATE POLICY program_templates_trainer_update ON program_templates
    FOR UPDATE USING (trainer_id = current_trainer_id());

CREATE POLICY program_templates_trainer_delete ON program_templates
    FOR DELETE USING (trainer_id = current_trainer_id());

-- INSERT allows insertion if user is a trainer (trigger will set trainer_id)
CREATE POLICY program_templates_trainer_insert ON program_templates
    FOR INSERT 
    WITH CHECK (is_trainer());

-- Same fix for workout_templates
DROP POLICY IF EXISTS workout_templates_trainer_all ON workout_templates;

CREATE POLICY workout_templates_trainer_select ON workout_templates
    FOR SELECT USING (
        program_template_id IN (
            SELECT id FROM program_templates WHERE trainer_id = current_trainer_id()
        )
    );

CREATE POLICY workout_templates_trainer_update ON workout_templates
    FOR UPDATE USING (
        program_template_id IN (
            SELECT id FROM program_templates WHERE trainer_id = current_trainer_id()
        )
    );

CREATE POLICY workout_templates_trainer_delete ON workout_templates
    FOR DELETE USING (
        program_template_id IN (
            SELECT id FROM program_templates WHERE trainer_id = current_trainer_id()
        )
    );

-- INSERT: allow if the program belongs to this trainer
CREATE POLICY workout_templates_trainer_insert ON workout_templates
    FOR INSERT 
    WITH CHECK (
        program_template_id IN (
            SELECT id FROM program_templates WHERE trainer_id = current_trainer_id()
        )
    );

-- Same fix for workout_item_templates
DROP POLICY IF EXISTS workout_item_templates_trainer_all ON workout_item_templates;

CREATE POLICY workout_item_templates_trainer_select ON workout_item_templates
    FOR SELECT USING (
        workout_template_id IN (
            SELECT wt.id FROM workout_templates wt
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );

CREATE POLICY workout_item_templates_trainer_update ON workout_item_templates
    FOR UPDATE USING (
        workout_template_id IN (
            SELECT wt.id FROM workout_templates wt
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );

CREATE POLICY workout_item_templates_trainer_delete ON workout_item_templates
    FOR DELETE USING (
        workout_template_id IN (
            SELECT wt.id FROM workout_templates wt
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );

-- INSERT: allow if the workout belongs to a program owned by this trainer
CREATE POLICY workout_item_templates_trainer_insert ON workout_item_templates
    FOR INSERT 
    WITH CHECK (
        workout_template_id IN (
            SELECT wt.id FROM workout_templates wt
            JOIN program_templates pt ON wt.program_template_id = pt.id
            WHERE pt.trainer_id = current_trainer_id()
        )
    );
