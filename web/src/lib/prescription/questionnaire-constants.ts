// ============================================================================
// Kinevo Prescription Engine — Prescription Questionnaire Constants
// ============================================================================
// Schema for the prescription questionnaire sent to students via mobile inbox.
// 17 questions in 5 sections. Format compatible with mobile inbox/[id].tsx.

// ============================================================================
// System Key
// ============================================================================

export const PRESCRIPTION_QUESTIONNAIRE_KEY = 'prescription_questionnaire'

// ============================================================================
// Schema (matches form_templates.schema_json format)
// ============================================================================

export const PRESCRIPTION_QUESTIONNAIRE_SCHEMA = {
    schema_version: '1.0',
    layout: {
        estimated_minutes: 5,
        progress_mode: 'per_question' as const,
    },
    questions: [
        // ─────────────────────────────────────────────
        // SEÇÃO 1 — Histórico e Experiência
        // ─────────────────────────────────────────────
        {
            id: 'training_experience',
            type: 'single_choice',
            label: 'Há quanto tempo treina musculação de forma consistente?',
            required: true,
            options: [
                { value: 'menos_3m', label: 'Menos de 3 meses' },
                { value: '3_6m', label: '3 a 6 meses' },
                { value: '6m_2a', label: '6 meses a 2 anos' },
                { value: 'mais_2a', label: 'Mais de 2 anos' },
            ],
        },
        {
            id: 'realistic_frequency',
            type: 'single_choice',
            label: 'Quantos dias por semana você REALMENTE consegue treinar? (Seja honesto — melhor prometer menos e cumprir)',
            required: true,
            options: [
                { value: '2', label: '2 dias' },
                { value: '3', label: '3 dias' },
                { value: '4', label: '4 dias' },
                { value: '5', label: '5 dias' },
                { value: '6', label: '6 dias' },
            ],
        },
        {
            id: 'session_duration',
            type: 'single_choice',
            label: 'Quanto tempo você consegue ficar na academia por sessão?',
            required: true,
            options: [
                { value: '30_40', label: '30 a 40 minutos' },
                { value: '40_50', label: '40 a 50 minutos' },
                { value: '50_60', label: '50 a 60 minutos' },
                { value: '60_75', label: '60 a 75 minutos' },
                { value: '75_90', label: '75 a 90 minutos' },
            ],
        },
        {
            id: 'previous_experience',
            type: 'long_text',
            label: 'Você já fez algum programa de treino antes? Como foi a experiência?',
            required: false,
            placeholder: 'Conte como foi — o que funcionou, o que não deu certo, por que parou (se parou)...',
        },

        // ─────────────────────────────────────────────
        // SEÇÃO 2 — Objetivos e Motivação
        // ─────────────────────────────────────────────
        {
            id: 'primary_goal',
            type: 'single_choice',
            label: 'Qual seu principal objetivo com o treino?',
            required: true,
            options: [
                { value: 'hypertrophy', label: 'Ganhar massa muscular (hipertrofia)' },
                { value: 'weight_loss', label: 'Perder gordura / emagrecer' },
                { value: 'health', label: 'Melhorar saúde geral e qualidade de vida' },
                { value: 'rehab', label: 'Reduzir dor ou reabilitar uma lesão' },
                { value: 'performance', label: 'Melhorar performance esportiva' },
            ],
        },
        {
            id: 'muscle_emphasis',
            type: 'multi_choice',
            label: 'Tem algum grupo muscular que gostaria de dar mais atenção?',
            required: false,
            options: [
                { value: 'gluteo', label: 'Glúteo' },
                { value: 'peito', label: 'Peito' },
                { value: 'costas', label: 'Costas' },
                { value: 'ombros', label: 'Ombros' },
                { value: 'bracos', label: 'Braços (Bíceps e Tríceps)' },
                { value: 'pernas', label: 'Pernas (Quadríceps e Posterior)' },
                { value: 'equilibrado', label: 'Sem preferência — distribuição equilibrada' },
            ],
        },
        {
            id: 'motivation',
            type: 'single_choice',
            label: 'O que mais te motiva a treinar?',
            required: false,
            options: [
                { value: 'estetico', label: 'Ver resultado estético (corpo)' },
                { value: 'forca', label: 'Sentir-me mais forte' },
                { value: 'saude', label: 'Melhorar minha saúde' },
                { value: 'energia', label: 'Ter mais energia no dia a dia' },
                { value: 'estresse', label: 'Aliviar estresse' },
                { value: 'outro', label: 'Outro' },
            ],
        },

        // ─────────────────────────────────────────────
        // SEÇÃO 3 — Lesões e Limitações
        // ─────────────────────────────────────────────
        {
            id: 'has_injury',
            type: 'single_choice',
            label: 'Você possui alguma lesão, dor ou limitação física atualmente?',
            required: true,
            options: [
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
            ],
        },
        {
            id: 'injury_description',
            type: 'long_text',
            label: 'Descreva sua lesão ou limitação. Seja o mais detalhista possível.',
            required: false,
            placeholder: 'Ex: Dor no joelho direito ao agachar além de 90°, hérnia de disco L4-L5, tendinite no ombro esquerdo...',
        },
        {
            id: 'painful_activities',
            type: 'multi_choice',
            label: 'Quais atividades causam dor ou desconforto?',
            required: false,
            options: [
                { value: 'agachar', label: 'Agachar' },
                { value: 'escadas', label: 'Subir escadas' },
                { value: 'correr', label: 'Correr' },
                { value: 'acima_cabeca', label: 'Levantar peso acima da cabeça' },
                { value: 'empurrar', label: 'Empurrar (movimento de supino)' },
                { value: 'puxar', label: 'Puxar' },
                { value: 'sentado', label: 'Ficar muito tempo sentado' },
                { value: 'caminhar', label: 'Caminhar' },
                { value: 'nenhuma', label: 'Nenhuma das anteriores' },
            ],
        },
        {
            id: 'medical_followup',
            type: 'single_choice',
            label: 'Você está em acompanhamento com fisioterapeuta ou médico por essa condição?',
            required: false,
            options: [
                { value: 'ativo', label: 'Sim, estou em acompanhamento ativo' },
                { value: 'anterior', label: 'Já fiz acompanhamento, mas não estou mais' },
                { value: 'nao', label: 'Não' },
            ],
        },

        // ─────────────────────────────────────────────
        // SEÇÃO 4 — Preferências de Treino
        // ─────────────────────────────────────────────
        {
            id: 'favorite_exercises',
            type: 'long_text',
            label: 'Tem algum exercício que você GOSTA muito e gostaria de manter no programa?',
            required: false,
            placeholder: 'Ex: adoro supino, gosto de hip thrust, curto fazer prancha...',
        },
        {
            id: 'disliked_exercises',
            type: 'long_text',
            label: 'Tem algum exercício que você NÃO GOSTA ou prefere evitar?',
            required: false,
            placeholder: 'Ex: não gosto de leg press, odeio burpee, não curto exercício com barra...',
        },
        {
            id: 'training_style',
            type: 'multi_choice',
            label: 'Como você prefere seus treinos?',
            required: false,
            options: [
                { value: 'pesado', label: 'Poucos exercícios mas pesados' },
                { value: 'moderado', label: 'Muitos exercícios com carga moderada' },
                { value: 'variado', label: 'Variado a cada sessão' },
                { value: 'fixo', label: 'Rotina fixa que eu decore fácil' },
                { value: 'com_cardio', label: 'Com bastante cardio junto' },
                { value: 'sem_cardio', label: 'Só musculação, sem cardio' },
            ],
        },
        {
            id: 'warmup_preference',
            type: 'single_choice',
            label: 'Como você prefere aquecer antes do treino?',
            required: false,
            options: [
                { value: 'structured', label: 'Quero um aquecimento estruturado no programa' },
                { value: 'own', label: 'Já tenho meu próprio aquecimento' },
                { value: 'none', label: 'Não costumo aquecer' },
            ],
        },
        {
            id: 'cardio_preference',
            type: 'single_choice',
            label: 'Deseja incluir exercício aeróbio no programa?',
            required: false,
            options: [
                { value: 'yes_continuous', label: 'Sim, cardio contínuo (esteira, bike, etc.)' },
                { value: 'yes_hiit', label: 'Sim, intervalado/HIIT' },
                { value: 'yes_both', label: 'Sim, ambos' },
                { value: 'no', label: 'Não, apenas musculação' },
            ],
        },

        // ─────────────────────────────────────────────
        // SEÇÃO 5 — Contexto de Vida
        // ─────────────────────────────────────────────
        {
            id: 'training_environment',
            type: 'single_choice',
            label: 'Qual é o seu ambiente de treino?',
            required: true,
            options: [
                { value: 'academia_completa', label: 'Academia completa' },
                { value: 'home_gym_completo', label: 'Home gym completo (barra, halteres, polia)' },
                { value: 'home_gym_basico', label: 'Home gym básico (halteres, banco)' },
                { value: 'ao_ar_livre', label: 'Ao ar livre' },
                { value: 'apenas_peso_corporal', label: 'Apenas peso corporal' },
            ],
        },
        {
            id: 'activity_level',
            type: 'single_choice',
            label: 'Qual seu nível de atividade fora da academia?',
            required: true,
            options: [
                { value: 'sedentario', label: 'Sedentário (trabalho sentado, pouco movimento)' },
                { value: 'moderado', label: 'Moderado (caminho bastante, trabalho em pé)' },
                { value: 'ativo', label: 'Ativo (trabalho físico ou pratico outro esporte)' },
            ],
        },
        {
            id: 'additional_info',
            type: 'long_text',
            label: 'Tem algo mais que gostaria que seu treinador soubesse antes de montar seu programa?',
            required: false,
            placeholder: 'Qualquer informação que ache relevante...',
        },
    ],
}

// ============================================================================
// Template Metadata
// ============================================================================

export const PRESCRIPTION_QUESTIONNAIRE_TEMPLATE = {
    title: 'Questionário de Prescrição',
    description: 'Suas respostas ajudam a criar um programa de treino personalizado e seguro. Leva cerca de 5 minutos.',
    category: 'anamnese' as const,
    is_default_for_new_students: false,
    created_source: 'manual' as const,
}
