-- Migration 068: Convert multi_choice questions to long_text in initial_assessment
--
-- The mobile app does not render multi_choice options. Instead of building the
-- component now, we convert these 5 questions to long_text with placeholder
-- hints listing the original options as suggestions.
--
-- Questions converted:
--   goal_barriers, available_days, cardio_equipment_preference,
--   favorite_exercises, preferred_training_formats

BEGIN;

-- Use a DO block to update each question by index in a single pass.
-- We rebuild each target question as a new jsonb object (long_text with placeholder)
-- and replace it in the questions array via jsonb_set.

DO $$
DECLARE
    v_schema jsonb;
    v_questions jsonb;
    v_question jsonb;
    v_idx int;
    v_id text;
    v_new_question jsonb;
BEGIN
    SELECT schema_json INTO v_schema
    FROM form_templates
    WHERE system_key = 'initial_assessment';

    IF v_schema IS NULL THEN
        RAISE NOTICE 'initial_assessment template not found, skipping';
        RETURN;
    END IF;

    v_questions := v_schema -> 'questions';

    FOR v_idx IN 0..jsonb_array_length(v_questions) - 1 LOOP
        v_question := v_questions -> v_idx;
        v_id := v_question ->> 'id';

        -- Skip if not one of the target questions or already converted
        IF v_id IS NULL OR (v_question ->> 'type') <> 'multi_choice' THEN
            CONTINUE;
        END IF;

        CASE v_id
            WHEN 'goal_barriers' THEN
                v_new_question := jsonb_build_object(
                    'id', 'goal_barriers',
                    'type', 'long_text',
                    'label', v_question ->> 'label',
                    'required', (v_question ->> 'required')::boolean,
                    'placeholder', 'Ex: Constância nos treinos, constância na dieta, fatores emocionais, treinos aleatórios...'
                );

            WHEN 'available_days' THEN
                v_new_question := jsonb_build_object(
                    'id', 'available_days',
                    'type', 'long_text',
                    'label', v_question ->> 'label',
                    'required', (v_question ->> 'required')::boolean,
                    'placeholder', 'Ex: Segunda, Quarta e Sexta'
                );

            WHEN 'cardio_equipment_preference' THEN
                v_new_question := jsonb_build_object(
                    'id', 'cardio_equipment_preference',
                    'type', 'long_text',
                    'label', v_question ->> 'label',
                    'required', (v_question ->> 'required')::boolean,
                    'placeholder', 'Ex: Bike, Esteira, Corda naval, Elíptico...'
                );

            WHEN 'favorite_exercises' THEN
                v_new_question := jsonb_build_object(
                    'id', 'favorite_exercises',
                    'type', 'long_text',
                    'label', v_question ->> 'label',
                    'required', (v_question ->> 'required')::boolean,
                    'placeholder', 'Ex: Agachamento, Leg Press, Supino, Remada, Rosca bíceps...'
                );

            WHEN 'preferred_training_formats' THEN
                v_new_question := jsonb_build_object(
                    'id', 'preferred_training_formats',
                    'type', 'long_text',
                    'label', v_question ->> 'label',
                    'required', (v_question ->> 'required')::boolean,
                    'placeholder', 'Ex: Treinos rápidos, intervalos curtos, alta carga, até a falha, membros superiores e inferiores separados...'
                );

            ELSE
                CONTINUE;
        END CASE;

        -- Replace the question at this index
        v_questions := jsonb_set(v_questions, ARRAY[v_idx::text], v_new_question);
    END LOOP;

    -- Write back the updated questions array
    UPDATE form_templates
    SET schema_json = jsonb_set(v_schema, '{questions}', v_questions)
    WHERE system_key = 'initial_assessment';
END;
$$;

-- Also patch any existing draft submissions that have these questions as multi_choice
DO $$
DECLARE
    v_sub RECORD;
    v_questions jsonb;
    v_question jsonb;
    v_idx int;
    v_id text;
    v_new_question jsonb;
BEGIN
    FOR v_sub IN
        SELECT id, schema_snapshot_json
        FROM form_submissions
        WHERE status = 'draft'
          AND schema_snapshot_json IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(schema_snapshot_json -> 'questions') q
              WHERE q ->> 'type' = 'multi_choice'
                AND q ->> 'id' IN ('goal_barriers', 'available_days', 'cardio_equipment_preference', 'favorite_exercises', 'preferred_training_formats')
          )
    LOOP
        v_questions := v_sub.schema_snapshot_json -> 'questions';

        FOR v_idx IN 0..jsonb_array_length(v_questions) - 1 LOOP
            v_question := v_questions -> v_idx;
            v_id := v_question ->> 'id';

            IF (v_question ->> 'type') <> 'multi_choice' THEN
                CONTINUE;
            END IF;

            CASE v_id
                WHEN 'goal_barriers' THEN
                    v_new_question := jsonb_build_object(
                        'id', 'goal_barriers',
                        'type', 'long_text',
                        'label', v_question ->> 'label',
                        'required', (v_question ->> 'required')::boolean,
                        'placeholder', 'Ex: Constância nos treinos, constância na dieta, fatores emocionais, treinos aleatórios...'
                    );
                WHEN 'available_days' THEN
                    v_new_question := jsonb_build_object(
                        'id', 'available_days',
                        'type', 'long_text',
                        'label', v_question ->> 'label',
                        'required', (v_question ->> 'required')::boolean,
                        'placeholder', 'Ex: Segunda, Quarta e Sexta'
                    );
                WHEN 'cardio_equipment_preference' THEN
                    v_new_question := jsonb_build_object(
                        'id', 'cardio_equipment_preference',
                        'type', 'long_text',
                        'label', v_question ->> 'label',
                        'required', (v_question ->> 'required')::boolean,
                        'placeholder', 'Ex: Bike, Esteira, Corda naval, Elíptico...'
                    );
                WHEN 'favorite_exercises' THEN
                    v_new_question := jsonb_build_object(
                        'id', 'favorite_exercises',
                        'type', 'long_text',
                        'label', v_question ->> 'label',
                        'required', (v_question ->> 'required')::boolean,
                        'placeholder', 'Ex: Agachamento, Leg Press, Supino, Remada, Rosca bíceps...'
                    );
                WHEN 'preferred_training_formats' THEN
                    v_new_question := jsonb_build_object(
                        'id', 'preferred_training_formats',
                        'type', 'long_text',
                        'label', v_question ->> 'label',
                        'required', (v_question ->> 'required')::boolean,
                        'placeholder', 'Ex: Treinos rápidos, intervalos curtos, alta carga, até a falha, membros superiores e inferiores separados...'
                    );
                ELSE
                    CONTINUE;
            END CASE;

            v_questions := jsonb_set(v_questions, ARRAY[v_idx::text], v_new_question);
        END LOOP;

        UPDATE form_submissions
        SET schema_snapshot_json = jsonb_set(v_sub.schema_snapshot_json, '{questions}', v_questions)
        WHERE id = v_sub.id;
    END LOOP;
END;
$$;

COMMIT;
