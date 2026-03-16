-- ============================================================================
-- Kinevo — 062 Prescription Questionnaire
-- ============================================================================
-- 1. Allow system templates (trainer_id nullable)
-- 2. Add system_key for programmatic template lookup
-- 3. Update RLS SELECT policy to include system templates
-- 4. Update assign_form_to_students RPC to accept system templates
-- 5. Insert the prescription questionnaire template
-- ============================================================================

-- ============================================================================
-- 1) Schema changes
-- ============================================================================

-- Allow system-level templates (no trainer owner)
ALTER TABLE form_templates ALTER COLUMN trainer_id DROP NOT NULL;

-- Fixed identifier for system templates (e.g. 'prescription_questionnaire')
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS system_key TEXT UNIQUE;

-- ============================================================================
-- 2) RLS: Update SELECT policy to include system templates (trainer_id IS NULL)
-- ============================================================================
-- Existing policies from migration 047:
--   form_templates_trainer_select  (SELECT) — needs update
--   form_templates_trainer_insert  (INSERT) — keep as-is (trainers insert their own)
--   form_templates_trainer_update  (UPDATE) — keep as-is (no one edits system templates)
--   form_templates_trainer_delete  (DELETE) — keep as-is (no one deletes system templates)

DROP POLICY IF EXISTS form_templates_trainer_select ON form_templates;
CREATE POLICY form_templates_trainer_select
    ON form_templates FOR SELECT
    USING (trainer_id = current_trainer_id() OR trainer_id IS NULL);

-- ============================================================================
-- 3) Update RPC: assign_form_to_students
-- ============================================================================
-- Only change: WHERE clause now accepts system templates (trainer_id IS NULL)

