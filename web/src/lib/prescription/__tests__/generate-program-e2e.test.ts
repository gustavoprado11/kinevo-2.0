// ============================================================================
// Kinevo Prescription Engine — E2E Test (no DB, no auth)
// ============================================================================
// Tests the full generation pipeline: profile → validateInput → AI/heuristic →
// validateOutput → fixViolations → output snapshot.

import { describe, it, expect } from 'vitest'

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionInputSnapshot,
    PrescriptionPerformanceContext,
    PrescriptionOutputSnapshot,
} from '@kinevo/shared/types/prescription'

import { validateInput, validateOutput, fixViolations, resolveAiMode } from '../rules-engine'
import { buildHeuristicProgram } from '../program-builder'
import { buildPromptPair, parseAiResponse } from '../prompt-builder'
import { ENGINE_VERSION } from '../constants'

// ============================================================================
// Fixtures — using EXACT DB muscle group names
// ============================================================================

function makeProfile(overrides: Partial<StudentPrescriptionProfile> = {}): StudentPrescriptionProfile {
    return {
        id: 'profile-1',
        student_id: 'student-1',
        trainer_id: 'trainer-1',
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 3, 5],
        session_duration_minutes: 60,
        available_equipment: ['academia_completa'],
        favorite_exercise_ids: [],
        disliked_exercise_ids: [],
        medical_restrictions: [],
        ai_mode: 'copilot',
        adherence_rate: null,
        avg_session_duration_minutes: null,
        last_calculated_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

function makeExercise(overrides: Partial<PrescriptionExerciseRef> = {}): PrescriptionExerciseRef {
    return {
        id: `ex-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Exercício Genérico',
        muscle_group_names: ['Peito'],
        equipment: null,
        is_compound: false,
        difficulty_level: 'intermediate',
        is_primary_movement: false,
        session_position: 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate' as const,
        prescription_notes: null,
        ...overrides,
    }
}

function makeExerciseLibrary(): PrescriptionExerciseRef[] {
    return [
        // === Primary groups: Compounds ===
        makeExercise({ id: 'supino-reto', name: 'Supino Reto', muscle_group_names: ['Peito'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'supino-inclinado', name: 'Supino Inclinado', muscle_group_names: ['Peito'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'remada-curvada', name: 'Remada Curvada', muscle_group_names: ['Costas'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'puxada-frontal', name: 'Puxada Frontal', muscle_group_names: ['Costas'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'agachamento-livre', name: 'Agachamento Livre', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'leg-press', name: 'Leg Press', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'desenvolvimento', name: 'Desenvolvimento com Halteres', muscle_group_names: ['Ombros'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'hip-thrust', name: 'Hip Thrust', muscle_group_names: ['Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'stiff', name: 'Stiff', muscle_group_names: ['Posterior de Coxa', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'passada', name: 'Passada com Halteres', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),

        // === Primary groups: Isolations ===
        makeExercise({ id: 'crucifixo', name: 'Crucifixo', muscle_group_names: ['Peito'], is_compound: false }),
        makeExercise({ id: 'pullover', name: 'Pullover', muscle_group_names: ['Costas'], is_compound: false }),
        makeExercise({ id: 'cadeira-ext', name: 'Cadeira Extensora', muscle_group_names: ['Quadríceps'], is_compound: false }),
        makeExercise({ id: 'mesa-flexora', name: 'Mesa Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false }),
        makeExercise({ id: 'elevacao-lateral', name: 'Elevação Lateral', muscle_group_names: ['Ombros'], is_compound: false }),
        makeExercise({ id: 'gluteo-maquina', name: 'Glúteo na Máquina', muscle_group_names: ['Glúteo'], is_compound: false }),

        // === Small groups ===
        makeExercise({ id: 'rosca-direta', name: 'Rosca Direta', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-pulley', name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'abdominal', name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'panturrilha', name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'trapezio-encolhimento', name: 'Encolhimento com Barra', muscle_group_names: ['Trapézio'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
    ]
}

// ============================================================================
// Tests
// ============================================================================

describe('Full Pipeline — Beginner 3x/week Heuristic', () => {
    const profile = makeProfile({
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 3, 5],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))

    it('resolves AI mode to auto', () => {
        expect(resolveAiMode(profile, null)).toBe('auto')
    })

    it('input validation passes', () => {
        expect(validateInput(profile, exercises).valid).toBe(true)
    })

    it('input snapshot has engine version', () => {
        const inputSnapshot: PrescriptionInputSnapshot = {
            profile: {
                student_id: profile.student_id,
                training_level: profile.training_level,
                goal: profile.goal,
                available_days: profile.available_days,
                session_duration_minutes: profile.session_duration_minutes,
                available_equipment: profile.available_equipment,
                favorite_exercise_ids: profile.favorite_exercise_ids,
                disliked_exercise_ids: profile.disliked_exercise_ids,
                medical_restrictions: profile.medical_restrictions,
                ai_mode: profile.ai_mode,
                adherence_rate: profile.adherence_rate,
            },
            available_exercises: exercises,
            performance_context: null,
            engine_version: ENGINE_VERSION,
        }
        expect(inputSnapshot.engine_version).toBe('1.0.0')
    })

    it('generates 3 workouts with 4-week duration', () => {
        const output = buildHeuristicProgram(profile, exercises)
        expect(output.workouts.length).toBe(3)
        expect(output.program.duration_weeks).toBe(4)
    })

    it('output passes validation', () => {
        const output = buildHeuristicProgram(profile, exercises)
        const validation = validateOutput(output, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)
    })

    it('all items have required snapshot fields', () => {
        const output = buildHeuristicProgram(profile, exercises)
        for (const workout of output.workouts) {
            for (const item of workout.items) {
                expect(item.exercise_name).toBeTruthy()
                expect(item.exercise_muscle_group).toBeTruthy()
                expect(item.sets).toBeGreaterThanOrEqual(1)
                expect(item.reps).toBeTruthy()
                expect(item.rest_seconds).toBeGreaterThan(0)
            }
        }
    })

    it('has reasoning with structure_rationale and confidence', () => {
        const output = buildHeuristicProgram(profile, exercises)
        expect(output.reasoning.structure_rationale).toBeTruthy()
        expect(output.reasoning.confidence_score).toBeGreaterThan(0)
    })
})

describe('Prompt Builder', () => {
    const profile = makeProfile()
    const exercises = makeExerciseLibrary()

    it('system prompt has required sections', () => {
        const { system } = buildPromptPair(profile, exercises, null)
        expect(system).toContain('# PAPEL')
        expect(system).toContain('# METODOLOGIA KINEVO')
        expect(system).toContain('# RESTRIÇÕES ABSOLUTAS')
        expect(system).toContain('# FORMATO DE SAÍDA')
        expect(system).toContain('# REGRAS DE RESPOSTA')
        expect(system).toContain('10–12')
        expect(system).toContain('Bíceps')
    })

    it('user prompt is valid JSON with correct structure', () => {
        const { user } = buildPromptPair(profile, exercises, null)
        const parsed = JSON.parse(user)
        expect(parsed.student_profile.training_level).toBe('beginner')
        expect(Array.isArray(parsed.available_exercises)).toBe(true)
        expect(parsed.available_exercises.length).toBe(exercises.length)
    })
})

describe('parseAiResponse', () => {
    it('parses valid JSON response', () => {
        const validJson = JSON.stringify({
            program: { name: 'Test', description: 'Desc', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1],
                items: [{
                    exercise_id: 'supino-reto',
                    exercise_name: 'Supino Reto',
                    exercise_muscle_group: 'Peito',
                    exercise_equipment: null,
                    sets: 3,
                    reps: '8-12',
                    rest_seconds: 90,
                    notes: null,
                    substitute_exercise_ids: [],
                    order_index: 0,
                }],
            }],
            reasoning: {
                structure_rationale: 'Full body',
                volume_rationale: 'Min volume',
                workout_notes: ['Treino A: 1 exercício'],
                attention_flags: [],
                confidence_score: 0.85,
            },
        })

        const parsed = parseAiResponse(validJson)
        expect(parsed).not.toBeNull()
        expect(parsed!.workouts[0].items[0].exercise_id).toBe('supino-reto')
        expect(parsed!.reasoning.confidence_score).toBe(0.85)
    })

    it('returns null for missing workouts', () => {
        expect(parseAiResponse(JSON.stringify({ program: { name: 'X' } }))).toBeNull()
    })

    it('returns null for non-JSON', () => {
        expect(parseAiResponse('not json at all')).toBeNull()
    })

    it('returns null for missing exercise_id', () => {
        const json = JSON.stringify({
            program: { name: 'X', description: '', duration_weeks: 4 },
            workouts: [{ name: 'A', items: [{ sets: 3, reps: '8-12' }] }],
            reasoning: { structure_rationale: '', volume_rationale: '', workout_notes: [], attention_flags: [], confidence_score: 0.5 },
        })
        expect(parseAiResponse(json)).toBeNull()
    })
})

describe('Full Pipeline — Intermediate 4x/week', () => {
    it('generates valid 4-workout program', () => {
        const profile = makeProfile({
            training_level: 'intermediate',
            goal: 'weight_loss',
            available_days: [1, 2, 4, 5],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = new Map(exercises.map(e => [e.id, e]))
        const perfCtx: PrescriptionPerformanceContext = {
            weeks_of_history: 8,
            recent_adherence_rate: 90,
            recent_avg_rpe: 7.5,
            stalled_exercise_ids: [],
            previous_program: null,
        }

        expect(resolveAiMode(profile, perfCtx)).toBe('copilot')

        const output = buildHeuristicProgram(profile, exercises)
        expect(output.workouts.length).toBe(4)

        const validation = validateOutput(output, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)
    })
})

describe('Full Pipeline — Beginner 5x/week PPL+', () => {
    it('generates valid 5-workout PPL+ program', () => {
        const profile = makeProfile({
            training_level: 'beginner',
            goal: 'hypertrophy',
            available_days: [1, 2, 3, 5, 6],
            session_duration_minutes: 60,
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = new Map(exercises.map(e => [e.id, e]))

        const output = buildHeuristicProgram(profile, exercises)

        expect(output.workouts.length).toBe(5)

        for (const w of output.workouts) {
            expect(w.items.length).toBeGreaterThanOrEqual(4)
            expect(w.items.length).toBeLessThanOrEqual(6)

            const hasCompound = w.items.some(i => exerciseMap.get(i.exercise_id!)?.is_compound === true)
            expect(hasCompound).toBe(true)
        }

        const validation = validateOutput(output, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)

        const musclesByWorkout = output.workouts.map(w => ({
            name: w.name,
            groups: [...new Set(w.items.map(i => i.exercise_muscle_group))],
        }))
        expect(musclesByWorkout.some(w => w.groups.includes('Quadríceps'))).toBe(true)
        expect(musclesByWorkout.some(w => w.groups.includes('Posterior de Coxa') || w.groups.includes('Glúteo'))).toBe(true)
    })
})
