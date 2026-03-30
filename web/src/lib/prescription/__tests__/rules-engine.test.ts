// ============================================================================
// Kinevo Prescription Engine — Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest'

import {
    validateInput,
    validateOutput,
    fixViolations,
    resolveAiMode,
    computeWeeklyVolumePerMuscle,
} from '../rules-engine'

import { buildHeuristicProgram } from '../program-builder'
import { calcExercisesPerWorkout } from '../constants'

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    PrescriptionPerformanceContext,
} from '@kinevo/shared/types/prescription'

import { VOLUME_RANGES } from '@kinevo/shared/types/prescription'

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
        available_days: [1, 3, 5], // Mon, Wed, Fri
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
        makeExercise({ id: 'rosca-alternada', name: 'Rosca Alternada', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'rosca-martelo', name: 'Rosca Martelo', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-pulley', name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-testa', name: 'Tríceps Testa', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-corda', name: 'Tríceps Corda', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'abdominal', name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'panturrilha', name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'trapezio-encolhimento', name: 'Encolhimento com Barra', muscle_group_names: ['Trapézio'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
    ]
}

function makeExerciseMap(exercises: PrescriptionExerciseRef[]): Map<string, PrescriptionExerciseRef> {
    return new Map(exercises.map(e => [e.id, e]))
}

// ============================================================================
// Tests
// ============================================================================

describe('validateInput', () => {
    it('valid profile + exercises passes', () => {
        const result = validateInput(makeProfile(), makeExerciseLibrary())
        expect(result.valid).toBe(true)
    })

    it('empty available_days fails', () => {
        const result = validateInput(makeProfile({ available_days: [] }), makeExerciseLibrary())
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.includes('pelo menos 1 dia'))).toBe(true)
    })

    it('empty exercise library fails', () => {
        const result = validateInput(makeProfile(), [])
        expect(result.valid).toBe(false)
    })

    it('no compound exercises fails', () => {
        const result = validateInput(makeProfile(), [makeExercise({ is_compound: false })])
        expect(result.valid).toBe(false)
    })
})

describe('validateOutput — Volume', () => {
    it('volume exceeding max for primary group triggers error', () => {
        const profile = makeProfile({ training_level: 'beginner' })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const overVolume: PrescriptionOutputSnapshot = {
            program: { name: 'Test', description: 'Test', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5],
                items: [{
                    exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                    exercise_muscle_group: 'Peito', exercise_equipment: null,
                    sets: 5, reps: '8-12', rest_seconds: 90, notes: null,
                    substitute_exercise_ids: [], order_index: 0,
                }],
            }],
            reasoning: {
                structure_rationale: '', volume_rationale: '',
                workout_notes: [], attention_flags: [], confidence_score: 0.8,
            },
        }

        // 5 sets × 3 days = 15 weekly sets for Peito. Beginner max = 12.
        const result = validateOutput(overVolume, profile, exerciseMap)
        expect(result.hasErrors).toBe(true)
        const volumeViolation = result.violations.find(v => v.rule_id === 'volume_exceeds_max')
        expect(volumeViolation).toBeDefined()
        expect(volumeViolation!.context.muscle_group).toBe('Peito')
        expect(volumeViolation!.context.actual_value).toBe(15)
    })

    it('small group high volume does NOT trigger volume_exceeds_max', () => {
        const profile = makeProfile({ training_level: 'beginner' })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const smallGroupHighVolume: PrescriptionOutputSnapshot = {
            program: { name: 'Test', description: 'Test', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5],
                items: [
                    {
                        exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                        exercise_muscle_group: 'Peito', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'rosca-direta', exercise_name: 'Rosca Direta',
                        exercise_muscle_group: 'Bíceps', exercise_equipment: null,
                        sets: 5, reps: '10-15', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            }],
            reasoning: {
                structure_rationale: '', volume_rationale: '',
                workout_notes: [], attention_flags: [], confidence_score: 0.8,
            },
        }

        const result = validateOutput(smallGroupHighVolume, profile, exerciseMap)
        const volumeViolation = result.violations.find(v => v.rule_id === 'volume_exceeds_max' && v.context.muscle_group === 'Bíceps')
        expect(volumeViolation).toBeUndefined()
    })
})

