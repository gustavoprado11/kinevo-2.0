// ============================================================================
// Kinevo Prescription Engine — Constants
// ============================================================================
// Re-exports methodology constants from shared, plus engine-internal constants.

export {
    VOLUME_RANGES,
    FREQUENCY_STRUCTURE,
    PERIODIZATION_BLOCK,
    PRESCRIPTION_CONSTRAINTS,
    EQUIPMENT_OPTIONS,
} from '@kinevo/shared/types/prescription'

import type { TrainingLevel } from '@kinevo/shared/types/prescription'

/** Current engine version — stored in input_snapshot for reproducibility. */
export const ENGINE_VERSION = '1.0.0'

/** Default program duration in weeks (one periodization block). */
export const DEFAULT_DURATION_WEEKS = 4

// ============================================================================
// Muscle Group Classification (exact names from DB muscle_groups table)
// ============================================================================

/**
 * Primary muscle groups — receive weekly volume budget from VOLUME_RANGES.
 * These are the large groups that drive compound movements.
 * Names match muscle_groups.name in the database EXACTLY.
 */
export const PRIMARY_MUSCLE_GROUPS: readonly string[] = [
    'Peito', 'Costas', 'Ombros',
    'Quadríceps', 'Posterior de Coxa', 'Glúteo',
]

/**
 * Small / isolation muscle groups — limited by exercise count per week, not volume.
 * Names match muscle_groups.name in the database EXACTLY.
 */
export const SMALL_MUSCLE_GROUPS: readonly string[] = [
    'Bíceps', 'Tríceps', 'Adutores', 'Panturrilha', 'Abdominais',
    'Antebraço', 'Trapézio',
]

/**
 * Maximum exercises per week for each small muscle group, by training level.
 * Beginners: max 2 exercises/week. Intermediates: 3. Advanced: 4.
 */
export const SMALL_GROUP_EXERCISE_LIMITS: Record<TrainingLevel, number> = {
    beginner: 2,
    intermediate: 3,
    advanced: 4,
}

/**
 * Volume reduction factors for secondary (small) muscle groups.
 * Applied to VOLUME_RANGES to compute the secondary group budget.
 * Differentiated by group size and recovery characteristics.
 */
export const SECONDARY_VOLUME_FACTORS: Record<string, number> = {
    'Bíceps': 0.65,
    'Tríceps': 0.65,
    'Panturrilha': 0.45,
    'Abdominais': 0.45,
    'Oblíquos': 0.30,
    'Adutores': 0.35,
    'Trapézio': 0.35,
    'Antebraço': 0.20,
}

// ============================================================================
// Dynamic Exercise Limits per Workout
// ============================================================================

/**
 * Calculates the min/max exercises per workout based on session duration,
 * training level, and weekly frequency.
 *
 * Logic:
 * - Base capacity: 1 exercise ≈ 8-10 min (sets + rest) → sessionDuration / 9
 * - Higher frequency → fewer exercises per session (volume is distributed)
 * - Cap at 10 exercises max regardless of session length
 */
export function calcExercisesPerWorkout(
    sessionDurationMin: number,
    _trainingLevel: TrainingLevel,
    weeklyFrequency: number,
): { min: number; max: number } {
    // Base: 1 exercise ≈ 8-10 minutes (sets + rest)
    const baseCapacity = Math.floor(sessionDurationMin / 9)

    // Higher frequency = less per session (volume distributed across week)
    const frequencyPenalty = weeklyFrequency >= 5 ? 2 : weeklyFrequency >= 4 ? 1 : 0

    const max = Math.min(baseCapacity - frequencyPenalty, 10)
    const min = Math.max(4, max - 2)

    return { min, max }
}

// ============================================================================
// Compound Secondary Volume Weights
// ============================================================================

/**
 * When a compound exercise targets multiple muscle groups, the secondary groups
 * receive fractional volume credit (not full 1.0).
 *
 * Key = primary target group (first in muscle_group_names)
 * Value = map of secondary group → weight (0.0–1.0)
 *
 * Only the FIRST group in muscle_group_names gets 1.0 (full credit).
 * All subsequent groups use the weight from this map.
 * If a group is not listed here, it gets 0.0 (no secondary credit).
 *
 * Based on EMG activation research and practical coaching consensus.
 */
