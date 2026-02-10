-- ============================================================================
-- RPC Update: assign_program_to_student
-- ============================================================================
-- Updates the function to accept an optional start_date.
-- Usage: assign_program_to_student(template_id, student_id, start_date)
-- ============================================================================

DROP FUNCTION IF EXISTS public.assign_program_to_student(UUID, UUID);

CREATE OR REPLACE FUNCTION public.assign_program_to_student(
    p_template_id UUID,
    p_student_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT now()
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
    v_child_item RECORD;
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
        p_start_date, -- Use the provided start date (defaults to now())
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
                   (SELECT string_agg(mg.name, ', ') 
                    FROM exercise_muscle_groups emg 
                    JOIN muscle_groups mg ON emg.muscle_group_id = mg.id 
                    WHERE emg.exercise_id = e.id) as ex_muscle_group,
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
            
            -- Store mapping for parent references (optional, but good for consistency)
            v_parent_mapping := v_parent_mapping || jsonb_build_object(v_item.id::text, v_assigned_item_id::text);
            
            -- Copy child items (for supersets)
            FOR v_child_item IN 
                SELECT wit.*, 
                       e.name as ex_name,
                       (SELECT string_agg(mg.name, ', ') 
                        FROM exercise_muscle_groups emg 
                        JOIN muscle_groups mg ON emg.muscle_group_id = mg.id 
                        WHERE emg.exercise_id = e.id) as ex_muscle_group,
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
                    v_child_item.item_type,
                    v_child_item.order_index,
                    v_child_item.exercise_id,
                    v_child_item.ex_name,
                    v_child_item.ex_muscle_group,
                    v_child_item.ex_equipment,
                    v_child_item.sets,
                    v_child_item.reps,
                    v_child_item.rest_seconds,
                    v_child_item.notes
                );
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN v_assigned_program_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_program_to_student(UUID, UUID, TIMESTAMPTZ) TO authenticated;
