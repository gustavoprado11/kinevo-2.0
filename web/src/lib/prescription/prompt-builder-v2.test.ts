import { describe, it, expect } from 'vitest'
import { buildSmartV2Prompt } from './prompt-builder-v2'
import type { PrescriptionExerciseRef, StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'
import type { EnrichedStudentContextV2 } from './context-enricher-v2'

function ex(id: string, name: string, groups: string[], compound: boolean): PrescriptionExerciseRef {
    return {
        id, name,
        muscle_group_names: groups,
        equipment: 'barbell',
        is_compound: compound,
        difficulty_level: 'intermediate',
        is_primary_movement: compound,
        session_position: 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
    }
}

const profile: StudentPrescriptionProfile = {
    id: 'p', student_id: 's', trainer_id: 't',
    training_level: 'intermediate', goal: 'hypertrophy',
    available_days: [1, 3, 5], session_duration_minutes: 60,
    available_equipment: ['academia_completa'],
    favorite_exercise_ids: [], disliked_exercise_ids: [],
    medical_restrictions: [], ai_mode: 'auto',
    cycle_observation: null, adherence_rate: null,
    avg_session_duration_minutes: null, last_calculated_at: null,
    created_at: '', updated_at: '',
}

const baseContext: EnrichedStudentContextV2 = {
    student_name: 'Carlos',
    previous_programs: [],
    load_progression: [],
    session_patterns: {
        preferred_days: [],
        avg_session_duration_minutes: null,
        dropout_rate_by_workout: {},
        total_sessions_4w: 0,
        completed_sessions_4w: 0,
    },
    previous_exercise_ids: [],
    anamnese_summary: 'summary-v1',
    performance_summary: { stagnated_exercises: [], progressing_well: [], last_session_dates: [] },
    adherence: { rate_last_4_weeks: 0, bucket: 'baixa' },
    trainer_observations: [],
    active_injuries: [],
    equipment_preference: 'academia_completa',
    is_new_student: true,
}

const pool = [
    ex('ex-001', 'Supino Reto', ['Peito'], true),
    ex('ex-002', 'Agachamento Livre', ['Quadríceps'], true),
    ex('ex-003', 'Rosca Direta', ['Bíceps'], false),
]

describe('buildSmartV2Prompt', () => {
    it('is deterministic for the same inputs', () => {
        const a = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        const b = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        expect(a.system).toBe(b.system)
        expect(a.user).toBe(b.user)
        expect(a.pool_version).toBe(b.pool_version)
    })

    it('system prompt is invariant to changes in Layer 3 context', () => {
        const baseline = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        const changed = buildSmartV2Prompt({
            trainerId: 't1', exercises: pool, profile,
            context: {
                ...baseContext,
                anamnese_summary: 'COMPLETELY DIFFERENT SUMMARY',
                adherence: { rate_last_4_weeks: 99, bucket: 'excelente' },
                is_new_student: false,
            },
        })
        expect(changed.system).toBe(baseline.system)
        expect(changed.user).not.toBe(baseline.user)
    })

    it('pool_version changes when the exercise pool changes', () => {
        const withOriginal = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        const extended = [...pool, ex('ex-004', 'Stiff', ['Posterior de Coxa'], true)]
        const withExtra = buildSmartV2Prompt({ trainerId: 't1', exercises: extended, profile, context: baseContext })
        expect(withExtra.pool_version).not.toBe(withOriginal.pool_version)
        // System differs because Layer 2 includes the new exercise.
        expect(withExtra.system).not.toBe(withOriginal.system)
    })

    it('pool_version is salted by trainerId', () => {
        const a = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        const b = buildSmartV2Prompt({ trainerId: 't2', exercises: pool, profile, context: baseContext })
        expect(a.pool_version).not.toBe(b.pool_version)
    })

    it('user layer calls out new-student signal explicitly', () => {
        const prompt = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        expect(prompt.user).toContain('Aluno novo sem histórico')
    })

    it('stamps the current PROMPT_VERSION', () => {
        const prompt = buildSmartV2Prompt({ trainerId: 't1', exercises: pool, profile, context: baseContext })
        expect(prompt.prompt_version).toBe('v2.5.0')
    })
})
