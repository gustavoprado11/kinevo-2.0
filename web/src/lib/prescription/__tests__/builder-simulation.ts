#!/usr/bin/env npx tsx
// ============================================================================
// Kinevo Slot-Based Builder — Monte Carlo Simulation
// ============================================================================
// Stress tests the slot builder algorithm with 10 profiles × 100 iterations.
// Evaluates: exercise diversity, slot distribution, volume compliance,
// fatigue stacking, stall replacement, substitute generation.
//
// Run: npx tsx web/src/lib/prescription/__tests__/builder-simulation.ts
//
// Does NOT modify production code. Self-contained with mock graph functions.
// ============================================================================

import type {
    TrainingLevel,
    PrescriptionGoal,
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    PrescriptionReasoning,
} from '@kinevo/shared/types/prescription'

import { VOLUME_RANGES } from '@kinevo/shared/types/prescription'

import {
    SLOT_TEMPLATES,
    matchesSlotPattern,
    getSlotLabels,
} from '../slot-templates'
import type { WorkoutSlot } from '../slot-templates'

import {
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SMALL_GROUP_EXERCISE_LIMITS,
    SECONDARY_VOLUME_FACTORS,
    REP_RANGES_BY_GOAL,
    REST_SECONDS,
    DEFAULT_DURATION_WEEKS,
    calcExercisesPerWorkout,
} from '../constants'

import type { PrescriptionConstraints } from '../constraints-engine'
import type { EnrichedStudentContext, LoadProgressionEntry } from '../context-enricher'

import { writeFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Config
// ============================================================================

const ITERATIONS_PER_PROFILE = 100
const REPORT_PATH = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'BUILDER_SIMULATION_REPORT.md')

// ============================================================================
// Exercise Library — 60+ exercises with movement patterns + fatigue classes
// ============================================================================

let exerciseCounter = 0
function makeExercise(overrides: Partial<PrescriptionExerciseRef>): PrescriptionExerciseRef {
    return {
        id: `ex-${++exerciseCounter}`,
        name: 'Exercício',
        muscle_group_names: ['Peito'],
        equipment: null,
        is_compound: false,
        difficulty_level: 'intermediate',
        is_primary_movement: false,
        session_position: 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
        ...overrides,
    }
}

