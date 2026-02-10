-- ============================================================================
-- Fix: Auto-populate trainer_id on program_templates INSERT
-- ============================================================================
-- Problem: Frontend was not sending trainer_id, causing NOT NULL constraint violation
-- Solution: BEFORE INSERT trigger that auto-fills trainer_id from current_trainer_id()
-- ============================================================================

-- Trigger function to set trainer_id automatically
CREATE OR REPLACE FUNCTION public.set_trainer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
BEGIN
    -- Get trainer_id from auth.uid()
    v_trainer_id := current_trainer_id();
    
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated as a trainer';
    END IF;
    
    -- Set trainer_id if not provided
    IF NEW.trainer_id IS NULL THEN
        NEW.trainer_id := v_trainer_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for program_templates
DROP TRIGGER IF EXISTS set_trainer_id_on_program_templates ON program_templates;
CREATE TRIGGER set_trainer_id_on_program_templates
    BEFORE INSERT ON program_templates
    FOR EACH ROW
    EXECUTE FUNCTION set_trainer_id();

-- Also apply to workout_templates (for future direct inserts)
DROP TRIGGER IF EXISTS set_trainer_id_on_workout_templates ON workout_templates;
CREATE TRIGGER set_trainer_id_on_workout_templates
    BEFORE INSERT ON workout_templates
    FOR EACH ROW
    EXECUTE FUNCTION set_trainer_id();
