/**
 * Test fixtures for prescription outputs. Keep minimal — add fields only
 * when a test needs them so schema drift stays noisy.
 */
import type {
    PrescriptionOutputSnapshot,
    StudentPrescriptionProfile,
    PrescriptionAgentQuestion,
    PrescriptionAgentState,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'

export const fixtureOutputSnapshot: PrescriptionOutputSnapshot = {
    program: {
        name: 'Programa teste',
        description: 'Programa gerado para testes',
        duration_weeks: 4,
    },
    workouts: [
        {
            name: 'Treino A — Peito e Tríceps',
            order_index: 0,
            scheduled_days: [1, 4],
            items: [
                {
                    item_type: 'exercise',
                    exercise_id: 'fixture-ex-1',
                    exercise_name: 'Supino Reto',
                    exercise_muscle_group: 'Peito',
                    exercise_equipment: 'barbell',
                    sets: 4,
                    reps: '8-10',
                    rest_seconds: 90,
                    notes: null,
                    substitute_exercise_ids: [],
                    order_index: 0,
                },
            ],
        },
    ],
    reasoning: {
        structure_rationale: 'Split push/pull adequado ao tempo disponível.',
        volume_rationale: 'Volume ajustado por aderência.',
        workout_notes: ['Foco em compostos.'],
        attention_flags: [],
        confidence_score: 0.8,
    },
}

export const fixtureProfile: StudentPrescriptionProfile = {
    id: 'fixture-profile-id',
    student_id: 'fixture-student-id',
    trainer_id: 'fixture-trainer-id',
    training_level: 'intermediate',
    goal: 'hypertrophy',
    available_days: [1, 3, 5],
    session_duration_minutes: 60,
    available_equipment: ['academia_completa'],
    favorite_exercise_ids: [],
    disliked_exercise_ids: [],
    medical_restrictions: [],
    ai_mode: 'auto',
    cycle_observation: null,
    adherence_rate: null,
    avg_session_duration_minutes: null,
    last_calculated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

export const fixtureAnalysis: PrescriptionContextAnalysis = {
    student_summary: 'Aluno intermediário sem restrições.',
    identified_gaps: [],
    web_search_insights: [],
    web_search_queries: [],
}

export const fixtureQuestion: PrescriptionAgentQuestion = {
    id: 'equipment',
    question: 'Qual equipamento está disponível?',
    context: 'Precisamos saber que exercícios podem ser usados.',
    options: ['Academia completa', 'Home gym básico'],
    type: 'single_choice',
}

export const fixtureAgentState: PrescriptionAgentState = {
    conversation_messages: [],
    context_analysis: fixtureAnalysis,
    questions: [fixtureQuestion],
    answers: [],
    phase: 'questions',
}
