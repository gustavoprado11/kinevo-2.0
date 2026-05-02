import { describe, it, expect } from 'vitest'

import type {
    StudentPrescriptionProfile,
    PrescriptionGoal,
    TrainingLevel,
    AiMode,
} from '@kinevo/shared/types/prescription'

import { selectConditionalQuestions } from './question-engine'
import type { EnrichedStudentContext } from './context-enricher'
import type { VolumeTradeoffInfo } from './constraints-engine'

// ============================================================================
// Fixtures
// ============================================================================

function makeProfile(overrides: Partial<StudentPrescriptionProfile> = {}): StudentPrescriptionProfile {
    return {
        id: 'p1',
        student_id: 's1',
        trainer_id: 't1',
        training_level: 'intermediate' as TrainingLevel,
        goal: 'hypertrophy' as PrescriptionGoal,
        available_days: [1, 2, 4, 5],
        session_duration_minutes: 60,
        available_equipment: ['academia_completa'],
        favorite_exercise_ids: [],
        disliked_exercise_ids: [],
        medical_restrictions: [],
        ai_mode: 'copilot' as AiMode,
        cycle_observation: null,
        adherence_rate: null,
        avg_session_duration_minutes: null,
        last_calculated_at: null,
        created_at: '',
        updated_at: '',
        ...overrides,
    }
}

function makeContext(overrides: Partial<EnrichedStudentContext> = {}): EnrichedStudentContext {
    return {
        student_name: 'Aluno Teste',
        previous_programs: [],
        load_progression: [],
        session_patterns: {
            preferred_days: [1, 3, 5],
            avg_session_duration_minutes: 60,
            dropout_rate_by_workout: {},
            total_sessions_4w: 12,
            completed_sessions_4w: 12,  // 100% adherence by default
        },
        previous_exercise_ids: [],
        ...overrides,
    }
}

// ============================================================================
// Tests for new performance-based questions
// ============================================================================

describe('selectConditionalQuestions — stagnation_focus (Phase 4)', () => {
    it('does not fire when no stalled exercises exist', () => {
        const profile = makeProfile()
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'progressing', weeks_at_current: 2, last_weight: 60 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'stagnation_focus')).toBe(false)
    })

    it('does not fire when only 1 stalled exercise (threshold is >=2)', () => {
        const profile = makeProfile()
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'stalled', weeks_at_current: 4, last_weight: 60 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'stagnation_focus')).toBe(false)
    })

    it('fires when 2+ exercises stagnated for 3+ weeks and lists them in context', () => {
        const profile = makeProfile()
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino Reto', trend: 'stalled', weeks_at_current: 4, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada Curvada', trend: 'stalled', weeks_at_current: 5, last_weight: 50 },
                { exercise_id: 'e3', exercise_name: 'Agachamento', trend: 'progressing', weeks_at_current: 2, last_weight: 100 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        const q = out.find(question => question.id === 'stagnation_focus')
        expect(q).toBeDefined()
        expect(q!.context).toContain('Supino Reto')
        expect(q!.context).toContain('Remada Curvada')
        expect(q!.context).not.toContain('Agachamento')  // not stalled
        expect(q!.options?.length).toBeGreaterThanOrEqual(3)
    })

    it('ignores stalled exercises with weeks_at_current < 3', () => {
        const profile = makeProfile()
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'stalled', weeks_at_current: 2, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada', trend: 'stalled', weeks_at_current: 1, last_weight: 50 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'stagnation_focus')).toBe(false)
    })
})