CREATE OR REPLACE FUNCTION assign_form_to_students(
    p_form_template_id UUID,
    p_student_ids UUID[],
    p_due_at TIMESTAMPTZ DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trainer_id UUID := current_trainer_id();
    v_template RECORD;
    v_student_id UUID;
    v_inbox_id UUID;
    v_submission_id UUID;
    v_assigned_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    IF v_trainer_id IS NULL THEN
        RAISE EXCEPTION 'Only trainers can assign forms';
    END IF;

    IF p_form_template_id IS NULL THEN
        RAISE EXCEPTION 'p_form_template_id is required';
    END IF;

    IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'p_student_ids must contain at least one student';
    END IF;

    -- CHANGED: Accept system templates (trainer_id IS NULL) in addition to trainer-owned
    SELECT
        ft.id,
        ft.title,
        ft.category,
        ft.version,
        ft.schema_json
    INTO v_template
    FROM form_templates ft
    WHERE ft.id = p_form_template_id
      AND (ft.trainer_id = v_trainer_id OR ft.trainer_id IS NULL)
      AND ft.is_active = true;

    IF v_template.id IS NULL THEN
        RAISE EXCEPTION 'Form template not found or inactive for current trainer';
    END IF;

    FOR v_student_id IN
        SELECT DISTINCT student_id
        FROM unnest(p_student_ids) AS student_id
    LOOP
        -- Ownership guard: trainer can only assign to their own students.
        IF NOT EXISTS (
            SELECT 1
            FROM students s
            WHERE s.id = v_student_id
              AND s.coach_id = v_trainer_id
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Skip duplicates if there is already a pending/unread request
        -- for this student+template pair.
        IF EXISTS (
            SELECT 1
            FROM student_inbox_items si
            WHERE si.student_id = v_student_id
              AND si.trainer_id = v_trainer_id
              AND si.type = 'form_request'
              AND si.status IN ('unread', 'pending_action')
              AND si.payload ->> 'form_template_id' = p_form_template_id::TEXT
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        INSERT INTO student_inbox_items (
            student_id,
            trainer_id,
            type,
            status,
            title,
            subtitle,
            payload,
            due_at
        ) VALUES (
            v_student_id,
            v_trainer_id,
            'form_request',
            'pending_action',
            v_template.title,
            CASE
                WHEN p_message IS NULL OR btrim(p_message) = '' THEN 'Novo formulário'
                ELSE btrim(p_message)
            END,
            jsonb_build_object(
                'payload_version', 1,
                'form_template_id', v_template.id,
                'form_template_version', v_template.version,
                'category', v_template.category,
                'request_message', NULLIF(btrim(COALESCE(p_message, '')), '')
            ),
            p_due_at
        )
        RETURNING id INTO v_inbox_id;

        INSERT INTO form_submissions (
            form_template_id,
            form_template_version,
            trainer_id,
            student_id,
            inbox_item_id,
            status,
            schema_snapshot_json
        ) VALUES (
            v_template.id,
            v_template.version,
            v_trainer_id,
            v_student_id,
            v_inbox_id,
            'draft',
            v_template.schema_json
        )
        RETURNING id INTO v_submission_id;

        -- Backfill submission_id into inbox payload.
        UPDATE student_inbox_items
        SET payload = payload || jsonb_build_object('submission_id', v_submission_id)
        WHERE id = v_inbox_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'assigned_count', v_assigned_count,
        'skipped_count', v_skipped_count
    );
END;
$$;

-- ============================================================================
-- 4) Insert prescription questionnaire template
-- ============================================================================

INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    schema_json,
    is_default_for_new_students,
    created_source,
    system_key
) VALUES (
    NULL,
    'Questionário de Prescrição',
    'Suas respostas ajudam a criar um programa de treino personalizado e seguro. Leva cerca de 5 minutos.',
    'anamnese',
    '{
        "schema_version": "1.0",
        "layout": {
            "estimated_minutes": 5,
            "progress_mode": "per_question"
        },
        "questions": [
            {
                "id": "training_experience",
                "type": "single_choice",
                "label": "Há quanto tempo treina musculação de forma consistente?",
                "required": true,
                "options": [
                    {"value": "menos_3m", "label": "Menos de 3 meses"},
                    {"value": "3_6m", "label": "3 a 6 meses"},
                    {"value": "6m_2a", "label": "6 meses a 2 anos"},
                    {"value": "mais_2a", "label": "Mais de 2 anos"}
                ]
            },
            {
                "id": "realistic_frequency",
                "type": "single_choice",
                "label": "Quantos dias por semana você REALMENTE consegue treinar? (Seja honesto — melhor prometer menos e cumprir)",
                "required": true,
                "options": [
                    {"value": "2", "label": "2 dias"},
                    {"value": "3", "label": "3 dias"},
                    {"value": "4", "label": "4 dias"},
                    {"value": "5", "label": "5 dias"},
                    {"value": "6", "label": "6 dias"}
                ]
            },
            {
                "id": "session_duration",
                "type": "single_choice",
                "label": "Quanto tempo você consegue ficar na academia por sessão?",
                "required": true,
                "options": [
                    {"value": "30_40", "label": "30 a 40 minutos"},
                    {"value": "40_50", "label": "40 a 50 minutos"},
                    {"value": "50_60", "label": "50 a 60 minutos"},
                    {"value": "60_75", "label": "60 a 75 minutos"},
                    {"value": "75_90", "label": "75 a 90 minutos"}
                ]
            },
            {
                "id": "previous_experience",
                "type": "long_text",
                "label": "Você já fez algum programa de treino antes? Como foi a experiência?",
                "required": false,
                "placeholder": "Conte como foi — o que funcionou, o que não deu certo, por que parou (se parou)..."
            },
            {
                "id": "primary_goal",
                "type": "single_choice",
                "label": "Qual seu principal objetivo com o treino?",
                "required": true,
                "options": [
                    {"value": "hypertrophy", "label": "Ganhar massa muscular (hipertrofia)"},
                    {"value": "weight_loss", "label": "Perder gordura / emagrecer"},
                    {"value": "health", "label": "Melhorar saúde geral e qualidade de vida"},
                    {"value": "rehab", "label": "Reduzir dor ou reabilitar uma lesão"},
                    {"value": "performance", "label": "Melhorar performance esportiva"}
                ]
            },
            {
                "id": "muscle_emphasis",
                "type": "multi_choice",
                "label": "Tem algum grupo muscular que gostaria de dar mais atenção?",
                "required": false,
                "options": [
                    {"value": "gluteo", "label": "Glúteo"},
                    {"value": "peito", "label": "Peito"},
                    {"value": "costas", "label": "Costas"},
                    {"value": "ombros", "label": "Ombros"},
                    {"value": "bracos", "label": "Braços (Bíceps e Tríceps)"},
                    {"value": "pernas", "label": "Pernas (Quadríceps e Posterior)"},
                    {"value": "equilibrado", "label": "Sem preferência — distribuição equilibrada"}
                ]
            },
            {
                "id": "motivation",
                "type": "single_choice",
                "label": "O que mais te motiva a treinar?",
                "required": false,
                "options": [
                    {"value": "estetico", "label": "Ver resultado estético (corpo)"},
                    {"value": "forca", "label": "Sentir-me mais forte"},
                    {"value": "saude", "label": "Melhorar minha saúde"},
                    {"value": "energia", "label": "Ter mais energia no dia a dia"},
                    {"value": "estresse", "label": "Aliviar estresse"},
                    {"value": "outro", "label": "Outro"}
                ]
            },
            {
                "id": "has_injury",
                "type": "single_choice",
                "label": "Você possui alguma lesão, dor ou limitação física atualmente?",
                "required": true,
                "options": [
                    {"value": "sim", "label": "Sim"},
                    {"value": "nao", "label": "Não"}
                ]
            },
            {
                "id": "injury_description",
                "type": "long_text",
                "label": "Descreva sua lesão ou limitação. Seja o mais detalhista possível.",
                "required": false,
                "placeholder": "Ex: Dor no joelho direito ao agachar além de 90°, hérnia de disco L4-L5, tendinite no ombro esquerdo..."
            },
            {
                "id": "painful_activities",
                "type": "multi_choice",
                "label": "Quais atividades causam dor ou desconforto?",
                "required": false,
                "options": [
                    {"value": "agachar", "label": "Agachar"},
                    {"value": "escadas", "label": "Subir escadas"},
                    {"value": "correr", "label": "Correr"},
                    {"value": "acima_cabeca", "label": "Levantar peso acima da cabeça"},
                    {"value": "empurrar", "label": "Empurrar (movimento de supino)"},
                    {"value": "puxar", "label": "Puxar"},
                    {"value": "sentado", "label": "Ficar muito tempo sentado"},
                    {"value": "caminhar", "label": "Caminhar"},
                    {"value": "nenhuma", "label": "Nenhuma das anteriores"}
                ]
            },
            {
                "id": "medical_followup",
                "type": "single_choice",
                "label": "Você está em acompanhamento com fisioterapeuta ou médico por essa condição?",
                "required": false,
                "options": [
                    {"value": "ativo", "label": "Sim, estou em acompanhamento ativo"},
                    {"value": "anterior", "label": "Já fiz acompanhamento, mas não estou mais"},
                    {"value": "nao", "label": "Não"}
                ]
            },
            {
                "id": "favorite_exercises",
                "type": "long_text",
                "label": "Tem algum exercício que você GOSTA muito e gostaria de manter no programa?",
                "required": false,
                "placeholder": "Ex: adoro supino, gosto de hip thrust, curto fazer prancha..."
            },
            {
                "id": "disliked_exercises",
                "type": "long_text",
                "label": "Tem algum exercício que você NÃO GOSTA ou prefere evitar?",
                "required": false,
                "placeholder": "Ex: não gosto de leg press, odeio burpee, não curto exercício com barra..."
            },
            {
                "id": "training_style",
                "type": "multi_choice",
                "label": "Como você prefere seus treinos?",
                "required": false,
                "options": [
                    {"value": "pesado", "label": "Poucos exercícios mas pesados"},
                    {"value": "moderado", "label": "Muitos exercícios com carga moderada"},
                    {"value": "variado", "label": "Variado a cada sessão"},
                    {"value": "fixo", "label": "Rotina fixa que eu decore fácil"},
                    {"value": "com_cardio", "label": "Com bastante cardio junto"},
                    {"value": "sem_cardio", "label": "Só musculação, sem cardio"}
                ]
            },
            {
                "id": "training_environment",
                "type": "single_choice",
                "label": "Qual é o seu ambiente de treino?",
                "required": true,
                "options": [
                    {"value": "academia_completa", "label": "Academia completa"},
                    {"value": "home_gym_completo", "label": "Home gym completo (barra, halteres, polia)"},
                    {"value": "home_gym_basico", "label": "Home gym básico (halteres, banco)"},
                    {"value": "ao_ar_livre", "label": "Ao ar livre"},
                    {"value": "apenas_peso_corporal", "label": "Apenas peso corporal"}
                ]
            },
            {
                "id": "activity_level",
                "type": "single_choice",
                "label": "Qual seu nível de atividade fora da academia?",
                "required": true,
                "options": [
                    {"value": "sedentario", "label": "Sedentário (trabalho sentado, pouco movimento)"},
                    {"value": "moderado", "label": "Moderado (caminho bastante, trabalho em pé)"},
                    {"value": "ativo", "label": "Ativo (trabalho físico ou pratico outro esporte)"}
                ]
            },
            {
                "id": "additional_info",
                "type": "long_text",
                "label": "Tem algo mais que gostaria que seu treinador soubesse antes de montar seu programa?",
                "required": false,
                "placeholder": "Qualquer informação que ache relevante..."
            }
        ]
    }'::jsonb,
    false,
    'manual',
    'prescription_questionnaire'
);
