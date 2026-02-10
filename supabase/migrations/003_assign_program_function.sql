-- ============================================================================
-- RPC Function: assign_program_to_student
-- ============================================================================
-- This function performs a transactional copy of a program template to a student.
-- It copies:
-- 1. program_template → assigned_program
-- 2. workout_templates → assigned_workouts
-- 3. workout_item_templates → assigned_workout_items (with exercise snapshots)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_program_to_student(
    p_template_id UUID,
    p_student_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID;
    v_assigned_program_id UUID;
    v_template RECORD;
    v_workout RECORD;
    v_assigned_workout_id UUID;
    v_item RECORD;
    v_assigned_item_id UUID;
    v_parent_mapping JSONB := '{}';
    v_exercise RECORD;
BEGIN
    -- Get the trainer ID from the current user
    v_trainer_id := current_trainer_id();
    
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated as a trainer';
    END IF;
    
    -- Verify the student belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM students 
        WHERE id = p_student_id AND trainer_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Student not found or does not belong to this trainer';
    END IF;
    
    -- Verify the template belongs to this trainer
    IF NOT EXISTS (
        SELECT 1 FROM program_templates 
        WHERE id = p_template_id AND trainer_id = v_trainer_id
    ) THEN
        RAISE EXCEPTION 'Program template not found or does not belong to this trainer';
    END IF;
    
    -- Get template data
    SELECT * INTO v_template FROM program_templates WHERE id = p_template_id;
    
    -- Deactivate any existing active programs for this student
    UPDATE assigned_programs 
    SET status = 'paused', updated_at = now()
    WHERE student_id = p_student_id AND status = 'active';
    
    -- Create assigned program
    INSERT INTO assigned_programs (
        student_id,
        trainer_id,
        source_template_id,
        name,
        description,
        duration_weeks,
        status,
        started_at,
        current_week
    ) VALUES (
        p_student_id,
        v_trainer_id,
        p_template_id,
        v_template.name,
        v_template.description,
        v_template.duration_weeks,
        'active',
        now(),
        1
    ) RETURNING id INTO v_assigned_program_id;
    
    -- Copy workouts
    FOR v_workout IN 
        SELECT * FROM workout_templates 
        WHERE program_template_id = p_template_id
        ORDER BY order_index
    LOOP
        INSERT INTO assigned_workouts (
            assigned_program_id,
            source_template_id,
            name,
            order_index
        ) VALUES (
            v_assigned_program_id,
            v_workout.id,
            v_workout.name,
            v_workout.order_index
        ) RETURNING id INTO v_assigned_workout_id;
        
        -- Copy workout items (first pass: items without parent)
        FOR v_item IN 
            SELECT wit.*, 
                   e.name as ex_name,
                   e.muscle_group as ex_muscle_group,
                   e.equipment as ex_equipment
            FROM workout_item_templates wit
            LEFT JOIN exercises e ON wit.exercise_id = e.id
            WHERE wit.workout_template_id = v_workout.id
              AND wit.parent_item_id IS NULL
            ORDER BY wit.order_index
        LOOP
            INSERT INTO assigned_workout_items (
                assigned_workout_id,
                parent_item_id,
                source_template_id,
                item_type,
                order_index,
                exercise_id,
                exercise_name,
                exercise_muscle_group,
                exercise_equipment,
                sets,
                reps,
                rest_seconds,
                notes
            ) VALUES (
                v_assigned_workout_id,
                NULL,
                v_item.id,
                v_item.item_type,
                v_item.order_index,
                v_item.exercise_id,
                v_item.ex_name,
                v_item.ex_muscle_group,
                v_item.ex_equipment,
                v_item.sets,
                v_item.reps,
                v_item.rest_seconds,
                v_item.notes
            ) RETURNING id INTO v_assigned_item_id;
            
            -- Store mapping for parent references
            v_parent_mapping := v_parent_mapping || jsonb_build_object(v_item.id::text, v_assigned_item_id::text);
            
            -- Copy child items (for supersets)
            FOR v_item IN 
                SELECT wit.*, 
                       e.name as ex_name,
                       e.muscle_group as ex_muscle_group,
                       e.equipment as ex_equipment
                FROM workout_item_templates wit
                LEFT JOIN exercises e ON wit.exercise_id = e.id
                WHERE wit.workout_template_id = v_workout.id
                  AND wit.parent_item_id = v_item.id
                ORDER BY wit.order_index
            LOOP
                INSERT INTO assigned_workout_items (
                    assigned_workout_id,
                    parent_item_id,
                    source_template_id,
                    item_type,
                    order_index,
                    exercise_id,
                    exercise_name,
                    exercise_muscle_group,
                    exercise_equipment,
                    sets,
                    reps,
                    rest_seconds,
                    notes
                ) VALUES (
                    v_assigned_workout_id,
                    v_assigned_item_id,
                    v_item.id,
                    v_item.item_type,
                    v_item.order_index,
                    v_item.exercise_id,
                    v_item.ex_name,
                    v_item.ex_muscle_group,
                    v_item.ex_equipment,
                    v_item.sets,
                    v_item.reps,
                    v_item.rest_seconds,
                    v_item.notes
                );
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN v_assigned_program_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_program_to_student(UUID, UUID) TO authenticated;