export const COMPOUND_SECONDARY_WEIGHTS: Record<string, Record<string, number>> = {
    // Peito compounds (Supino) → moderate Ombros, low Tríceps
    'Peito': { 'Ombros': 0.3, 'Tríceps': 0.5 },
    // Costas compounds (Remada, Puxada) → moderate Bíceps
    'Costas': { 'Bíceps': 0.5 },
    // Ombros compounds (Desenvolvimento) → low Tríceps
    'Ombros': { 'Tríceps': 0.4 },
    // Quadríceps compounds (Agachamento, Leg Press) → moderate Glúteo
    'Quadríceps': { 'Glúteo': 0.5 },
    // Posterior de Coxa compounds (Stiff, Terra) → moderate Glúteo, low Costas
    'Posterior de Coxa': { 'Glúteo': 0.5, 'Costas': 0.2 },
    // Glúteo compounds (Hip Thrust) → low Posterior
    'Glúteo': { 'Posterior de Coxa': 0.3 },
}

// ============================================================================
// Compound Exercise Patterns (exact DB group names as keys)
// ============================================================================

/**
 * Compound exercise identifiers by muscle group.
 * Used by the heuristic builder to satisfy the "at least 1 compound per day" rule.
 * Keys are muscle group names (matching muscle_groups.name in DB).
 * Values are common compound exercise name substrings for matching.
 */
export const COMPOUND_EXERCISE_PATTERNS: Record<string, readonly string[]> = {
    Peito: ['supino', 'press', 'flexão'],
    Costas: ['remada', 'puxada', 'barra fixa', 'pulldown', 'levantamento terra'],
    Quadríceps: ['agachamento', 'leg press', 'passada', 'lunge', 'avanço', 'búlgaro'],
    'Posterior de Coxa': ['stiff', 'terra', 'mesa flexora', 'leg curl'],
    Glúteo: ['hip thrust', 'agachamento', 'terra', 'stiff', 'búlgaro', 'passada'],
    Ombros: ['desenvolvimento', 'press militar', 'elevação'],
}

// ============================================================================
// Rep & Rest Ranges
// ============================================================================

/**
 * Rep ranges by goal — used by the heuristic builder.
 * PRD §4.1: goal defines rep range.
 */
export const REP_RANGES_BY_GOAL = {
    hypertrophy: { compound: '8-12', isolation: '10-15' },
    weight_loss: { compound: '12-15', isolation: '15-20' },
    performance: { compound: '3-6', isolation: '8-12' },
    health: { compound: '10-15', isolation: '12-15' },
} as const

/**
 * Rest seconds by exercise type and goal.
 */
export const REST_SECONDS = {
    compound: { hypertrophy: 90, weight_loss: 60, performance: 180, health: 90 },
    isolation: { hypertrophy: 60, weight_loss: 45, performance: 90, health: 60 },
} as const

// ============================================================================
// Split Templates (exact DB group names)
// ============================================================================

/**
 * Muscle group splits by structure type.
 * Each entry maps a structure to an array of workout definitions.
 * Each workout definition lists the primary + small muscle groups trained.
 *
 * Lower body uses real groups: Quadríceps, Posterior de Coxa, Glúteo
 * (NOT the generic "Pernas" which has only 1 exercise in DB).
 */
export const SPLIT_TEMPLATES = {
    full_body: [
        { label: 'Full Body A', groups: ['Peito', 'Costas', 'Quadríceps', 'Ombros', 'Bíceps', 'Tríceps'] },
        { label: 'Full Body B', groups: ['Peito', 'Costas', 'Posterior de Coxa', 'Glúteo', 'Abdominais'] },
        { label: 'Full Body C', groups: ['Peito', 'Costas', 'Quadríceps', 'Ombros', 'Bíceps', 'Tríceps'] },
    ],
    upper_lower: [
        { label: 'Upper A', groups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'] },
        { label: 'Lower A', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo', 'Panturrilha'] },
        { label: 'Upper B', groups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'] },
        { label: 'Lower B', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo', 'Panturrilha'] },
    ],
    ppl_plus: [
        { label: 'Push', groups: ['Peito', 'Ombros', 'Tríceps'] },
        { label: 'Pull', groups: ['Costas', 'Bíceps', 'Trapézio'] },
        { label: 'Legs A', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo'] },
        { label: 'Upper', groups: ['Peito', 'Costas', 'Ombros'] },
        { label: 'Legs B', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo', 'Panturrilha'] },
    ],
    ppl_complete: [
        { label: 'Push A', groups: ['Peito', 'Ombros', 'Tríceps'] },
        { label: 'Pull A', groups: ['Costas', 'Bíceps', 'Trapézio'] },
        { label: 'Legs A', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo'] },
        { label: 'Push B', groups: ['Peito', 'Ombros', 'Tríceps'] },
        { label: 'Pull B', groups: ['Costas', 'Bíceps'] },
        { label: 'Legs B', groups: ['Quadríceps', 'Posterior de Coxa', 'Glúteo', 'Panturrilha'] },
    ],
} as const