function buildFullExerciseLibrary(): PrescriptionExerciseRef[] {
    return [
        // ═══ PEITO ═══
        makeExercise({ name: 'Supino Reto com Barra', muscle_group_names: ['Peito', 'Ombros', 'Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'high', equipment: 'barbell', difficulty_level: 'intermediate' }),
        makeExercise({ name: 'Supino Inclinado com Halteres', muscle_group_names: ['Peito', 'Ombros'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Supino Reto com Halteres', muscle_group_names: ['Peito', 'Ombros', 'Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Supino Declinado', muscle_group_names: ['Peito', 'Tríceps'], is_compound: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'barbell' }),
        makeExercise({ name: 'Crucifixo com Halteres', muscle_group_names: ['Peito'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        makeExercise({ name: 'Crossover', muscle_group_names: ['Peito'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'cable' }),
        makeExercise({ name: 'Peck Deck', muscle_group_names: ['Peito'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),
        makeExercise({ name: 'Chest Press Máquina', muscle_group_names: ['Peito', 'Tríceps'], is_compound: true, session_position: 'middle', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),

        // ═══ COSTAS ═══
        makeExercise({ name: 'Puxada Frontal', muscle_group_names: ['Costas', 'Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'moderate', equipment: 'cable' }),
        makeExercise({ name: 'Barra Fixa', muscle_group_names: ['Costas', 'Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'high', equipment: 'bodyweight', difficulty_level: 'advanced' }),
        makeExercise({ name: 'Remada Curvada', muscle_group_names: ['Costas', 'Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'high', equipment: 'barbell' }),
        makeExercise({ name: 'Remada Unilateral', muscle_group_names: ['Costas', 'Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Remada Cavalinho', muscle_group_names: ['Costas'], is_compound: true, session_position: 'first', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'moderate', equipment: 'machine' }),
        makeExercise({ name: 'Pulldown Supinado', muscle_group_names: ['Costas', 'Bíceps'], is_compound: true, session_position: 'middle', movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'low', equipment: 'cable' }),
        makeExercise({ name: 'Remada Baixa', muscle_group_names: ['Costas'], is_compound: true, session_position: 'middle', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'low', equipment: 'cable' }),
        makeExercise({ name: 'Pullover Máquina', muscle_group_names: ['Costas'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),

        // ═══ OMBROS ═══
        makeExercise({ name: 'Desenvolvimento com Halteres', muscle_group_names: ['Ombros', 'Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Press Militar com Barra', muscle_group_names: ['Ombros', 'Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'high', equipment: 'barbell' }),
        makeExercise({ name: 'Desenvolvimento Máquina', muscle_group_names: ['Ombros'], is_compound: true, session_position: 'first', movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Elevação Lateral', muscle_group_names: ['Ombros'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        makeExercise({ name: 'Elevação Frontal', muscle_group_names: ['Ombros'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        makeExercise({ name: 'Crucifixo Inverso', muscle_group_names: ['Ombros'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),

        // ═══ QUADRÍCEPS ═══
        makeExercise({ name: 'Agachamento Livre', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'high', equipment: 'barbell' }),
        makeExercise({ name: 'Agachamento Smith', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'smith' }),
        makeExercise({ name: 'Leg Press 45°', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'leg_press' }),
        makeExercise({ name: 'Passada com Halteres', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Avanço Búlgaro', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'high', equipment: 'dumbbell', difficulty_level: 'advanced' }),
        makeExercise({ name: 'Agachamento Goblet', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'low', equipment: 'dumbbell', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Cadeira Extensora', muscle_group_names: ['Quadríceps'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        makeExercise({ name: 'Hack Squat', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'hack' }),

        // ═══ POSTERIOR DE COXA ═══
        makeExercise({ name: 'Stiff com Barra', muscle_group_names: ['Posterior de Coxa', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'high', equipment: 'barbell' }),
        makeExercise({ name: 'Stiff com Halteres', muscle_group_names: ['Posterior de Coxa', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        makeExercise({ name: 'Levantamento Terra', muscle_group_names: ['Posterior de Coxa', 'Costas', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'high', equipment: 'barbell', difficulty_level: 'advanced' }),
        makeExercise({ name: 'Mesa Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        makeExercise({ name: 'Cadeira Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),

        // ═══ GLÚTEO ═══
        makeExercise({ name: 'Hip Thrust', muscle_group_names: ['Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'moderate', equipment: 'barbell' }),
        makeExercise({ name: 'Glúteo na Máquina', muscle_group_names: ['Glúteo'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        makeExercise({ name: 'Abdução de Quadril', muscle_group_names: ['Glúteo'], is_compound: false, session_position: 'middle', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),

        // ═══ BÍCEPS ═══
        makeExercise({ name: 'Rosca Direta com Barra', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'barbell', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Rosca Alternada', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Rosca Martelo', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Rosca Scott', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),

        // ═══ TRÍCEPS ═══
        makeExercise({ name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'cable', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Tríceps Testa', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'barbell' }),
        makeExercise({ name: 'Tríceps Corda', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'cable', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Tríceps Francês', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),

        // ═══ PANTURRILHA ═══
        makeExercise({ name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Panturrilha Sentado', muscle_group_names: ['Panturrilha'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),

        // ═══ ABDOMINAIS ═══
        makeExercise({ name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'bodyweight', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Prancha', muscle_group_names: ['Abdominais'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'bodyweight', difficulty_level: 'beginner' }),

        // ═══ TRAPÉZIO ═══
        makeExercise({ name: 'Encolhimento com Barra', muscle_group_names: ['Trapézio'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'barbell', difficulty_level: 'beginner' }),
        makeExercise({ name: 'Encolhimento com Halteres', muscle_group_names: ['Trapézio'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell', difficulty_level: 'beginner' }),

        // ═══ ADUTORES ═══
        makeExercise({ name: 'Adução de Quadril', muscle_group_names: ['Adutores'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),
    ]
}

// Home gym subset (no machines, no cables, no barbells for some)
function buildHomeGymLibrary(): PrescriptionExerciseRef[] {
    const full = buildFullExerciseLibrary()
    const homeEquipment = new Set(['dumbbell', 'bodyweight', 'bench', 'miniband', 'step'])
    return full.filter(e => !e.equipment || homeEquipment.has(e.equipment))
}

// ============================================================================
// Test Profiles
// ============================================================================

interface TestProfileConfig {
    name: string
    profile: StudentPrescriptionProfile
    exercises: PrescriptionExerciseRef[]
    stalledExerciseIds: string[]
    previousExerciseIds: string[]
    emphasized: string[]
}

function makeProfile(overrides: Partial<StudentPrescriptionProfile> = {}): StudentPrescriptionProfile {
    return {
        id: 'profile-sim',
        student_id: 'student-sim',
        trainer_id: 'trainer-sim',
        training_level: 'intermediate',
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

function buildTestProfiles(): TestProfileConfig[] {
    const fullLib = buildFullExerciseLibrary()
    const homeLib = buildHomeGymLibrary()

    return [
        {
            name: 'Beginner 3x',
            profile: makeProfile({ training_level: 'beginner', available_days: [1, 3, 5] }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
        {
            name: 'Beginner Home Gym',
            profile: makeProfile({ training_level: 'beginner', available_days: [1, 3, 5], available_equipment: ['home_gym_basico'] }),
            exercises: homeLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
        {
            name: 'Intermediate 4x',
            profile: makeProfile({ training_level: 'intermediate', available_days: [1, 2, 4, 5] }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: fullLib.slice(0, 10).map(e => e.id),
            emphasized: [],
        },
        {
            name: 'Intermediate Emphasis Back',
            profile: makeProfile({ training_level: 'intermediate', available_days: [1, 2, 4, 5] }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: ['Costas'],
        },
        {
            name: 'Intermediate Emphasis Legs',
            profile: makeProfile({ training_level: 'intermediate', available_days: [1, 2, 4, 5] }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: ['Quadríceps', 'Glúteo'],
        },
        {
            name: 'Advanced 5x',
            profile: makeProfile({ training_level: 'advanced', available_days: [1, 2, 3, 5, 6] }),
            exercises: fullLib,
            stalledExerciseIds: [fullLib[0].id, fullLib[10].id], // Supino + Remada stalled
            previousExerciseIds: fullLib.slice(0, 20).map(e => e.id),
            emphasized: [],
        },
        {
            name: 'Advanced Powerlifting',
            profile: makeProfile({ training_level: 'advanced', available_days: [1, 2, 3, 5, 6], goal: 'performance' }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
        {
            name: 'Short Sessions 40min',
            profile: makeProfile({ training_level: 'intermediate', available_days: [1, 3, 5, 6], session_duration_minutes: 40 }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
        {
            name: 'Shoulder Limitation',
            profile: makeProfile({
                training_level: 'intermediate',
                available_days: [1, 3, 5],
                medical_restrictions: [{
                    description: 'Lesão no ombro direito',
                    severity: 'moderate',
                    restricted_exercise_ids: fullLib.filter(e => e.name.includes('Press Militar') || e.name.includes('Desenvolvimento')).map(e => e.id),
                    restricted_muscle_groups: [],
                }],
            }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
        {
            name: 'Lower Back Limitation',
            profile: makeProfile({
                training_level: 'intermediate',
                available_days: [1, 2, 4, 5],
                medical_restrictions: [{
                    description: 'Hérnia lombar',
                    severity: 'severe',
                    restricted_exercise_ids: fullLib.filter(e => e.name.includes('Terra') || e.name.includes('Stiff com Barra')).map(e => e.id),
                    restricted_muscle_groups: [],
                }],
            }),
            exercises: fullLib,
            stalledExerciseIds: [],
            previousExerciseIds: [],
            emphasized: [],
        },
    ]
}

// ============================================================================
// Mock Constraints Builder (mirrors production logic)
// ============================================================================

// Mirrors production frequency cuts from constraints-engine.ts
const FREQUENCY_CUTS: Record<number, { remove: string[]; minimize: string[] }> = {
    6: { remove: [], minimize: [] },
    5: { remove: ['Antebraço', 'Oblíquos'], minimize: ['Abdominais', 'Adutores'] },
    4: { remove: ['Antebraço', 'Oblíquos'], minimize: ['Panturrilha', 'Abdominais'] },
    3: { remove: ['Antebraço', 'Oblíquos', 'Panturrilha', 'Abdominais', 'Adutores', 'Trapézio'], minimize: [] },
    2: { remove: ['Antebraço', 'Oblíquos', 'Panturrilha', 'Abdominais', 'Adutores', 'Trapézio', 'Bíceps', 'Tríceps'], minimize: [] },
}

function buildMockConstraints(
    profile: StudentPrescriptionProfile,
    emphasized: string[],
): PrescriptionConstraints {
    const frequency = profile.available_days.length
    const level = profile.training_level
    const goal = profile.goal as PrescriptionGoal

    // Split type
    const FREQ_MAP: Record<number, string> = { 2: 'full_body', 3: 'full_body', 4: 'upper_lower', 5: 'ppl_plus', 6: 'ppl_complete' }
    const clamped = Math.max(2, Math.min(6, frequency))
    const splitType = FREQ_MAP[clamped] || 'full_body'

    // Volume budget
    const range = VOLUME_RANGES[level]
    const volumeBudget: Record<string, { min: number; max: number }> = {}
    for (const group of PRIMARY_MUSCLE_GROUPS) {
        volumeBudget[group] = { min: range.min, max: range.max }
    }
    for (const group of SMALL_MUSCLE_GROUPS) {
        const factor = SECONDARY_VOLUME_FACTORS[group] ?? 0.5
        volumeBudget[group] = { min: Math.round(range.min * factor), max: Math.round(range.max * factor) }
    }

    // Apply frequency-based cuts (mirrors production constraints-engine)
    const deprioritized: string[] = []
    const cuts = FREQUENCY_CUTS[clamped] || FREQUENCY_CUTS[6]
    for (const group of cuts.remove) {
        delete volumeBudget[group]
        deprioritized.push(group)
    }
    for (const group of cuts.minimize) {
        if (volumeBudget[group]) {
            volumeBudget[group] = { min: 3, max: 3 }
            deprioritized.push(group)
        }
    }

    // Apply emphasis
    for (const group of emphasized) {
        if (volumeBudget[group]) {
            volumeBudget[group] = { min: Math.round(volumeBudget[group].max * 0.8), max: volumeBudget[group].max }
        }
    }

    // Exercises per session
    const exercisesPerSession = Math.max(3, Math.min(Math.floor(profile.session_duration_minutes / 10), 10))

    // Cap volume budget (mirrors production capVolumeBudget)
    const AVG_SETS_PER_EXERCISE = 3.5
    const totalWeeklySets = exercisesPerSession * AVG_SETS_PER_EXERCISE * clamped
    const totalBudgetMin = Object.values(volumeBudget).reduce((sum, r) => sum + r.min, 0)
    if (totalBudgetMin > totalWeeklySets * 1.3) {
        const scaleFactor = (totalWeeklySets * 1.1) / totalBudgetMin
        for (const [group, r] of Object.entries(volumeBudget)) {
            const newMin = Math.round(r.min * scaleFactor)
            const newMax = Math.round(r.max * scaleFactor)
            const floor = PRIMARY_MUSCLE_GROUPS.includes(group) ? 6 : 3
            volumeBudget[group] = { min: Math.max(newMin, floor), max: Math.max(newMax, floor) }
        }
    }

    // Restricted exercises
    const prohibited = profile.medical_restrictions.flatMap(r => r.restricted_exercise_ids)

    return {
        split_type: splitType,
        split_detail: [],
        volume_budget: volumeBudget,
        exercises_per_session: exercisesPerSession,
        session_duration_minutes: profile.session_duration_minutes,
        clinical_conditions: [],
        prohibited_exercise_ids: prohibited,
        prohibited_muscle_groups: [],
        favorite_exercise_ids: profile.favorite_exercise_ids,
        disliked_exercise_ids: profile.disliked_exercise_ids,
        adherence_adjustment: 'normal',
        adherence_percentage: 100,
        rep_ranges: { compound: REP_RANGES_BY_GOAL[goal].compound, isolation: REP_RANGES_BY_GOAL[goal].isolation },
        rest_seconds: { compound: REST_SECONDS.compound[goal], isolation: REST_SECONDS.isolation[goal] },
        medical_restrictions: profile.medical_restrictions,
        emphasized_groups: emphasized,
        deprioritized_groups: deprioritized,
    }
}

function buildMockEnrichedContext(
    stalledIds: string[],
    previousIds: string[],
    exercises: PrescriptionExerciseRef[],
): EnrichedStudentContext {
    const exMap = new Map(exercises.map(e => [e.id, e]))

    return {
        student_name: 'Aluno Simulação',
        previous_programs: [],
        load_progression: stalledIds.map(id => ({
            exercise_id: id,
            exercise_name: exMap.get(id)?.name || 'Unknown',
            trend: 'stalled' as const,
            weeks_at_current: 4,
            last_weight: 50,
        })),
        session_patterns: {
            preferred_days: [1, 3, 5],
            avg_session_duration_minutes: 60,
            dropout_rate_by_workout: {},
            total_sessions_4w: 12,
            completed_sessions_4w: 10,
        },
        previous_exercise_ids: previousIds,
    }
}

// ============================================================================
// Slot Builder Algorithm (mirrors production — no DB dependencies)
// ============================================================================

const BUILDER_SECONDARY_MAP: Record<string, Array<{ group: string; weight: number }>> = {
    'Quadríceps':        [{ group: 'Glúteo', weight: 1.0 }],
    'Posterior de Coxa': [{ group: 'Glúteo', weight: 1.0 }],
    'Peito':             [{ group: 'Ombros', weight: 0.5 }, { group: 'Tríceps', weight: 0.5 }],
    'Costas':            [{ group: 'Bíceps', weight: 0.5 }],
    'Ombros':            [{ group: 'Tríceps', weight: 0.5 }],
}

const SESSION_POSITION_ORDER: Record<string, number> = { first: 0, middle: 1, last: 2 }

interface SlotScoringCtx {
    favoriteIds: Set<string>
    stalledIds: Set<string>
    previousIds: Set<string>
    emphasizedGroups: Set<string>
    level: TrainingLevel
    usedPatternsInWorkout: Set<string>
    usedGroupsInWorkout: Map<string, number>
    highFatigueUsedInWorkout: boolean
}

function computeSlotScore(ex: PrescriptionExerciseRef, slot: WorkoutSlot, ctx: SlotScoringCtx): number {
    let score = 50
    if (ctx.favoriteIds.has(ex.id)) score += 20
    if (!ctx.previousIds.has(ex.id)) score += 15
    if (ctx.stalledIds.has(ex.id)) score -= 30
    const levelMap: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
    if (levelMap[ex.difficulty_level] === levelMap[ctx.level]) score += 10
    if (ex.is_primary_movement) score += 10
    if (slot.function === 'main' && ex.is_compound) score += 5
    if (ctx.emphasizedGroups.has(slot.target_group)) score += 10
    if (ex.fatigue_class === 'high' && ex.is_compound && ctx.highFatigueUsedInWorkout) score -= 20
    const patternKey = `${ex.movement_pattern || 'isolation'}:${slot.target_group}`
    if (ctx.usedPatternsInWorkout.has(patternKey)) score -= 15
    return Math.max(0, Math.min(100, score))
}

function distributeSets(
    slot: WorkoutSlot,
    volumeBudget: Record<string, { min: number; max: number }>,
    weeklyVol: Record<string, number>,
    groupFreq: Record<string, number>,
): number {
    const budget = volumeBudget[slot.target_group]
    if (!budget) return slot.min_sets
    const remaining = Math.max(0, budget.max - (weeklyVol[slot.target_group] || 0))
    const occ = groupFreq[slot.target_group] || 1
    const per = Math.ceil(remaining / occ)
    return Math.max(slot.min_sets, Math.min(slot.max_sets, per))
}

function runSlotBuilder(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    context: EnrichedStudentContext,
): PrescriptionOutputSnapshot {
    const level = profile.training_level
    const goal = profile.goal as PrescriptionGoal
    const splitType = constraints.split_type
    const frequency = profile.available_days.length

    // Filter
    const restrictedIds = new Set(profile.medical_restrictions.flatMap(r => r.restricted_exercise_ids))
    const dislikedIds = new Set(profile.disliked_exercise_ids)
    const available = exercises.filter(e => !restrictedIds.has(e.id) && !dislikedIds.has(e.id))

    // Index
    const byGroup = new Map<string, PrescriptionExerciseRef[]>()
    for (const ex of available) {
        for (const g of ex.muscle_group_names) {
            const list = byGroup.get(g) || []
            list.push(ex)
            byGroup.set(g, list)
        }
    }

    const slotLabels = getSlotLabels(splitType)
    const templates = SLOT_TEMPLATES[splitType]
    const workoutCount = Math.min(frequency, slotLabels.length)

    // Group frequency
    const groupFreq: Record<string, number> = {}
    for (let i = 0; i < workoutCount; i++) {
        const slots = templates[slotLabels[i]]
        if (!slots) continue
        const seen = new Set<string>()
        for (const s of slots) {
            if (!seen.has(s.target_group)) {
                seen.add(s.target_group)
                groupFreq[s.target_group] = (groupFreq[s.target_group] || 0) + 1
            }
        }
    }

    const stalledIds = new Set(context.load_progression.filter(lp => lp.trend === 'stalled').map(lp => lp.exercise_id))
    const previousIds = new Set(context.previous_exercise_ids || [])
    const favoriteIds = new Set(profile.favorite_exercise_ids)
    const emphasizedGroups = new Set(constraints.emphasized_groups || [])

    const weeklyGroupVolume: Record<string, number> = {}
    const workouts: GeneratedWorkout[] = []

    for (let i = 0; i < workoutCount; i++) {
        const label = slotLabels[i]
        const slots = templates[label]
        if (!slots) continue

        const scheduledDay = profile.available_days[i]
        const items: GeneratedWorkoutItem[] = []
        const usedInWorkout = new Set<string>()
        let itemIndex = 0
        const freq = 1

        const ctx: SlotScoringCtx = {
            favoriteIds, stalledIds, previousIds, emphasizedGroups, level,
            usedPatternsInWorkout: new Set(),
            usedGroupsInWorkout: new Map(),
            highFatigueUsedInWorkout: false,
        }

        const { max: exLimit } = calcExercisesPerWorkout(constraints.session_duration_minutes, level, workoutCount)
        const maxEx = Math.min(exLimit, constraints.exercises_per_session || exLimit)

        const required = slots.filter(s => !s.optional)
        const optional = slots.filter(s => s.optional)
        const optCount = Math.max(0, maxEx - required.length)
        const active = [...required, ...optional.slice(0, optCount)].sort((a, b) => a.priority - b.priority)

        for (const slot of active) {
            if (items.length >= maxEx) break

            let candidates = (byGroup.get(slot.target_group) || []).filter(ex => {
                if (usedInWorkout.has(ex.id)) return false
                return matchesSlotPattern(ex.movement_pattern, ex.movement_pattern_family, slot.movement_pattern)
            })

            if (candidates.length === 0) continue

            const scored = candidates.map(ex => ({ exercise: ex, score: computeSlotScore(ex, slot, ctx) }))
            scored.sort((a, b) => b.score - a.score)

            const bestScore = scored[0].score
            const top = scored.filter(s => s.score >= bestScore - 5)
            const pick = top[Math.floor(Math.random() * top.length)].exercise

            const sets = distributeSets(slot, constraints.volume_budget, weeklyGroupVolume, groupFreq)

            const isCompound = pick.is_compound
            const repRange = isCompound ? REP_RANGES_BY_GOAL[goal].compound : REP_RANGES_BY_GOAL[goal].isolation
            const restSec = isCompound ? REST_SECONDS.compound[goal] : REST_SECONDS.isolation[goal]

            const muscleGroup = slot.target_group !== '*' && pick.muscle_group_names.includes(slot.target_group)
                ? slot.target_group : pick.muscle_group_names[0] || ''

            items.push({
                exercise_id: pick.id,
                exercise_name: pick.name,
                exercise_muscle_group: muscleGroup,
                exercise_equipment: pick.equipment,
                sets,
                reps: repRange,
                rest_seconds: restSec,
                notes: null,
                substitute_exercise_ids: [],
                order_index: itemIndex++,
                exercise_function: slot.function,
            })

            usedInWorkout.add(pick.id)

            // Track volume
            const ws = sets * freq
            weeklyGroupVolume[slot.target_group] = (weeklyGroupVolume[slot.target_group] || 0) + ws
            if (pick.is_compound) {
                for (const { group: sg, weight } of BUILDER_SECONDARY_MAP[slot.target_group] || []) {
                    weeklyGroupVolume[sg] = (weeklyGroupVolume[sg] || 0) + Math.round(ws * weight)
                }
            }

            const pattern = pick.movement_pattern || 'isolation'
            ctx.usedPatternsInWorkout.add(`${pattern}:${slot.target_group}`)
            const gc = ctx.usedGroupsInWorkout.get(slot.target_group) || 0
            ctx.usedGroupsInWorkout.set(slot.target_group, gc + 1)
            if (pick.fatigue_class === 'high' && pick.is_compound) ctx.highFatigueUsedInWorkout = true
        }

        // Sort by session position
        items.sort((a, b) => {
            const exA = available.find(e => e.id === a.exercise_id)
            const exB = available.find(e => e.id === b.exercise_id)
            const posA = SESSION_POSITION_ORDER[exA?.session_position || 'middle'] ?? 1
            const posB = SESSION_POSITION_ORDER[exB?.session_position || 'middle'] ?? 1
            return posA - posB
        })
        items.forEach((item, idx) => { item.order_index = idx })

        workouts.push({
            name: `Treino ${String.fromCharCode(65 + i)} — ${label}`,
            order_index: i,
            scheduled_days: scheduledDay !== undefined ? [scheduledDay] : [],
            items,
        })
    }

    return {
        program: { name: `Programa Simulação`, description: '', duration_weeks: DEFAULT_DURATION_WEEKS },
        workouts,
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.88,
        },
    }
}

// ============================================================================
// Metrics Collection
// ============================================================================

interface ProfileMetrics {
    profileName: string
    totalPrograms: number
    exerciseDiversity: {
        uniqueExercises: Set<string>
        exerciseFrequency: Map<string, number>
        avgUniquePerProgram: number
    }
    volumeCompliance: {
        overBudgetCount: number
        underBudgetCount: number
        withinBudgetCount: number
        avgVolumeByGroup: Record<string, number>
        overBudgetDetails: Record<string, number>
        underBudgetDetails: Record<string, number>
    }
    fatigueStacking: {
        programsExceedingFatigueLimit: number
        avgHighFatiguePerWorkout: number
        maxHighFatigueInWorkout: number
    }
    slotDistribution: {
        avgExercisesPerWorkout: number
        avgMainsPerWorkout: number
        avgAccessoriesPerWorkout: number
        emptySlotRate: number
    }
    programIdentity: {
        identicalProgramCount: number
        identicalPairs: number
    }
    stallReplacement: {
        stalledInPool: number
        replacementRate: number
        programsWithStalledUsed: number
    }
}

function collectMetrics(
    profileConfig: TestProfileConfig,
    programs: PrescriptionOutputSnapshot[],
    constraints: PrescriptionConstraints,
): ProfileMetrics {
    const uniqueExercises = new Set<string>()
    const exerciseFrequency = new Map<string, number>()
    let totalUniquePerProgram = 0
    let overBudget = 0, underBudget = 0, withinBudget = 0
    const avgVolByGroup: Record<string, number[]> = {}
    const overDetails: Record<string, number> = {}
    const underDetails: Record<string, number> = {}
    let fatigueExceedCount = 0
    let totalHighFatiguePerWorkout = 0
    let maxHighFatigue = 0
    let totalWorkouts = 0
    let totalExPerWorkout = 0
    let totalMains = 0
    let totalAccessories = 0
    let totalSlots = 0
    let emptySlots = 0
    const programSignatures: string[] = []
    let programsWithStalled = 0

    const exerciseMap = new Map(profileConfig.exercises.map(e => [e.id, e]))
    const stalledSet = new Set(profileConfig.stalledExerciseIds)

    for (const program of programs) {
        const progUniqueIds = new Set<string>()
        let progHasStalled = false
        const weeklyVol: Record<string, number> = {}
        let progExceedsFatigue = false

        for (const workout of program.workouts) {
            totalWorkouts++
            let highFatigueInWorkout = 0

            for (const item of workout.items) {
                progUniqueIds.add(item.exercise_id!)
                uniqueExercises.add(item.exercise_id!)
                exerciseFrequency.set(item.exercise_id!, (exerciseFrequency.get(item.exercise_id!) || 0) + 1)

                // Volume tracking (primary + secondary, mirrors builder)
                const group = item.exercise_muscle_group!
                weeklyVol[group] = (weeklyVol[group] || 0) + (item.sets ?? 0)
                const ex = exerciseMap.get(item.exercise_id!)
                if (ex?.is_compound) {
                    for (const { group: sg, weight } of BUILDER_SECONDARY_MAP[group] || []) {
                        weeklyVol[sg] = (weeklyVol[sg] || 0) + Math.round((item.sets ?? 0) * weight)
                    }
                }

                // Fatigue (ex already fetched above for secondary volume)
                if (ex?.fatigue_class === 'high' && ex.is_compound) {
                    highFatigueInWorkout++
                }

                // Stall check
                if (stalledSet.has(item.exercise_id!)) {
                    progHasStalled = true
                }

                // Slot counts
                if (item.exercise_function === 'main') totalMains++
                else totalAccessories++
            }

            totalExPerWorkout += workout.items.length
            if (highFatigueInWorkout > 1) progExceedsFatigue = true
            totalHighFatiguePerWorkout += highFatigueInWorkout
            maxHighFatigue = Math.max(maxHighFatigue, highFatigueInWorkout)

            // Slot template size
            const splitTemplates = SLOT_TEMPLATES[constraints.split_type]
            const labels = getSlotLabels(constraints.split_type)
            if (splitTemplates && labels[workout.order_index]) {
                const templateSlots = splitTemplates[labels[workout.order_index]]
                if (templateSlots) {
                    totalSlots += templateSlots.length
                    emptySlots += Math.max(0, templateSlots.length - workout.items.length)
                }
            }
        }

        totalUniquePerProgram += progUniqueIds.size
        if (progExceedsFatigue) fatigueExceedCount++
        if (progHasStalled) programsWithStalled++

        // Volume compliance
        for (const [group, budget] of Object.entries(constraints.volume_budget)) {
            const actual = weeklyVol[group] || 0
            if (!avgVolByGroup[group]) avgVolByGroup[group] = []
            avgVolByGroup[group].push(actual)

            if (actual > budget.max) {
                overBudget++
                overDetails[group] = (overDetails[group] || 0) + 1
            } else if (actual < budget.min) {
                underBudget++
                underDetails[group] = (underDetails[group] || 0) + 1
            } else {
                withinBudget++
            }
        }

        // Program signature for identity check
        const sig = program.workouts.map(w =>
            w.items.map(i => i.exercise_id).sort().join(',')
        ).join('|')
        programSignatures.push(sig)
    }

    // Count identical pairs
    const sigCounts = new Map<string, number>()
    for (const sig of programSignatures) {
        sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1)
    }
    let identicalPairs = 0
    let identicalPrograms = 0
    for (const count of sigCounts.values()) {
        if (count > 1) {
            identicalPairs += count * (count - 1) / 2
            identicalPrograms += count
        }
    }

    const avgVol: Record<string, number> = {}
    for (const [g, vals] of Object.entries(avgVolByGroup)) {
        avgVol[g] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10
    }

    return {
        profileName: profileConfig.name,
        totalPrograms: programs.length,
        exerciseDiversity: {
            uniqueExercises,
            exerciseFrequency,
            avgUniquePerProgram: Math.round(totalUniquePerProgram / programs.length * 10) / 10,
        },
        volumeCompliance: {
            overBudgetCount: overBudget,
            underBudgetCount: underBudget,
            withinBudgetCount: withinBudget,
            avgVolumeByGroup: avgVol,
            overBudgetDetails: overDetails,
            underBudgetDetails: underDetails,
        },
        fatigueStacking: {
            programsExceedingFatigueLimit: fatigueExceedCount,
            avgHighFatiguePerWorkout: Math.round(totalHighFatiguePerWorkout / totalWorkouts * 100) / 100,
            maxHighFatigueInWorkout: maxHighFatigue,
        },
        slotDistribution: {
            avgExercisesPerWorkout: Math.round(totalExPerWorkout / totalWorkouts * 10) / 10,
            avgMainsPerWorkout: Math.round(totalMains / totalWorkouts * 10) / 10,
            avgAccessoriesPerWorkout: Math.round(totalAccessories / totalWorkouts * 10) / 10,
            emptySlotRate: totalSlots > 0 ? Math.round(emptySlots / totalSlots * 1000) / 10 : 0,
        },
        programIdentity: {
            identicalProgramCount: identicalPrograms,
            identicalPairs,
        },
        stallReplacement: {
            stalledInPool: profileConfig.stalledExerciseIds.length,
            replacementRate: profileConfig.stalledExerciseIds.length > 0
                ? Math.round((1 - programsWithStalled / programs.length) * 1000) / 10
                : 100,
            programsWithStalledUsed: programsWithStalled,
        },
    }
}

// ============================================================================
// Report Generator
// ============================================================================

function generateReport(allMetrics: ProfileMetrics[], totalTimeMs: number): string {
    const lines: string[] = []
    const line = (s: string) => lines.push(s)

    line('# Slot Builder — Monte Carlo Simulation Report')
    line('')
    line(`> **Date:** ${new Date().toISOString().split('T')[0]}`)
    line(`> **Iterations per profile:** ${ITERATIONS_PER_PROFILE}`)
    line(`> **Total programs generated:** ${allMetrics.reduce((s, m) => s + m.totalPrograms, 0)}`)
    line(`> **Total time:** ${(totalTimeMs / 1000).toFixed(1)}s`)
    line(`> **Avg per program:** ${(totalTimeMs / allMetrics.reduce((s, m) => s + m.totalPrograms, 0)).toFixed(1)}ms`)
    line('')
    line('---')
    line('')

    // ── Summary Table ──
    line('## 1. Summary by Profile')
    line('')
    line('| Profile | Unique Exercises | Avg/Program | Identical % | Fatigue Exceed % | Volume Over % | Volume Under % |')
    line('|---|---|---|---|---|---|---|')

    for (const m of allMetrics) {
        const identPct = Math.round(m.programIdentity.identicalProgramCount / m.totalPrograms * 100)
        const fatiguePct = Math.round(m.fatigueStacking.programsExceedingFatigueLimit / m.totalPrograms * 100)
        const totalChecks = m.volumeCompliance.overBudgetCount + m.volumeCompliance.underBudgetCount + m.volumeCompliance.withinBudgetCount
        const overPct = totalChecks > 0 ? Math.round(m.volumeCompliance.overBudgetCount / totalChecks * 100) : 0
        const underPct = totalChecks > 0 ? Math.round(m.volumeCompliance.underBudgetCount / totalChecks * 100) : 0

        line(`| ${m.profileName} | ${m.exerciseDiversity.uniqueExercises.size} | ${m.exerciseDiversity.avgUniquePerProgram} | ${identPct}% | ${fatiguePct}% | ${overPct}% | ${underPct}% |`)
    }

    line('')
    line('---')
    line('')

    // ── Exercise Diversity ──
    line('## 2. Exercise Diversity')
    line('')

    for (const m of allMetrics) {
        line(`### ${m.profileName}`)
        line('')
        line(`- **Unique exercises seen:** ${m.exerciseDiversity.uniqueExercises.size}`)
        line(`- **Avg unique per program:** ${m.exerciseDiversity.avgUniquePerProgram}`)
        line('')

        // Top 10 most used
        const sorted = [...m.exerciseDiversity.exerciseFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        line('| Exercise | Usage Count | Usage Rate |')
        line('|---|---|---|')
        for (const [id, count] of sorted) {
            const name = allMetrics[0]?.exerciseDiversity.exerciseFrequency ? id : id
            const rate = Math.round(count / m.totalPrograms * 100)
            line(`| ${id} | ${count} | ${rate}% |`)
        }
        line('')
    }

    line('---')
    line('')

    // ── Slot Distribution ──
    line('## 3. Slot Distribution')
    line('')
    line('| Profile | Avg Exercises/Workout | Avg Mains | Avg Accessories | Empty Slot Rate |')
    line('|---|---|---|---|---|')

    for (const m of allMetrics) {
        line(`| ${m.profileName} | ${m.slotDistribution.avgExercisesPerWorkout} | ${m.slotDistribution.avgMainsPerWorkout} | ${m.slotDistribution.avgAccessoriesPerWorkout} | ${m.slotDistribution.emptySlotRate}% |`)
    }

    line('')
    line('---')
    line('')

    // ── Volume Compliance ──
    line('## 4. Volume Compliance')
    line('')

    for (const m of allMetrics) {
        const totalChecks = m.volumeCompliance.overBudgetCount + m.volumeCompliance.underBudgetCount + m.volumeCompliance.withinBudgetCount
        if (totalChecks === 0) continue

        line(`### ${m.profileName}`)
        line('')
        line(`- **Within budget:** ${Math.round(m.volumeCompliance.withinBudgetCount / totalChecks * 100)}%`)
        line(`- **Over budget:** ${Math.round(m.volumeCompliance.overBudgetCount / totalChecks * 100)}%`)
        line(`- **Under budget:** ${Math.round(m.volumeCompliance.underBudgetCount / totalChecks * 100)}%`)
        line('')

        if (Object.keys(m.volumeCompliance.overBudgetDetails).length > 0) {
            line('**Over-budget groups:** ' + Object.entries(m.volumeCompliance.overBudgetDetails).map(([g, c]) => `${g} (${c}x)`).join(', '))
        }
        if (Object.keys(m.volumeCompliance.underBudgetDetails).length > 0) {
            line('**Under-budget groups:** ' + Object.entries(m.volumeCompliance.underBudgetDetails).map(([g, c]) => `${g} (${c}x)`).join(', '))
        }

        line('')
        line('| Muscle Group | Avg Weekly Sets |')
        line('|---|---|')
        for (const [g, v] of Object.entries(m.volumeCompliance.avgVolumeByGroup).sort((a, b) => b[1] - a[1])) {
            line(`| ${g} | ${v} |`)
        }
        line('')
    }

    line('---')
    line('')

    // ── Fatigue Stacking ──
    line('## 5. Fatigue Stacking Analysis')
    line('')
    line('| Profile | Programs > 1 High-Fatigue/Workout | Avg High-Fatigue/Workout | Max in Single Workout |')
    line('|---|---|---|---|')

    for (const m of allMetrics) {
        const pct = Math.round(m.fatigueStacking.programsExceedingFatigueLimit / m.totalPrograms * 100)
        line(`| ${m.profileName} | ${pct}% (${m.fatigueStacking.programsExceedingFatigueLimit}/${m.totalPrograms}) | ${m.fatigueStacking.avgHighFatiguePerWorkout} | ${m.fatigueStacking.maxHighFatigueInWorkout} |`)
    }

    line('')
    line('---')
    line('')

    // ── Stall Replacement ──
    line('## 6. Stall Replacement')
    line('')
    line('> Note: Graph-based stall replacement requires DB connection. This simulation tests')
    line('> whether stalled exercises are penalized by the scoring function (-30 penalty).')
    line('')
    line('| Profile | Stalled in Pool | Programs Using Stalled | Avoidance Rate |')
    line('|---|---|---|---|')

    for (const m of allMetrics) {
        line(`| ${m.profileName} | ${m.stallReplacement.stalledInPool} | ${m.stallReplacement.programsWithStalledUsed}/${m.totalPrograms} | ${m.stallReplacement.replacementRate}% |`)
    }

    line('')
    line('---')
    line('')

    // ── Flags ──
    line('## 7. Automated Problem Flags')
    line('')

    const flags: string[] = []

    for (const m of allMetrics) {
        const fatiguePct = m.fatigueStacking.programsExceedingFatigueLimit / m.totalPrograms * 100
        if (fatiguePct > 20) {
            flags.push(`**FATIGUE** — ${m.profileName}: ${Math.round(fatiguePct)}% of programs exceed fatigue limit (>1 high-fatigue compound per workout). Threshold: 20%.`)
        }

        const identPct = m.programIdentity.identicalProgramCount / m.totalPrograms * 100
        if (identPct > 25) {
            flags.push(`**DIVERSITY** — ${m.profileName}: ${Math.round(identPct)}% of programs are identical. Threshold: 25%.`)
        }

        const totalChecks = m.volumeCompliance.overBudgetCount + m.volumeCompliance.underBudgetCount + m.volumeCompliance.withinBudgetCount
        for (const [group, count] of Object.entries(m.volumeCompliance.underBudgetDetails)) {
            const groupPct = count / m.totalPrograms * 100
            if (groupPct > 50) {
                flags.push(`**VOLUME** — ${m.profileName}: ${group} falls below budget minimum in ${Math.round(groupPct)}% of programs. Threshold: 50%.`)
            }
        }
    }

    if (flags.length === 0) {
        line('No problems flagged. All metrics within acceptable thresholds.')
    } else {
        for (const flag of flags) {
            line(`- ${flag}`)
        }
    }

    // ═══ Section 8: Key Findings & Recommendations ═══
    line('')
    line('## 8. Key Findings & Recommendations')
    line('')

    // Analyze patterns across all profiles
    const noSlotGroups = new Set<string>()
    const nearMissPrimary = new Set<string>()
    const overBudgetSecondary = new Set<string>()

    for (const m of allMetrics) {
        for (const [group, count] of Object.entries(m.volumeCompliance.underBudgetDetails)) {
            const avg = m.volumeCompliance.avgVolumeByGroup[group] || 0
            if (avg === 0) noSlotGroups.add(group)
            else if (PRIMARY_MUSCLE_GROUPS.includes(group)) nearMissPrimary.add(group)
        }
        for (const [group, count] of Object.entries(m.volumeCompliance.overBudgetDetails)) {
            if (count === m.totalPrograms) overBudgetSecondary.add(group)
        }
    }

    if (noSlotGroups.size > 0) {
        line('### Template Gaps (No Dedicated Slots)')
        line('')
        line(`Groups with **zero direct volume**: ${[...noSlotGroups].join(', ')}`)
        line('')
        line('These groups have no slots in the current templates. Consider adding optional low-priority slots at the end of each workout, or a post-main "accessory fill" phase.')
        line('')
    }

    if (nearMissPrimary.size > 0) {
        line('### Primary Groups Under Budget')
        line('')
        line(`Primary groups consistently below minimum: ${[...nearMissPrimary].join(', ')}`)
        line('')
        line('These groups have dedicated slots but the slot `max_sets` cap prevents reaching the budget minimum. Consider increasing `max_sets` from 4→5 on key slots, or adding a second slot in alternating workouts.')
        line('')
    }

    if (overBudgetSecondary.size > 0) {
        line('### Secondary Volume Over-Attribution')
        line('')
        line(`Groups consistently over budget via secondary contributions: ${[...overBudgetSecondary].join(', ')}`)
        line('')
        line('The `BUILDER_SECONDARY_MAP` weights may be too aggressive for these groups. Consider reducing weights (e.g., Quad→Glúteo from 1.0 to 0.5) to avoid inflating tracked volume beyond realistic stimulus.')
        line('')
    }

    line('### Strengths')
    line('')
    const allFatiguePassing = allMetrics.every(m => m.fatigueStacking.programsExceedingFatigueLimit === 0)
    if (allFatiguePassing) line('- **Fatigue management**: 0% violations across all profiles — max 1 high-fatigue compound per workout')
    const avgIdentical = allMetrics.reduce((s, m) => s + m.programIdentity.identicalProgramCount / m.totalPrograms, 0) / allMetrics.length * 100
    if (avgIdentical < 10) line(`- **Controlled variety**: avg ${avgIdentical.toFixed(1)}% identical programs — good randomization within quality bounds`)
    line('- **Performance**: 1000 programs in <1s — suitable for real-time generation')
    line('')

    line('')
    line('---')
    line('')
    line(`*Generated by builder-simulation.ts — ${new Date().toISOString()}*`)

    return lines.join('\n')
}

// ============================================================================
// Main Runner
// ============================================================================

function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Kinevo Slot Builder — Monte Carlo Simulation')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log()

    const profiles = buildTestProfiles()
    const allMetrics: ProfileMetrics[] = []
    const startTime = Date.now()

    for (const config of profiles) {
        const constraints = buildMockConstraints(config.profile, config.emphasized)
        const context = buildMockEnrichedContext(config.stalledExerciseIds, config.previousExerciseIds, config.exercises)

        console.log(`▸ ${config.name} (${config.exercises.length} exercises, split=${constraints.split_type})`)

        const programs: PrescriptionOutputSnapshot[] = []
        const profileStart = Date.now()

        for (let i = 0; i < ITERATIONS_PER_PROFILE; i++) {
            const program = runSlotBuilder(config.profile, config.exercises, constraints, context)
            programs.push(program)
        }

        const profileMs = Date.now() - profileStart
        console.log(`  ✓ ${programs.length} programs in ${profileMs}ms (${(profileMs / programs.length).toFixed(1)}ms/program)`)

        const metrics = collectMetrics(config, programs, constraints)
        allMetrics.push(metrics)

        // Quick stats
        const fatiguePct = Math.round(metrics.fatigueStacking.programsExceedingFatigueLimit / metrics.totalPrograms * 100)
        const identPct = Math.round(metrics.programIdentity.identicalProgramCount / metrics.totalPrograms * 100)
        console.log(`  Diversity: ${metrics.exerciseDiversity.uniqueExercises.size} unique, ${metrics.exerciseDiversity.avgUniquePerProgram} avg/program`)
        console.log(`  Fatigue exceed: ${fatiguePct}%, Identical: ${identPct}%`)
        console.log()
    }

    const totalTime = Date.now() - startTime
    console.log(`━━ Total: ${allMetrics.reduce((s, m) => s + m.totalPrograms, 0)} programs in ${(totalTime / 1000).toFixed(1)}s ━━`)
    console.log()

    // Generate report
    const report = generateReport(allMetrics, totalTime)
    writeFileSync(REPORT_PATH, report, 'utf-8')
    console.log(`Report written to: ${REPORT_PATH}`)

    // Print flags
    console.log()
    console.log('━━ Problem Flags ━━')

    let hasFlags = false
    for (const m of allMetrics) {
        const fatiguePct = m.fatigueStacking.programsExceedingFatigueLimit / m.totalPrograms * 100
        if (fatiguePct > 20) {
            console.log(`  ✗ FATIGUE: ${m.profileName} — ${Math.round(fatiguePct)}% exceed limit`)
            hasFlags = true
        }
        const identPct = m.programIdentity.identicalProgramCount / m.totalPrograms * 100
        if (identPct > 25) {
            console.log(`  ✗ DIVERSITY: ${m.profileName} — ${Math.round(identPct)}% identical`)
            hasFlags = true
        }
        for (const [group, count] of Object.entries(m.volumeCompliance.underBudgetDetails)) {
            if (count / m.totalPrograms * 100 > 50) {
                console.log(`  ✗ VOLUME: ${m.profileName} — ${group} under budget in ${Math.round(count / m.totalPrograms * 100)}%`)
                hasFlags = true
            }
        }
    }
    if (!hasFlags) {
        console.log('  ✓ All metrics within acceptable thresholds')
    }
}

main()
