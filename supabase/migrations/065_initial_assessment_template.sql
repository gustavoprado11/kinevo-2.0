-- ============================================================================
-- Kinevo — 065 Initial Assessment Template (System Seed)
-- ============================================================================
-- Inserts a system-level "Avaliacao Inicial" form template with 47 questions
-- covering PAR-Q, personal info, limitations, goals, lifestyle, training
-- history, and training preferences.
-- ============================================================================

INSERT INTO form_templates (
    trainer_id,
    title,
    description,
    category,
    schema_json,
    is_active,
    is_default_for_new_students,
    version,
    created_source,
    system_key
) VALUES (
    NULL,
    'Avaliação Inicial',
    'Olá! O objetivo deste formulário é conhecer melhor você, seu histórico de saúde e seu estilo de vida. Quanto mais detalhes você fornecer, mais assertivo e personalizado será o seu acompanhamento. Responda com suas palavras — vamos juntos!',
    'anamnese',
    $schema_json${
        "schema_version": "1.0",
        "layout": {
            "estimated_minutes": 15,
            "progress_mode": "per_question"
        },
        "questions": [
            {
                "id": "parq_heart_condition",
                "type": "single_choice",
                "label": "Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_chest_pain_exercise",
                "type": "single_choice",
                "label": "Você sente dores no peito quando pratica atividade física?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_chest_pain_recent",
                "type": "single_choice",
                "label": "No último mês, você sentiu dores no peito quando praticou atividade física?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_dizziness",
                "type": "single_choice",
                "label": "Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_bone_joint",
                "type": "single_choice",
                "label": "Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_medication",
                "type": "single_choice",
                "label": "Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_other_reason",
                "type": "single_choice",
                "label": "Sabe de alguma outra razão pela qual você não deve praticar atividade física?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "parq_responsibility_term",
                "type": "single_choice",
                "label": "Se você respondeu \"Sim\" a uma ou mais perguntas, leia e assine o Termo de Responsabilidade: \"Estou ciente de que é recomendável conversar com um médico antes de aumentar meu nível atual de atividade física, por ter respondido 'Sim' a uma ou mais perguntas do PAR-Q.\"",
                "required": true,
                "options": [
                    {"value": "aware_yes", "label": "Assumo plena responsabilidade por qualquer atividade física praticada sem o atendimento a essa recomendação."},
                    {"value": "aware_no", "label": "Mesmo tendo respondido NÃO em todas as perguntas, assumo plena responsabilidade por qualquer atividade física praticada."}
                ]
            },
            {
                "id": "birth_date",
                "type": "short_text",
                "label": "Data de nascimento",
                "required": true,
                "placeholder": "DD/MM/AAAA"
            },
            {
                "id": "sex",
                "type": "single_choice",
                "label": "Sexo",
                "required": true,
                "options": [
                    {"value": "male", "label": "Masculino"},
                    {"value": "female", "label": "Feminino"},
                    {"value": "prefer_not_say", "label": "Prefiro não declarar"}
                ]
            },
            {
                "id": "height_cm",
                "type": "short_text",
                "label": "Altura (em cm, sem vírgula)",
                "required": true,
                "placeholder": "Ex: 175"
            },
            {
                "id": "weight_kg",
                "type": "short_text",
                "label": "Peso (em kg)",
                "required": true,
                "placeholder": "Ex: 78"
            },
            {
                "id": "body_fat_percentage",
                "type": "short_text",
                "label": "Percentual de gordura (%)",
                "required": false,
                "placeholder": "Se souber, informe aqui"
            },
            {
                "id": "has_medical_restriction",
                "type": "single_choice",
                "label": "Possui alguma restrição médica?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "medical_restriction_description",
                "type": "long_text",
                "label": "Se sim, descreva a restrição:",
                "required": false,
                "placeholder": "Descreva sua restrição médica com o máximo de detalhes possível"
            },
            {
                "id": "recent_surgery",
                "type": "single_choice",
                "label": "Passou por algum procedimento cirúrgico nos últimos dois anos?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "has_chronic_pain",
                "type": "single_choice",
                "label": "Você possui dores crônicas?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "has_lower_back_pain",
                "type": "single_choice",
                "label": "Você possui dor na região lombar?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "has_thoracic_pain",
                "type": "single_choice",
                "label": "Você possui dor na região torácica?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "has_cervical_pain",
                "type": "single_choice",
                "label": "Você possui dor na região cervical?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "pain_description",
                "type": "long_text",
                "label": "Descreva suas dores ou limitações:",
                "required": false,
                "placeholder": "Localização, intensidade, quando aparece, o que alivia..."
            },
            {
                "id": "training_level",
                "type": "single_choice",
                "label": "Para que eu consiga ser assertivo no seu treino e que ele seja compatível à sua capacidade, assinale a alternativa em que você mais se vê atualmente:",
                "required": true,
                "options": [
                    {"value": "beginner", "label": "Atualmente não treino, ou treino há menos de 6 meses e, nesse período, treinei de forma aleatória, sem continuidade, e desestruturada. Não estou familiarizado com termos como: cadência, zona de repetições e intensidade de esforço e tenho dificuldade em lidar com o próprio peso do meu corpo em exercícios como afundo, flexão, agachamentos."},
                    {"value": "intermediate", "label": "Treino há mais de 6 meses de forma organizada, sei lidar com variáveis como cadência, intensidade de esforço ao final de cada série e tenho domínio na execução de exercícios básicos como agachamento, supinos, flexão, afundo..."},
                    {"value": "advanced", "label": "Treino há mais de 1 ano, tenho facilidade em lidar com exercícios como levantamento terra, stiff, flexão e já realizei métodos como dropset, rest-pause ou mesmo treinos de forma segura até a falha muscular."}
                ]
            },
            {
                "id": "primary_goal",
                "type": "single_choice",
                "label": "Qual o seu objetivo principal?",
                "required": true,
                "options": [
                    {"value": "weight_loss", "label": "Emagrecimento"},
                    {"value": "hypertrophy", "label": "Hipertrofia"},
                    {"value": "sports_performance", "label": "Desempenho esportivo"},
                    {"value": "quality_of_life", "label": "Qualidade de vida"}
                ]
            },
            {
                "id": "goal_details",
                "type": "long_text",
                "label": "Se possível, descreva seu objetivo detalhadamente:",
                "required": false,
                "placeholder": "Conte mais sobre o que você quer alcançar..."
            },
            {
                "id": "goal_barriers",
                "type": "multi_choice",
                "label": "O que tem impedido você de alcançar esse objetivo? Assinale as opções com as quais mais se identifica:",
                "required": true,
                "options": [
                    {"value": "consistency_training", "label": "Constância nos treinos"},
                    {"value": "consistency_diet", "label": "Constância na dieta"},
                    {"value": "emotional_factors", "label": "Fatores emocionais"},
                    {"value": "random_workouts", "label": "Faço treinos aleatórios"}
                ]
            },
            {
                "id": "available_days",
                "type": "multi_choice",
                "label": "Quais dias da semana você tem disponibilidade para treinar?",
                "required": true,
                "options": [
                    {"value": "monday", "label": "Segunda"},
                    {"value": "tuesday", "label": "Terça"},
                    {"value": "wednesday", "label": "Quarta"},
                    {"value": "thursday", "label": "Quinta"},
                    {"value": "friday", "label": "Sexta"},
                    {"value": "saturday", "label": "Sábado"},
                    {"value": "sunday", "label": "Domingo"}
                ]
            },
            {
                "id": "has_nutritionist",
                "type": "single_choice",
                "label": "Possui acompanhamento nutricional?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "eating_routine",
                "type": "long_text",
                "label": "Como é sua rotina alimentar? O que come, em quais horários. Mesmo que não tenha acompanhamento nutricional, descreva sua alimentação.",
                "required": true,
                "placeholder": "Descreva suas refeições habituais, horários e hábitos alimentares..."
            },
            {
                "id": "diet_adherence",
                "type": "scale",
                "label": "Quantos % da sua dieta você faz atualmente?",
                "required": false,
                "scale": {"min": 1, "max": 10, "min_label": "10%", "max_label": "100%"}
            },
            {
                "id": "alcohol_consumption",
                "type": "single_choice",
                "label": "Consumo de bebida alcoólica:",
                "required": true,
                "options": [
                    {"value": "none", "label": "Não bebo"},
                    {"value": "1x_week", "label": "1x por semana"},
                    {"value": "2x_week", "label": "2x por semana"},
                    {"value": "3x_week", "label": "3x por semana"},
                    {"value": "heavy_weekends", "label": "Aos finais de semana e bastante"},
                    {"value": "daily", "label": "Todos os dias"}
                ]
            },
            {
                "id": "extra_activities",
                "type": "long_text",
                "label": "Realiza atividades esportivas ou extras? Se sim, qual? Quantos dias por semana?",
                "required": true,
                "placeholder": "Ex: Jogo futebol 2x por semana, faço caminhada 3x..."
            },
            {
                "id": "extra_activity_intensity",
                "type": "scale",
                "label": "Se realiza atividades extras, qual a intensidade?",
                "required": false,
                "scale": {"min": 1, "max": 10, "min_label": "Muito leve", "max_label": "Exaustiva"}
            },
            {
                "id": "currently_training",
                "type": "single_choice",
                "label": "Atualmente, você pratica musculação?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "training_duration",
                "type": "single_choice",
                "label": "Se sim, há quanto tempo treina regularmente?",
                "required": false,
                "options": [
                    {"value": "up_to_3m", "label": "Até 3 meses"},
                    {"value": "3_to_6m", "label": "De 3 a 6 meses"},
                    {"value": "6m_to_1y", "label": "De 6 meses a 1 ano"},
                    {"value": "over_1y", "label": "Mais que 1 ano"}
                ]
            },
            {
                "id": "last_workout_description",
                "type": "long_text",
                "label": "Como era seu último treino? Composto de quantos exercícios, séries e repetições? Descreva do seu jeito, com suas palavras (essa pergunta é muito importante).",
                "required": true,
                "placeholder": "Ex: Fazia treino ABC, 4 séries de 12 repetições, supino, agachamento..."
            },
            {
                "id": "inactivity_duration",
                "type": "single_choice",
                "label": "Se não treina, há quanto tempo está inativo?",
                "required": false,
                "options": [
                    {"value": "up_to_3m", "label": "Até 3 meses"},
                    {"value": "3_to_6m", "label": "De 3 a 6 meses"},
                    {"value": "6m_to_1y", "label": "De 6 meses a 1 ano"},
                    {"value": "over_1y", "label": "Mais que 1 ano"}
                ]
            },
            {
                "id": "wants_cardio",
                "type": "single_choice",
                "label": "Faz questão de ter no seu planejamento um treino aeróbio?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim"},
                    {"value": "no", "label": "Não"}
                ]
            },
            {
                "id": "cardio_type_preference",
                "type": "single_choice",
                "label": "Qual tipo de treino aeróbio mais se identifica?",
                "required": false,
                "options": [
                    {"value": "hiit", "label": "Gosto de treinos mais rápidos e intensos: HIIT"},
                    {"value": "steady_state", "label": "Gosto de treino aeróbio mais longo (1h ou mais)"},
                    {"value": "both", "label": "Gosto dos dois"}
                ]
            },
            {
                "id": "cardio_equipment_preference",
                "type": "multi_choice",
                "label": "Se faz questão de treino aeróbio, quais ergômetros prefere?",
                "required": false,
                "options": [
                    {"value": "bike", "label": "Bike"},
                    {"value": "treadmill", "label": "Corrida/Esteira"},
                    {"value": "battle_rope", "label": "Corda naval"},
                    {"value": "elliptical", "label": "Transport (Elíptico)"}
                ]
            },
            {
                "id": "training_structure",
                "type": "long_text",
                "label": "Fale um pouco sobre a sua estrutura de treino. Se treinará em casa ou na academia, bem como os equipamentos que possui, ou até mesmo se não possui nenhum equipamento.",
                "required": true,
                "placeholder": "Ex: Treino na academia perto de casa, tem todos os equipamentos básicos..."
            },
            {
                "id": "gym_demotivation",
                "type": "single_choice",
                "label": "O que mais o desmotiva na academia?",
                "required": true,
                "options": [
                    {"value": "nothing", "label": "Nada"},
                    {"value": "time", "label": "Falta de tempo"},
                    {"value": "long_workouts", "label": "Treinos longos e demorados"},
                    {"value": "no_results", "label": "Falta de resultados"},
                    {"value": "monotony", "label": "Monotonia"}
                ]
            },
            {
                "id": "isolation_exercises",
                "type": "single_choice",
                "label": "Você vê necessidade de incluir movimentos que isolem os músculos do bíceps, tríceps, deltóides e glúteos, na sua prescrição?",
                "required": true,
                "options": [
                    {"value": "yes", "label": "Sim. Gostaria de fazer exercícios isolados."},
                    {"value": "indifferent", "label": "Indiferente. Desde que o resultado seja alcançado, não tenho preferência."},
                    {"value": "no", "label": "Não gostaria. Tenho pouco tempo para treinar e não gosto de treinos mais demorados."}
                ]
            },
            {
                "id": "favorite_exercises",
                "type": "multi_choice",
                "label": "Assinale alguns exercícios que gosta:",
                "required": true,
                "options": [
                    {"value": "squat", "label": "Agachamento"},
                    {"value": "leg_press", "label": "Leg Press"},
                    {"value": "lunge", "label": "Afundo"},
                    {"value": "stiff", "label": "Stiff"},
                    {"value": "bench_press", "label": "Supino"},
                    {"value": "push_up", "label": "Flexão de braços"},
                    {"value": "row", "label": "Remada"},
                    {"value": "pulldown", "label": "Pulley"},
                    {"value": "bicep_curl", "label": "Rosca bíceps"},
                    {"value": "tricep_pushdown", "label": "Tríceps pulley"},
                    {"value": "no_preference", "label": "Sem preferências"}
                ]
            },
            {
                "id": "preferred_training_formats",
                "type": "multi_choice",
                "label": "Assinale alguns formatos de treino que gosta:",
                "required": true,
                "options": [
                    {"value": "circuit", "label": "Treinos em circuito"},
                    {"value": "short_rest", "label": "Treinos com intervalos reduzidos"},
                    {"value": "long_rest", "label": "Treinos com intervalos longos"},
                    {"value": "light_load", "label": "Treinos com baixa carga (kg)"},
                    {"value": "heavy_load", "label": "Treinos com alta carga (kg)"},
                    {"value": "full_body", "label": "Treinos com membros superiores e inferiores na mesma sessão"},
                    {"value": "split", "label": "Treinos de membros superiores e inferiores separados"},
                    {"value": "to_failure", "label": "Treinos até a falha"},
                    {"value": "quick", "label": "Treinos rápidos"},
                    {"value": "long", "label": "Treinos longos (>1h/dia)"},
                    {"value": "no_preference", "label": "Sem preferências"}
                ]
            },
            {
                "id": "disliked_exercises_or_formats",
                "type": "long_text",
                "label": "O que você não gosta de exercícios ou formatos de treinos?",
                "required": true,
                "placeholder": "Ex: Não gosto de treinos longos, não curto exercícios com barra..."
            },
            {
                "id": "motivation_level",
                "type": "scale",
                "label": "O quanto você está motivado(a)?",
                "required": true,
                "scale": {"min": 1, "max": 5, "min_label": "Pouco motivado", "max_label": "Muito motivado"}
            },
            {
                "id": "additional_info",
                "type": "long_text",
                "label": "Agora fique à vontade para compartilhar qualquer informação sobre você ou sobre seu objetivo. Ficaria muito feliz se compartilhasse um pouco mais!",
                "required": false,
                "placeholder": "Conte o que quiser..."
            }
        ]
    }$schema_json$::jsonb,
    true,
    false,
    1,
    'manual',
    'initial_assessment'
)
ON CONFLICT (system_key) DO NOTHING;