describe('validateOutput — Medical Restriction', () => {
    it('restricted exercise in program triggers error', () => {
        const profile = makeProfile({
            medical_restrictions: [{
                description: 'Dor no joelho',
                restricted_exercise_ids: ['leg-press'],
                restricted_muscle_groups: [],
                severity: 'moderate',
            }],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const withRestricted: PrescriptionOutputSnapshot = {
            program: { name: 'Test', description: 'Test', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1],
                items: [
                    {
                        exercise_id: 'agachamento-livre', exercise_name: 'Agachamento Livre',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'leg-press', exercise_name: 'Leg Press',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            }],
            reasoning: {
                structure_rationale: '', volume_rationale: '',
                workout_notes: [], attention_flags: [], confidence_score: 0.8,
            },
        }

        const result = validateOutput(withRestricted, profile, exerciseMap)
        expect(result.hasErrors).toBe(true)
        const restrictedV = result.violations.find(v => v.rule_id === 'restricted_exercise')
        expect(restrictedV).toBeDefined()
        expect(restrictedV!.context.exercise_id).toBe('leg-press')
    })
})

describe('fixViolations', () => {
    it('removes restricted exercise', () => {
        const profile = makeProfile({
            medical_restrictions: [{
                description: 'Dor no joelho',
                restricted_exercise_ids: ['leg-press'],
                restricted_muscle_groups: [],
                severity: 'moderate',
            }],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const withRestricted: PrescriptionOutputSnapshot = {
            program: { name: 'Test', description: 'Test', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1],
                items: [
                    {
                        exercise_id: 'agachamento-livre', exercise_name: 'Agachamento Livre',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'leg-press', exercise_name: 'Leg Press',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            }],
            reasoning: {
                structure_rationale: '', volume_rationale: '',
                workout_notes: [], attention_flags: [], confidence_score: 0.8,
            },
        }

        const violations = validateOutput(withRestricted, profile, exerciseMap).violations
        const restrictedViolations = violations.filter(v => v.rule_id === 'restricted_exercise')
        const fixResult = fixViolations(withRestricted, restrictedViolations, exerciseMap)

        expect(fixResult.appliedFixes.length).toBeGreaterThan(0)
        expect(fixResult.appliedFixes[0].auto_fixed).toBe(true)

        const remainingItems = fixResult.fixed.workouts[0].items
        expect(remainingItems.some(i => i.exercise_id === 'leg-press')).toBe(false)
        expect(remainingItems.length).toBe(1)
    })

    it('reduces volume when exceeding max', () => {
        const profile = makeProfile({ training_level: 'beginner' })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const overVolume: PrescriptionOutputSnapshot = {
            program: { name: 'Test', description: 'Test', duration_weeks: 4 },
            workouts: [{
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5],
                items: [{
                    exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                    exercise_muscle_group: 'Peito', exercise_equipment: null,
                    sets: 5, reps: '8-12', rest_seconds: 90, notes: null,
                    substitute_exercise_ids: [], order_index: 0,
                }],
            }],
            reasoning: {
                structure_rationale: '', volume_rationale: '',
                workout_notes: [], attention_flags: [], confidence_score: 0.8,
            },
        }

        const violations = validateOutput(overVolume, profile, exerciseMap).violations
        const volumeViolation = violations.filter(v => v.rule_id === 'volume_exceeds_max')
        expect(volumeViolation.length).toBe(1)

        const fixResult = fixViolations(overVolume, volumeViolation, exerciseMap)
        expect(fixResult.appliedFixes.length).toBe(1)

        const newVolume = computeWeeklyVolumePerMuscle(fixResult.fixed.workouts)
        const maxBeginner = VOLUME_RANGES.beginner.max
        expect(newVolume['Peito'] || 0).toBeLessThanOrEqual(maxBeginner)
    })
})

describe('resolveAiMode', () => {
    it('beginner → auto', () => {
        expect(resolveAiMode(makeProfile({ training_level: 'beginner' }), null)).toBe('auto')
    })

    it('advanced → assistant', () => {
        expect(resolveAiMode(makeProfile({ training_level: 'advanced' }), null)).toBe('assistant')
    })

    it('intermediate + 8 weeks history → copilot', () => {
        const perfCtx: PrescriptionPerformanceContext = {
            weeks_of_history: 8,
            recent_adherence_rate: 85,
            recent_avg_rpe: 7,
            stalled_exercise_ids: [],
            previous_program: null,
        }
        expect(resolveAiMode(makeProfile({ training_level: 'intermediate' }), perfCtx)).toBe('copilot')
    })

    it('intermediate + no history → auto', () => {
        expect(resolveAiMode(makeProfile({ training_level: 'intermediate' }), null)).toBe('auto')
    })

    it('severe restriction → assistant (overrides beginner)', () => {
        const profile = makeProfile({
            training_level: 'beginner',
            medical_restrictions: [{
                description: 'Hérnia de disco',
                restricted_exercise_ids: [],
                restricted_muscle_groups: ['Lombar'],
                severity: 'severe',
            }],
        })
        expect(resolveAiMode(profile, null)).toBe('assistant')
    })
})

describe('buildHeuristicProgram', () => {
    it('beginner 3x/week generates valid program', () => {
        const profile = makeProfile({
            training_level: 'beginner',
            goal: 'hypertrophy',
            available_days: [1, 3, 5],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const program = buildHeuristicProgram(profile, exercises)

        expect(program.workouts.length).toBe(3)
        expect(program.program.duration_weeks).toBe(4)
        expect(program.program.name).toContain('3x/semana')

        const validation = validateOutput(program, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)
    })

    it('intermediate 4x/week generates valid program', () => {
        const profile = makeProfile({
            training_level: 'intermediate',
            goal: 'weight_loss',
            available_days: [1, 2, 4, 5],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const program = buildHeuristicProgram(profile, exercises)

        expect(program.workouts.length).toBe(4)

        const validation = validateOutput(program, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)
    })

    it('beginner 5x/week PPL+ generates valid program', () => {
        const profile = makeProfile({
            training_level: 'beginner',
            goal: 'hypertrophy',
            available_days: [1, 2, 3, 5, 6],
            session_duration_minutes: 60,
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const program = buildHeuristicProgram(profile, exercises)

        expect(program.workouts.length).toBe(5)

        // Each workout should have 4-6 exercises
        for (const w of program.workouts) {
            expect(w.items.length).toBeGreaterThanOrEqual(4)
            expect(w.items.length).toBeLessThanOrEqual(6)
        }

        // No workout should have more than 2 exercises for small groups
        for (const w of program.workouts) {
            const smallGroupCounts: Record<string, number> = {}
            for (const item of w.items) {
                const group = item.exercise_muscle_group!
                if (['Bíceps', 'Tríceps', 'Panturrilha', 'Abdominais', 'Trapézio'].includes(group)) {
                    smallGroupCounts[group] = (smallGroupCounts[group] || 0) + 1
                }
            }
            const maxSmallInWorkout = Math.max(0, ...Object.values(smallGroupCounts))
            expect(maxSmallInWorkout).toBeLessThanOrEqual(2)
        }

        // All workouts should have at least 1 compound
        for (const w of program.workouts) {
            const hasCompound = w.items.some(item => exerciseMap.get(item.exercise_id!)?.is_compound === true)
            expect(hasCompound).toBe(true)
        }

        // Should cover Quadríceps and Posterior de Coxa/Glúteo
        const allMuscleGroups = new Set(program.workouts.flatMap(w => w.items.map(i => i.exercise_muscle_group!)))
        expect(allMuscleGroups.has('Quadríceps')).toBe(true)
        expect(allMuscleGroups.has('Posterior de Coxa') || allMuscleGroups.has('Glúteo')).toBe(true)

        const validation = validateOutput(program, profile, exerciseMap)
        const errors = validation.violations.filter(v => v.severity === 'error')
        expect(errors.length).toBe(0)
    })

    it('respects medical restrictions', () => {
        const profile = makeProfile({
            training_level: 'beginner',
            available_days: [1, 3, 5],
            medical_restrictions: [{
                description: 'Dor no joelho',
                restricted_exercise_ids: ['leg-press', 'agachamento-livre'],
                restricted_muscle_groups: [],
                severity: 'moderate',
            }],
        })
        const exercises = makeExerciseLibrary()
        const exerciseMap = makeExerciseMap(exercises)

        const program = buildHeuristicProgram(profile, exercises)

        const allExerciseIds = program.workouts.flatMap(w => w.items.map(i => i.exercise_id))
        expect(allExerciseIds).not.toContain('leg-press')
        expect(allExerciseIds).not.toContain('agachamento-livre')

        const validation = validateOutput(program, profile, exerciseMap)
        const restrictedViolations = validation.violations.filter(v => v.rule_id === 'restricted_exercise')
        expect(restrictedViolations.length).toBe(0)
    })
})

describe('calcExercisesPerWorkout', () => {
    it('beginner 60min 3x → {min: 4, max: 6}', () => {
        const r = calcExercisesPerWorkout(60, 'beginner', 3)
        expect(r.max).toBe(6)
        expect(r.min).toBe(4)
    })

    it('advanced 90min 5x → {min: ≥4, max: 8}', () => {
        const r = calcExercisesPerWorkout(90, 'advanced', 5)
        expect(r.max).toBe(8)
        expect(r.min).toBeGreaterThanOrEqual(4)
    })

    it('beginner 60min 5x → {min: 4, max: 4}', () => {
        const r = calcExercisesPerWorkout(60, 'beginner', 5)
        expect(r.max).toBe(4)
        expect(r.min).toBe(4)
    })
})