describe('selectConditionalQuestions — program_variability (Phase 4)', () => {
    it('does not fire when student has fewer than 2 previous programs', () => {
        const profile = makeProfile()
        const context = makeContext({
            previous_programs: [
                { name: 'Programa A', duration_weeks: 8, status: 'completed', created_at: '', workouts: [], completion_rate: 0.85 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'program_variability')).toBe(false)
    })

    it('fires after 2+ previous programs, includes last program details', () => {
        const profile = makeProfile()
        const context = makeContext({
            previous_programs: [
                { name: 'Hipertrofia Avançada', duration_weeks: 8, status: 'completed', created_at: '', workouts: [], completion_rate: 0.92 },
                { name: 'Programa Anterior', duration_weeks: 6, status: 'completed', created_at: '', workouts: [], completion_rate: 0.75 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        const q = out.find(question => question.id === 'program_variability')
        expect(q).toBeDefined()
        expect(q!.context).toContain('Hipertrofia Avançada')
        expect(q!.context).toContain('92%')  // completion rate
    })
})

describe('selectConditionalQuestions — progression_focus (Phase 4)', () => {
    it('does not fire for beginner students', () => {
        const profile = makeProfile({ training_level: 'beginner' })
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'progressing', weeks_at_current: 4, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada', trend: 'progressing', weeks_at_current: 3, last_weight: 50 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'progression_focus')).toBe(false)
    })

    it('fires for intermediate+ when 2+ exercises are progressing well', () => {
        const profile = makeProfile({ training_level: 'intermediate' })
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino Reto', trend: 'progressing', weeks_at_current: 4, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada', trend: 'progressing', weeks_at_current: 3, last_weight: 50 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        const q = out.find(question => question.id === 'progression_focus')
        expect(q).toBeDefined()
        expect(q!.context).toContain('Supino Reto')
        expect(q!.context).toContain('Remada')
    })

    it('does not fire when fewer than 2 exercises are progressing', () => {
        const profile = makeProfile({ training_level: 'advanced' })
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'progressing', weeks_at_current: 2, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada', trend: 'stalled', weeks_at_current: 4, last_weight: 50 },
            ],
        })
        const out = selectConditionalQuestions(profile, context)
        expect(out.some(q => q.id === 'progression_focus')).toBe(false)
    })
})

describe('selectConditionalQuestions — priority cap', () => {
    it('respects MAX_QUESTIONS = 3 even when many conditions fire', () => {
        const profile = makeProfile()
        const context = makeContext({
            load_progression: [
                { exercise_id: 'e1', exercise_name: 'Supino', trend: 'stalled', weeks_at_current: 4, last_weight: 60 },
                { exercise_id: 'e2', exercise_name: 'Remada', trend: 'stalled', weeks_at_current: 5, last_weight: 50 },
                { exercise_id: 'e3', exercise_name: 'Agacha', trend: 'progressing', weeks_at_current: 4, last_weight: 100 },
                { exercise_id: 'e4', exercise_name: 'Stiff', trend: 'progressing', weeks_at_current: 3, last_weight: 80 },
            ],
            previous_programs: [
                { name: 'A', duration_weeks: 8, status: 'completed', created_at: '', workouts: [], completion_rate: 0.85 },
                { name: 'B', duration_weeks: 6, status: 'completed', created_at: '', workouts: [], completion_rate: 0.75 },
            ],
            session_patterns: {
                preferred_days: [],
                avg_session_duration_minutes: null,
                dropout_rate_by_workout: {},
                total_sessions_4w: 10,
                completed_sessions_4w: 3,  // 30% — triggers adherence_barrier
            },
        })
        const tradeoff: VolumeTradeoffInfo = {
            needsTradeoff: true,
            scaleFactor: 0.6,
            exercisesPerSession: 5,
            frequency: 4,
            totalWeeklySets: 70,
            totalBudgetMin: 126,
            level: 'intermediate',
        }
        const out = selectConditionalQuestions(profile, context, tradeoff)
        // Hard cap — never more than 3
        expect(out.length).toBeLessThanOrEqual(3)
        // P0 (volume_tradeoff) and P3 (adherence_barrier) outrank the new
        // P3.5/3.6/3.7 questions, so those higher-priority ones should win.
        expect(out.some(q => q.id === 'volume_tradeoff')).toBe(true)
    })
})
