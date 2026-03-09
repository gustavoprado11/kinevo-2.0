#!/usr/bin/env npx tsx
// ============================================================================
// Kinevo Volume V2 — Stress Test (100 randomized programs)
// ============================================================================
// Self-contained simulation that exercises the Volume V2 algorithms:
// VolumeTracker, forecastMaxSets, commitVolume, distributeSetsForSlotV2,
// generateDynamicSlots, diversity scoring — without requiring DB/Supabase.
//
// Run: npx tsx web/src/lib/prescription/__tests__/volume-v2-stress-test.ts
// ============================================================================

import type {
    TrainingLevel,
    PrescriptionGoal,
    PrescriptionExerciseRef,
    GeneratedWorkout,
    GeneratedWorkoutItem,
} from '@kinevo/shared/types/prescription'

import { VOLUME_RANGES, FREQUENCY_STRUCTURE } from '@kinevo/shared/types/prescription'

import {
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SECONDARY_VOLUME_FACTORS,
    REP_RANGES_BY_GOAL,
    REST_SECONDS,
    calcExercisesPerWorkout,
} from '../constants'

import {
    SLOT_TEMPLATES,
    matchesSlotPattern,
    getSlotLabels,
} from '../slot-templates'
import type { WorkoutSlot } from '../slot-templates'

import { getContributions } from '../contribution-matrix'
import { buildConstraints } from '../constraints-engine'
import type { PrescriptionConstraints } from '../constraints-engine'
import type { EnrichedStudentContext } from '../context-enricher'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Config
// ============================================================================

const TOTAL_PROGRAMS = 100
const REPORT_PATH = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'VOLUME_V3_STRESS_TEST.md')

// ============================================================================
// Volume V2 Core — replicated from program-builder.ts
// ============================================================================

interface VolumeTracker {
    volume: Record<string, number>
    primary: Record<string, number>
}

function createVolumeTracker(): VolumeTracker {
    return { volume: {}, primary: {} }
}

function forecastMaxSets(
    exercise: PrescriptionExerciseRef,
    targetGroup: string,
    slotMinSets: number,
    slotMaxSets: number,
    workoutFreq: number,
    tracker: VolumeTracker,
    budget: Record<string, { min: number; max: number }>,
): number {
    let maxAllowed = slotMaxSets

    const primaryUsed = tracker.volume[targetGroup] || 0
    const primaryBudget = budget[targetGroup]
    if (primaryBudget) {
        const primaryRoom = Math.max(0, primaryBudget.max - primaryUsed)
        maxAllowed = Math.min(maxAllowed, Math.ceil(primaryRoom / workoutFreq))
    }

    const contributions = getContributions(targetGroup, exercise.movement_pattern, exercise.is_compound)
    for (const { group, weight } of contributions) {
        const secUsed = tracker.volume[group] || 0
        const secBudget = budget[group]
        if (secBudget && weight > 0) {
            const secRoom = Math.max(0, secBudget.max - secUsed)
            const maxBySecondary = Math.ceil(secRoom / (workoutFreq * weight))
            maxAllowed = Math.min(maxAllowed, maxBySecondary)
        }
    }

    return Math.max(slotMinSets, maxAllowed)
}

function commitVolume(
    exercise: PrescriptionExerciseRef,
    sets: number,
    targetGroup: string,
    workoutFreq: number,
    tracker: VolumeTracker,
): void {
    const weeklySets = sets * workoutFreq
    tracker.volume[targetGroup] = (tracker.volume[targetGroup] || 0) + weeklySets
    tracker.primary[targetGroup] = (tracker.primary[targetGroup] || 0) + weeklySets
    const contributions = getContributions(targetGroup, exercise.movement_pattern, exercise.is_compound)
    for (const { group, weight } of contributions) {
        let secSets = Math.round(weeklySets * weight)
        if (secSets > 0) {
            // V3: secondary cap — cannot exceed 60% of group's primary volume.
            // If no primary volume yet, secondary flows uncapped.
            const groupPrimary = tracker.primary[group] || 0
            if (groupPrimary > 0) {
                const secondaryCap = Math.round(groupPrimary * 0.6)
                const currentSecondary = (tracker.volume[group] || 0) - groupPrimary
                const headroom = Math.max(0, secondaryCap - currentSecondary)
                secSets = Math.min(secSets, headroom)
            }
            if (secSets > 0) {
                tracker.volume[group] = (tracker.volume[group] || 0) + secSets
            }
        }
    }
}

function distributeSetsForSlotV2(
    slot: WorkoutSlot,
    budget: Record<string, { min: number; max: number }>,
    tracker: VolumeTracker,
    remainingOccurrences: Record<string, number>,
    workoutFreq: number,
    forecastCeiling: number,
): number {
    const group = slot.target_group
    const groupBudget = budget[group]
    if (!groupBudget) return slot.min_sets

    const currentVolume = tracker.volume[group] || 0
    const target = Math.round(groupBudget.min + (groupBudget.max - groupBudget.min) * 0.7)
    const remaining = Math.max(0, target - currentVolume)
    const remOcc = remainingOccurrences[group] || 1
    const perOccurrence = Math.ceil(remaining / remOcc)
    const sets = Math.max(slot.min_sets, Math.min(slot.max_sets, perOccurrence, forecastCeiling))
    remainingOccurrences[group] = Math.max(0, remOcc - 1)
    return sets
}

const DYNAMIC_SLOT_ELIGIBLE_GROUPS = ['Abdominais', 'Panturrilha', 'Adutores', 'Trapézio', 'Antebraço']

function generateDynamicSlots(
    budget: Record<string, { min: number; max: number }>,
    tracker: VolumeTracker,
    coveredGroups: Set<string>,
    remainingSlots: number,
): WorkoutSlot[] {
    const slots: WorkoutSlot[] = []
    const deficits = DYNAMIC_SLOT_ELIGIBLE_GROUPS
        .filter(g => budget[g] && !coveredGroups.has(g))
        .map(g => ({
            group: g,
            deficit: (budget[g]?.min || 0) - (tracker.volume[g] || 0),
            threshold: (budget[g]?.min || 0) * 0.85,
            current: tracker.volume[g] || 0,
        }))
        .filter(d => d.current < d.threshold)
        .sort((a, b) => b.deficit - a.deficit)

    const maxSlots = Math.min(1, remainingSlots)
    for (const { group } of deficits) {
        if (slots.length >= maxSlots) break
        slots.push({
            movement_pattern: 'isolation', target_group: group, function: 'accessory',
            min_sets: 2, max_sets: 3, priority: 90, optional: true, prefer_compound: false,
        })
    }
    return slots
}

function getTemplateKey(splitType: string, label: string): string {
    if (label.startsWith('Push')) return `${splitType}:push`
    if (label.startsWith('Pull')) return `${splitType}:pull`
    if (label.startsWith('Upper')) return `${splitType}:upper`
    if (label === 'Legs A') return `${splitType}:legs_a`
    if (label === 'Legs B') return `${splitType}:legs_b`
    return `${splitType}:${label}`
}

function computeSlotScore(
    exercise: PrescriptionExerciseRef,
    slot: WorkoutSlot,
    usedPatternsInWorkout: Set<string>,
    highFatigueUsed: boolean,
    weeklyUsedIds: Set<string>,
    sameLabelUsedIds: Set<string>,
    level: TrainingLevel,
): number {
    let score = 50
    const levelMap: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
    if (levelMap[exercise.difficulty_level] === levelMap[level]) score += 10
    if (exercise.is_primary_movement) score += 10
    if (slot.function === 'main' && exercise.is_compound) score += 5
    if (exercise.fatigue_class === 'high' && exercise.is_compound && highFatigueUsed) score -= 20
    const patternKey = `${exercise.movement_pattern || 'isolation'}:${slot.target_group}`
    if (usedPatternsInWorkout.has(patternKey)) score -= 15
    if (weeklyUsedIds.has(exercise.id)) score -= 25
    if (sameLabelUsedIds.has(exercise.id)) score -= 60
    return Math.max(0, Math.min(100, score))
}

// ============================================================================
// Exercise Library — 53 exercises
// ============================================================================

let exerciseCounter = 0
function mkEx(overrides: Partial<PrescriptionExerciseRef>): PrescriptionExerciseRef {
    return {
        id: `ex-${++exerciseCounter}`, name: 'Exercício', muscle_group_names: ['Peito'],
        equipment: null, is_compound: false, difficulty_level: 'intermediate',
        is_primary_movement: false, session_position: 'middle', movement_pattern: null,
        movement_pattern_family: null, fatigue_class: 'moderate', prescription_notes: null,
        ...overrides,
    }
}

function buildExerciseLibrary(): PrescriptionExerciseRef[] {
    exerciseCounter = 0
    return [
        // PEITO (8)
        mkEx({ name: 'Supino Reto Barra', muscle_group_names: ['Peito','Ombros','Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Supino Inclinado Halter', muscle_group_names: ['Peito','Ombros'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Supino Reto Halter', muscle_group_names: ['Peito','Ombros','Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Supino Declinado', muscle_group_names: ['Peito','Tríceps'], is_compound: true, session_position: 'first', movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'moderate', equipment: 'barbell' }),
        mkEx({ name: 'Crucifixo Halteres', muscle_group_names: ['Peito'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        mkEx({ name: 'Crossover', muscle_group_names: ['Peito'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'cable' }),
        mkEx({ name: 'Peck Deck', muscle_group_names: ['Peito'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),
        mkEx({ name: 'Chest Press', muscle_group_names: ['Peito','Tríceps'], is_compound: true, movement_pattern: 'push_horizontal', movement_pattern_family: 'horizontal_push', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),
        // COSTAS (7)
        mkEx({ name: 'Puxada Frontal', muscle_group_names: ['Costas','Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'moderate', equipment: 'cable' }),
        mkEx({ name: 'Barra Fixa', muscle_group_names: ['Costas','Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'high', equipment: 'bodyweight', difficulty_level: 'advanced' }),
        mkEx({ name: 'Remada Curvada', muscle_group_names: ['Costas','Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Remada Unilateral', muscle_group_names: ['Costas','Bíceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Pulldown Supinado', muscle_group_names: ['Costas','Bíceps'], is_compound: true, movement_pattern: 'pull_vertical', movement_pattern_family: 'vertical_pull', fatigue_class: 'low', equipment: 'cable' }),
        mkEx({ name: 'Remada Baixa', muscle_group_names: ['Costas'], is_compound: true, movement_pattern: 'pull_horizontal', movement_pattern_family: 'horizontal_pull', fatigue_class: 'low', equipment: 'cable' }),
        mkEx({ name: 'Pullover Máquina', muscle_group_names: ['Costas'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'machine' }),
        // OMBROS (5)
        mkEx({ name: 'Desenvolvimento Halteres', muscle_group_names: ['Ombros','Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Press Militar Barra', muscle_group_names: ['Ombros','Tríceps'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Desenvolvimento Máquina', muscle_group_names: ['Ombros'], is_compound: true, movement_pattern: 'push_vertical', movement_pattern_family: 'vertical_push', fatigue_class: 'low', equipment: 'machine', difficulty_level: 'beginner' }),
        mkEx({ name: 'Elevação Lateral', muscle_group_names: ['Ombros'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        mkEx({ name: 'Elevação Frontal', muscle_group_names: ['Ombros'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', equipment: 'dumbbell' }),
        // QUADRÍCEPS (6)
        mkEx({ name: 'Agachamento Livre', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Leg Press 45', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'leg_press' }),
        mkEx({ name: 'Passada Halteres', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Avanço Búlgaro', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'high', equipment: 'dumbbell', difficulty_level: 'advanced' }),
        mkEx({ name: 'Agachamento Goblet', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, movement_pattern: 'squat', movement_pattern_family: 'knee_dominant', fatigue_class: 'low', equipment: 'dumbbell', difficulty_level: 'beginner' }),
        mkEx({ name: 'Avanço Smith', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'moderate', equipment: 'smith' }),
        mkEx({ name: 'Passada Barra', muscle_group_names: ['Quadríceps','Glúteo'], is_compound: true, movement_pattern: 'lunge', movement_pattern_family: 'knee_dominant', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Cadeira Extensora', muscle_group_names: ['Quadríceps'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        // POSTERIOR (5)
        mkEx({ name: 'Stiff Barra', muscle_group_names: ['Posterior de Coxa','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'high', equipment: 'barbell' }),
        mkEx({ name: 'Stiff Halteres', muscle_group_names: ['Posterior de Coxa','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'moderate', equipment: 'dumbbell' }),
        mkEx({ name: 'Levantamento Terra', muscle_group_names: ['Posterior de Coxa','Costas','Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'high', equipment: 'barbell', difficulty_level: 'advanced' }),
        mkEx({ name: 'Mesa Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        mkEx({ name: 'Cadeira Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        // GLÚTEO (3)
        mkEx({ name: 'Hip Thrust', muscle_group_names: ['Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first', movement_pattern: 'hinge', movement_pattern_family: 'hip_dominant', fatigue_class: 'moderate', equipment: 'barbell' }),
        mkEx({ name: 'Glúteo Máquina', muscle_group_names: ['Glúteo'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        mkEx({ name: 'Abdução Quadril', muscle_group_names: ['Glúteo'], is_compound: false, movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', equipment: 'machine' }),
        // BÍCEPS (3)
        mkEx({ name: 'Rosca Direta Barra', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Rosca Alternada', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Rosca Martelo', muscle_group_names: ['Bíceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        // TRÍCEPS (3)
        mkEx({ name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Tríceps Testa', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low' }),
        mkEx({ name: 'Tríceps Corda', muscle_group_names: ['Tríceps'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        // PANTURRILHA (2)
        mkEx({ name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Panturrilha Sentado', muscle_group_names: ['Panturrilha'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', difficulty_level: 'beginner' }),
        // ABDOMINAIS (2)
        mkEx({ name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Prancha', muscle_group_names: ['Abdominais'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', difficulty_level: 'beginner' }),
        // TRAPÉZIO (2)
        mkEx({ name: 'Encolhimento Barra', muscle_group_names: ['Trapézio'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        mkEx({ name: 'Encolhimento Halteres', muscle_group_names: ['Trapézio'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_upper', fatigue_class: 'low', difficulty_level: 'beginner' }),
        // ADUTORES (1)
        mkEx({ name: 'Adução Quadril', muscle_group_names: ['Adutores'], is_compound: false, session_position: 'last', movement_pattern: 'isolation', movement_pattern_family: 'isolation_lower', fatigue_class: 'low', difficulty_level: 'beginner' }),
    ]
}

// ============================================================================
// Randomization
// ============================================================================

const LEVELS: TrainingLevel[] = ['beginner', 'intermediate', 'advanced']
const GOALS: PrescriptionGoal[] = ['hypertrophy', 'weight_loss', 'performance', 'health']
const EMPHASIS_OPTIONS = ['Glúteo', 'Peito', 'Costas', 'Ombros', 'Posterior de Coxa', '']
function randomInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a }
function randomPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomDays(n: number): number[] { return [0,1,2,3,4,5,6].sort(() => Math.random() - 0.5).slice(0, n).sort((a,b) => a - b) }

function makeProfile(frequency: number, level: TrainingLevel, goal: PrescriptionGoal, duration: number) {
    return {
        id: 'p', student_id: 's', trainer_id: 't', training_level: level, goal,
        available_days: randomDays(frequency), session_duration_minutes: duration,
        available_equipment: ['academia_completa'] as string[], favorite_exercise_ids: [] as string[],
        disliked_exercise_ids: [] as string[], medical_restrictions: [] as any[],
        ai_mode: 'copilot' as const, adherence_rate: null, avg_session_duration_minutes: null,
        last_calculated_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
}

function makeContext(): EnrichedStudentContext {
    return {
        student_name: 'Sim', trainer_name: 'Sim',
        session_patterns: { total_sessions_4w: 12, completed_sessions_4w: 10, avg_duration_minutes: 55, most_active_days: [1,3,5] },
        load_progression: [], previous_exercise_ids: [], muscle_group_frequency: {}, training_age_weeks: 16,
    }
}

// ============================================================================
// Slot Builder Simulation (V2 logic)
// ============================================================================

interface SimResult {
    workouts: GeneratedWorkout[]
    tracker: VolumeTracker
    dynamicSlotsUsed: number
}

function groupExercisesByMuscle(exercises: PrescriptionExerciseRef[]): Map<string, PrescriptionExerciseRef[]> {
    const map = new Map<string, PrescriptionExerciseRef[]>()
    for (const ex of exercises) {
        for (const g of ex.muscle_group_names) {
            const l = map.get(g) || []
            l.push(ex)
            map.set(g, l)
        }
    }
    return map
}

function runSimulation(
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    profile: { available_days: number[]; training_level: TrainingLevel; session_duration_minutes: number; goal: string },
): SimResult {
    const splitType = constraints.split_type
    const level = profile.training_level
    const goal = profile.goal as PrescriptionGoal
    const frequency = profile.available_days.length
    const byMuscleGroup = groupExercisesByMuscle(exercises)

    const slotLabels = getSlotLabels(splitType)
    if (slotLabels.length === 0) return { workouts: [], tracker: createVolumeTracker(), dynamicSlotsUsed: 0 }

    const workoutCount = Math.min(frequency, slotLabels.length)
    const templates = SLOT_TEMPLATES[splitType]

    // Group frequency
    const groupFrequency: Record<string, number> = {}
    for (let i = 0; i < workoutCount; i++) {
        const slots = templates[slotLabels[i]]
        if (!slots) continue
        const seen = new Set<string>()
        for (const slot of slots) {
            if (!seen.has(slot.target_group)) {
                seen.add(slot.target_group)
                groupFrequency[slot.target_group] = (groupFrequency[slot.target_group] || 0) + 1
            }
        }
    }

    const tracker = createVolumeTracker()
    const remainingOccurrences = { ...groupFrequency }
    const workouts: GeneratedWorkout[] = []
    const weeklyUsedIds = new Set<string>()
    const workoutExerciseIds: Record<string, Set<string>> = {}
    let totalDynamicSlots = 0

    for (let i = 0; i < workoutCount; i++) {
        const label = slotLabels[i]
        const slots = templates[label]
        if (!slots) continue

        const scheduledDays = profile.available_days[i] !== undefined ? [profile.available_days[i]] : []
        const freq = Math.max(1, scheduledDays.length)

        // Same-label used IDs
        const sameLabelUsedIds = new Set<string>()
        const templateKey = getTemplateKey(splitType, label)
        for (const [prevLabel, ids] of Object.entries(workoutExerciseIds)) {
            if (getTemplateKey(splitType, prevLabel) === templateKey) {
                for (const id of ids) sameLabelUsedIds.add(id)
            }
        }

        const { max: exerciseLimit } = calcExercisesPerWorkout(profile.session_duration_minutes, level, workoutCount)
        const maxExercises = Math.min(exerciseLimit, constraints.exercises_per_session || exerciseLimit)

        const items: GeneratedWorkoutItem[] = []
        const usedInWorkout = new Set<string>()
        const usedPatternsInWorkout = new Set<string>()
        let highFatigueUsed = false
        let itemIndex = 0
        const coveredGroups = new Set<string>()

        function fillSlot(slot: WorkoutSlot): void {
            if (items.length >= maxExercises) return

            let candidates = byMuscleGroup.get(slot.target_group) || []
            const DUPLICATE_EXEMPT = new Set(['Panturrilha', 'Abdominais'])
            candidates = candidates.filter(ex => {
                if (usedInWorkout.has(ex.id)) return false
                // V3: hard duplicate rule — max 1 per exercise per program (except calves/abs)
                if (!DUPLICATE_EXEMPT.has(slot.target_group) && weeklyUsedIds.has(ex.id)) return false
                return matchesSlotPattern(ex.movement_pattern, ex.movement_pattern_family, slot.movement_pattern)
            })
            if (candidates.length === 0) return

            // Score
            const scored = candidates.map(ex => ({
                exercise: ex,
                score: computeSlotScore(ex, slot, usedPatternsInWorkout, highFatigueUsed, weeklyUsedIds, sameLabelUsedIds, level),
            }))
            scored.sort((a, b) => b.score - a.score)
            const bestScore = scored[0].score
            const top = scored.filter(s => s.score >= bestScore - 5)
            const pick = top[Math.floor(Math.random() * top.length)].exercise

            // Forecast + allocate
            const forecastCeiling = forecastMaxSets(pick, slot.target_group, slot.min_sets, slot.max_sets, freq, tracker, constraints.volume_budget)
            const sets = distributeSetsForSlotV2(slot, constraints.volume_budget, tracker, remainingOccurrences, freq, forecastCeiling)

            const isCompound = pick.is_compound
            items.push({
                exercise_id: pick.id, exercise_name: pick.name,
                exercise_muscle_group: slot.target_group, exercise_equipment: pick.equipment,
                sets, reps: isCompound ? REP_RANGES_BY_GOAL[goal].compound : REP_RANGES_BY_GOAL[goal].isolation,
                rest_seconds: isCompound ? REST_SECONDS.compound[goal] : REST_SECONDS.isolation[goal],
                notes: null, substitute_exercise_ids: [], order_index: itemIndex++,
                exercise_function: slot.function,
            })

            usedInWorkout.add(pick.id)
            weeklyUsedIds.add(pick.id)
            coveredGroups.add(slot.target_group)
            commitVolume(pick, sets, slot.target_group, freq, tracker)

            const pattern = pick.movement_pattern || 'isolation'
            usedPatternsInWorkout.add(`${pattern}:${slot.target_group}`)
            if (pick.fatigue_class === 'high' && pick.is_compound) highFatigueUsed = true
        }

        // Template slots
        const requiredSlots = slots.filter(s => !s.optional)
        const optionalSlots = slots.filter(s => s.optional)
        const optionalCount = Math.max(0, maxExercises - requiredSlots.length)
        const activeSlots = [...requiredSlots, ...optionalSlots.slice(0, optionalCount)]
        activeSlots.sort((a, b) => a.priority - b.priority)
        for (const slot of activeSlots) fillSlot(slot)

        // Dynamic slots
        const remaining = maxExercises - items.length
        if (remaining > 0) {
            const dynSlots = generateDynamicSlots(constraints.volume_budget, tracker, coveredGroups, remaining)
            totalDynamicSlots += dynSlots.length
            for (const ds of dynSlots) fillSlot(ds)
        }

        workouts.push({ name: `Treino ${String.fromCharCode(65 + i)} — ${label}`, order_index: i, scheduled_days: scheduledDays, items })
        workoutExerciseIds[label] = new Set(items.map(it => it.exercise_id))
    }

    return { workouts, tracker, dynamicSlotsUsed: totalDynamicSlots }
}

// ============================================================================
// Metrics
// ============================================================================

interface ProgramMetrics {
    index: number; level: TrainingLevel; goal: PrescriptionGoal; frequency: number; duration: number; emphasis: string[]
    volumePerGroup: Record<string, number>
    budgetCompliance: Record<string, 'within' | 'over' | 'under' | 'no_budget'>
    duplicateExercises: string[]
    movementPatternDist: Record<string, number>
    workoutFatigueScores: number[]
    totalExercises: number; totalSets: number; dynamicSlotsUsed: number
}

const FATIGUE_WEIGHTS: Record<string, number> = { high: 3, moderate: 2, low: 1 }

function analyze(
    result: SimResult, exercises: PrescriptionExerciseRef[], constraints: PrescriptionConstraints,
    index: number, level: TrainingLevel, goal: PrescriptionGoal, frequency: number, duration: number, emphasis: string[],
): ProgramMetrics {
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))
    const volumePerGroup = { ...result.tracker.volume }

    const budgetCompliance: Record<string, string> = {}
    for (const group of [...PRIMARY_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]) {
        const budget = constraints.volume_budget[group]
        const actual = volumePerGroup[group] || 0
        if (!budget) budgetCompliance[group] = 'no_budget'
        else if (actual > budget.max) budgetCompliance[group] = 'over'
        else if (actual < budget.min && actual > 0) budgetCompliance[group] = 'under'
        else budgetCompliance[group] = 'within'
    }

    const exerciseIds = new Map<string, string[]>()
    for (const w of result.workouts) {
        for (const item of w.items) {
            const l = exerciseIds.get(item.exercise_id) || []
            l.push(w.name)
            exerciseIds.set(item.exercise_id, l)
        }
    }
    const duplicateExercises: string[] = []
    for (const [id, names] of exerciseIds) {
        if (names.length > 1) duplicateExercises.push(`${exerciseMap.get(id)?.name || id} (${names.join(', ')})`)
    }

    const movementPatternDist: Record<string, number> = {}
    for (const w of result.workouts) {
        for (const item of w.items) {
            const p = exerciseMap.get(item.exercise_id)?.movement_pattern || 'unknown'
            movementPatternDist[p] = (movementPatternDist[p] || 0) + 1
        }
    }

    const workoutFatigueScores = result.workouts.map(w => {
        let s = 0
        for (const item of w.items) { s += (FATIGUE_WEIGHTS[exerciseMap.get(item.exercise_id)?.fatigue_class || 'moderate'] || 2) * item.sets }
        return s
    })

    return {
        index, level, goal, frequency, duration, emphasis,
        volumePerGroup, budgetCompliance: budgetCompliance as any,
        duplicateExercises, movementPatternDist, workoutFatigueScores,
        totalExercises: result.workouts.reduce((s, w) => s + w.items.length, 0),
        totalSets: result.workouts.reduce((s, w) => s + w.items.reduce((ss, i) => ss + i.sets, 0), 0),
        dynamicSlotsUsed: result.dynamicSlotsUsed,
    }
}

// ============================================================================
// Main
// ============================================================================

function main() {
    console.log('='.repeat(70))
    console.log('Kinevo Volume V3 Stress Test — 100 Randomized Programs')
    console.log('='.repeat(70))

    const exercises = buildExerciseLibrary()
    console.log(`Exercise library: ${exercises.length} exercises\n`)

    const allMetrics: ProgramMetrics[] = []
    const examplePrograms: { metrics: ProgramMetrics; result: SimResult }[] = []

    for (let i = 0; i < TOTAL_PROGRAMS; i++) {
        const frequency = randomInt(3, 6)
        const level = randomPick(LEVELS)
        const goal = randomPick(GOALS)
        const duration = randomInt(45, 75)
        const emphasis = randomPick(EMPHASIS_OPTIONS)
        const emphasisArr = emphasis ? [emphasis] : []

        const profile = makeProfile(frequency, level, goal, duration)
        const context = makeContext()

        const trainerAnswers = emphasisArr.length > 0
            ? [{ question_id: 'muscle_emphasis', answer: `${emphasisArr[0]} (mais volume)` }]
            : []
        const constraints = buildConstraints(profile as any, context, trainerAnswers as any)

        const result = runSimulation(exercises, constraints, profile)
        const metrics = analyze(result, exercises, constraints, i, level, goal, frequency, duration, emphasisArr)
        allMetrics.push(metrics)

        if (i < 3) examplePrograms.push({ metrics, result })
    }

    console.log(`Generated ${allMetrics.length}/${TOTAL_PROGRAMS} programs\n`)

    // ── Aggregate ──
    let totalPrimaryChecks = 0, withinCount = 0, overCount = 0, underCount = 0
    for (const m of allMetrics) {
        for (const g of PRIMARY_MUSCLE_GROUPS) {
            const s = m.budgetCompliance[g]
            if (s === 'no_budget') continue
            totalPrimaryChecks++
            if (s === 'within') withinCount++
            else if (s === 'over') overCount++
            else if (s === 'under') underCount++
        }
    }

    const withDuplicates = allMetrics.filter(m => m.duplicateExercises.length > 0).length
    let missingGroupPrograms = 0
    for (const m of allMetrics) {
        for (const g of PRIMARY_MUSCLE_GROUPS) {
            if ((m.volumePerGroup[g] || 0) === 0) { missingGroupPrograms++; break }
        }
    }

    const allFatigue = allMetrics.flatMap(m => m.workoutFatigueScores)
    const avgFatigue = allFatigue.reduce((s, v) => s + v, 0) / allFatigue.length
    const maxFatigue = Math.max(...allFatigue)
    const totalDynamic = allMetrics.reduce((s, m) => s + m.dynamicSlotsUsed, 0)

    const volumeStats: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    for (const g of [...PRIMARY_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]) {
        const vals = allMetrics.map(m => m.volumePerGroup[g] || 0).filter(v => v > 0)
        if (vals.length > 0) {
            volumeStats[g] = {
                avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10,
                min: Math.min(...vals), max: Math.max(...vals), count: vals.length,
            }
        }
    }

    // ── Print ──
    console.log('='.repeat(70))
    console.log('AGGREGATED METRICS')
    console.log('='.repeat(70))

    console.log(`\n## Budget Compliance (Primary Groups)`)
    console.log(`  Within target: ${withinCount}/${totalPrimaryChecks} (${(withinCount/totalPrimaryChecks*100).toFixed(1)}%)`)
    console.log(`  Over budget:   ${overCount}/${totalPrimaryChecks} (${(overCount/totalPrimaryChecks*100).toFixed(1)}%)`)
    console.log(`  Under budget:  ${underCount}/${totalPrimaryChecks} (${(underCount/totalPrimaryChecks*100).toFixed(1)}%)`)

    console.log(`\n## Duplicate Exercises`)
    console.log(`  Programs with duplicates: ${withDuplicates}/${allMetrics.length} (${(withDuplicates/allMetrics.length*100).toFixed(1)}%)`)

    console.log(`\n## Missing Primary Muscle Groups`)
    console.log(`  Programs with missing groups: ${missingGroupPrograms}/${allMetrics.length} (${(missingGroupPrograms/allMetrics.length*100).toFixed(1)}%)`)

    console.log(`\n## Fatigue Scores`)
    console.log(`  Average per session: ${avgFatigue.toFixed(1)}`)
    console.log(`  Max single session:  ${maxFatigue}`)

    console.log(`\n## Dynamic Slots`)
    console.log(`  Total: ${totalDynamic} across ${allMetrics.length} programs (avg ${(totalDynamic/allMetrics.length).toFixed(1)}/program)`)

    console.log(`\n## Volume Distribution (avg sets/week)`)
    console.log(`${'Group'.padEnd(22)} ${'Avg'.padStart(6)} ${'Min'.padStart(6)} ${'Max'.padStart(6)} ${'N'.padStart(5)}`)
    console.log('-'.repeat(50))
    for (const g of [...PRIMARY_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]) {
        const s = volumeStats[g]
        if (s) console.log(`${g.padEnd(22)} ${String(s.avg).padStart(6)} ${String(s.min).padStart(6)} ${String(s.max).padStart(6)} ${String(s.count).padStart(5)}`)
    }

    // ── Examples ──
    console.log('\n' + '='.repeat(70))
    console.log('EXAMPLE PROGRAMS')
    console.log('='.repeat(70))

    for (let i = 0; i < examplePrograms.length; i++) {
        const { metrics: m, result: r } = examplePrograms[i]
        console.log(`\n### Example ${i+1}: ${m.level} / ${m.goal} / ${m.frequency}x / ${m.duration}min${m.emphasis.length ? ` / emphasis: ${m.emphasis[0]}` : ''}`)
        console.log(`Total: ${m.totalExercises} exercises, ${m.totalSets} sets, ${m.dynamicSlotsUsed} dynamic slots`)

        for (const w of r.workouts) {
            console.log(`\n  ${w.name} [days: ${w.scheduled_days.join(',')}]`)
            for (const item of w.items) {
                const ref = exercises.find(e => e.id === item.exercise_id)
                console.log(`    ${String(item.order_index + 1).padStart(2)}. ${item.exercise_name.padEnd(26)} ${item.exercise_muscle_group.padEnd(18)} ${item.sets}×${item.reps.padEnd(6)} [${item.exercise_function}] ${ref?.movement_pattern || '-'} (${ref?.fatigue_class || '?'})`)
            }
        }

        console.log(`\n  Weekly Volume:`)
        for (const [g, v] of Object.entries(m.volumePerGroup).sort((a,b) => b[1] - a[1])) {
            const flag = m.budgetCompliance[g] === 'over' ? ' !! OVER' : m.budgetCompliance[g] === 'under' ? ' !! UNDER' : ''
            console.log(`    ${g.padEnd(22)} ${String(v).padStart(4)} sets${flag}`)
        }
        console.log(`  Duplicates: ${m.duplicateExercises.length === 0 ? 'None' : m.duplicateExercises.join('; ')}`)
        console.log(`  Fatigue: ${m.workoutFatigueScores.join(', ')}`)
    }

    // ── Write report ──
    const lines: string[] = []
    lines.push('# Kinevo Volume V3 — Stress Test Report')
    lines.push(`_Generated: ${new Date().toISOString()} | Programs: ${allMetrics.length} | Exercises: ${exercises.length}_\n`)
    lines.push('## Budget Compliance (Primary Groups)\n')
    lines.push(`| Metric | Count | % |`)
    lines.push(`|--------|-------|---|`)
    lines.push(`| Within target | ${withinCount}/${totalPrimaryChecks} | ${(withinCount/totalPrimaryChecks*100).toFixed(1)}% |`)
    lines.push(`| Over budget | ${overCount}/${totalPrimaryChecks} | ${(overCount/totalPrimaryChecks*100).toFixed(1)}% |`)
    lines.push(`| Under budget | ${underCount}/${totalPrimaryChecks} | ${(underCount/totalPrimaryChecks*100).toFixed(1)}% |`)
    lines.push('')
    lines.push('## Quality Metrics\n')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Duplicate exercises | ${withDuplicates}/${allMetrics.length} (${(withDuplicates/allMetrics.length*100).toFixed(1)}%) |`)
    lines.push(`| Missing primary groups | ${missingGroupPrograms}/${allMetrics.length} (${(missingGroupPrograms/allMetrics.length*100).toFixed(1)}%) |`)
    lines.push(`| Avg fatigue/session | ${avgFatigue.toFixed(1)} |`)
    lines.push(`| Max fatigue | ${maxFatigue} |`)
    lines.push(`| Dynamic slots total | ${totalDynamic} (avg ${(totalDynamic/allMetrics.length).toFixed(1)}/program) |`)
    lines.push('')
    lines.push('## Volume Distribution\n')
    lines.push(`| Group | Avg | Min | Max | N |`)
    lines.push(`|-------|-----|-----|-----|---|`)
    for (const g of [...PRIMARY_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]) {
        const s = volumeStats[g]
        if (s) lines.push(`| ${g} | ${s.avg} | ${s.min} | ${s.max} | ${s.count} |`)
    }

    writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8')
    console.log(`\nReport: ${REPORT_PATH}`)
}

main()
