// ============================================================================
// Kinevo Prescription Engine — Rules Engine
// ============================================================================
// Validates prescription inputs and outputs against the Kinevo methodology.
// Runs BEFORE and AFTER the AI. All rules derive from shared constants.

import type {
    TrainingLevel,
    AiMode,
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    RulesViolation,
    PrescriptionPerformanceContext,
} from '@kinevo/shared/types/prescription'

import {
    VOLUME_RANGES,
    FREQUENCY_STRUCTURE,
    PRESCRIPTION_CONSTRAINTS,
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SMALL_GROUP_EXERCISE_LIMITS,
} from './constants'

// ============================================================================
// Types
// ============================================================================

export interface InputValidationResult {
    valid: boolean
    errors: string[]
}

export interface OutputValidationResult {
    violations: RulesViolation[]
    hasErrors: boolean
    hasWarnings: boolean
}

export interface FixResult {
    fixed: PrescriptionOutputSnapshot
    appliedFixes: RulesViolation[]
    remainingViolations: RulesViolation[]
}

// ============================================================================
// validateInput
// ============================================================================

/**
 * Verifies that the student profile and exercise library have enough data
 * to generate a valid program. Called BEFORE AI or heuristic generation.
 */
export function validateInput(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
): InputValidationResult {
    const errors: string[] = []

    // Profile checks
    if (!profile.student_id) {
        errors.push('student_id é obrigatório.')
    }
    if (!profile.trainer_id) {
        errors.push('trainer_id é obrigatório.')
    }
    if (profile.available_days.length === 0) {
        errors.push('O aluno precisa ter pelo menos 1 dia disponível.')
    }
    if (profile.available_days.length > 6) {
        errors.push('O máximo de dias por semana é 6.')
    }
    const invalidDays = profile.available_days.filter(d => d < 0 || d > 6)
    if (invalidDays.length > 0) {
        errors.push(`Dias inválidos: ${invalidDays.join(', ')}. Use 0 (Dom) a 6 (Sab).`)
    }
    if (profile.session_duration_minutes < 20 || profile.session_duration_minutes > 180) {
        errors.push('Duração da sessão deve estar entre 20 e 180 minutos.')
    }

    // Exercise library checks
    if (exercises.length === 0) {
        errors.push('A biblioteca de exercícios está vazia.')
    }
    const compoundExercises = exercises.filter(e => e.is_compound)
    if (compoundExercises.length === 0) {
        errors.push('A biblioteca precisa de pelo menos 1 exercício composto.')
    }

    // Frequency/structure validation
    const frequency = profile.available_days.length
    if (frequency >= 2 && frequency <= 6) {
        const structure = FREQUENCY_STRUCTURE[frequency as keyof typeof FREQUENCY_STRUCTURE]
        if (!structure) {
            errors.push(`Frequência de ${frequency} dias não tem estrutura definida.`)
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    }
}

// ============================================================================
// validateOutput
// ============================================================================

/**
 * Validates a generated program against the Kinevo methodology rules.
 * Called AFTER AI or heuristic generation, BEFORE presenting to the trainer.
 */
export function validateOutput(
    generated: PrescriptionOutputSnapshot,
    profile: StudentPrescriptionProfile,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): OutputValidationResult {
    const violations: RulesViolation[] = []
    const level = profile.training_level

    // ---- Rule: Medical restrictions ----
    const restrictedExerciseIds = new Set(
        profile.medical_restrictions.flatMap(r => r.restricted_exercise_ids)
    )
    const restrictedMuscleGroups = new Set(
        profile.medical_restrictions.flatMap(r => r.restricted_muscle_groups)
    )

    for (const workout of generated.workouts) {
        for (const item of workout.items) {
            if (restrictedExerciseIds.has(item.exercise_id)) {
                violations.push({
                    rule_id: 'restricted_exercise',
                    description: `Exercício "${item.exercise_name}" está bloqueado por restrição médica.`,
                    severity: 'error',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
                    },
                })
            }
            if (restrictedMuscleGroups.has(item.exercise_muscle_group)) {
                violations.push({
                    rule_id: 'restricted_muscle_group',
                    description: `Grupo muscular "${item.exercise_muscle_group}" está restrito por condição médica.`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
                        muscle_group: item.exercise_muscle_group,
                    },
                })
            }
        }
    }

    // ---- Rule: At least 1 compound per workout (PRD §2.5) ----
    for (const workout of generated.workouts) {
        const compoundsInWorkout = workout.items.filter(item => {
            const ref = exerciseMap.get(item.exercise_id)
            return ref?.is_compound === true
        })
        if (compoundsInWorkout.length < PRESCRIPTION_CONSTRAINTS.min_compounds_per_day) {
            violations.push({
                rule_id: 'missing_compound',
                description: `Treino "${workout.name}" não tem exercício composto.`,
                severity: 'error',
                auto_fixed: false,
                context: {
                    workout_index: workout.order_index,
                    actual_value: compoundsInWorkout.length,
                    expected_range: {
                        min: PRESCRIPTION_CONSTRAINTS.min_compounds_per_day,
                        max: 999,
                    },
                },
            })
        }
    }

    // ---- Rule: Volume per PRIMARY muscle group within level range (PRD §2.2) ----
    // Volume ranges apply ONLY to primary groups. Small groups are limited by exercise count.
    const weeklyVolume = computeWeeklyVolumePerMuscle(generated.workouts)
    const range = VOLUME_RANGES[level]

    for (const [muscleGroup, totalSets] of Object.entries(weeklyVolume)) {
        // Only enforce volume caps on primary muscle groups
        if (!PRIMARY_MUSCLE_GROUPS.includes(muscleGroup)) continue

        if (totalSets > range.max) {
            violations.push({
                rule_id: 'volume_exceeds_max',
                description: `Volume semanal de "${muscleGroup}" (${totalSets} séries) excede o máximo de ${range.max} para nível ${level}.`,
                severity: 'error',
                auto_fixed: false,
                context: {
                    muscle_group: muscleGroup,
                    actual_value: totalSets,
                    expected_range: { min: range.min, max: range.max },
                },
            })
        }
    }

    // ---- Rule: Small muscle group exercise limits (per-session AND per-week) ----
    const weeklySmallGroupCount: Record<string, number> = {}
    const weeklySmallLimit = SMALL_GROUP_EXERCISE_LIMITS[level]

    for (const workout of generated.workouts) {
        const sessionSmallGroupCount: Record<string, number> = {}
        const freq = Math.max(1, workout.scheduled_days.length)

        for (const item of workout.items) {
            const group = item.exercise_muscle_group
            if (SMALL_MUSCLE_GROUPS.includes(group)) {
                sessionSmallGroupCount[group] = (sessionSmallGroupCount[group] || 0) + 1
                weeklySmallGroupCount[group] = (weeklySmallGroupCount[group] || 0) + freq
            }
        }

        // Per-session: max 2 exercises for any single small group in one session
        for (const [group, count] of Object.entries(sessionSmallGroupCount)) {
            if (count > 2) {
                violations.push({
                    rule_id: 'excess_small_group_per_session',
                    description: `Treino "${workout.name}": ${count} exercícios para ${group} em uma sessão (máx 2).`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        muscle_group: group,
                        actual_value: count,
                        expected_range: { min: 0, max: 2 },
                    },
                })
            }
        }
    }

    // Per-week: check small group exercise count against level limit
    for (const [group, count] of Object.entries(weeklySmallGroupCount)) {
        if (count > weeklySmallLimit) {
            violations.push({
                rule_id: 'excess_small_group_per_week',
                description: `${group}: ${count} exercícios/semana (máx ${weeklySmallLimit} para ${level}).`,
                severity: 'warning',
                auto_fixed: false,
                context: {
                    muscle_group: group,
                    actual_value: count,
                    expected_range: { min: 0, max: weeklySmallLimit },
                },
            })
        }
    }

    // ---- Rule: Minimum rest for compound exercises (PRD §2.5) ----
    for (const workout of generated.workouts) {
        for (const item of workout.items) {
            const ref = exerciseMap.get(item.exercise_id)
            if (ref?.is_compound && item.rest_seconds < PRESCRIPTION_CONSTRAINTS.min_rest_seconds_compound) {
                violations.push({
                    rule_id: 'rest_too_low_compound',
                    description: `Exercício composto "${item.exercise_name}" com descanso de ${item.rest_seconds}s (mínimo ${PRESCRIPTION_CONSTRAINTS.min_rest_seconds_compound}s).`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
                        actual_value: item.rest_seconds,
                        expected_range: {
                            min: PRESCRIPTION_CONSTRAINTS.min_rest_seconds_compound,
                            max: 300,
                        },
                    },
                })
            }
        }
    }

    return {
        violations,
        hasErrors: violations.some(v => v.severity === 'error'),
        hasWarnings: violations.some(v => v.severity === 'warning'),
    }
}

// ============================================================================
// fixViolations
// ============================================================================

/**
 * Attempts to auto-fix simple violations in the generated program.
 * Returns the fixed program, list of fixes applied, and remaining violations.
 */
export function fixViolations(
    generated: PrescriptionOutputSnapshot,
    violations: RulesViolation[],
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): FixResult {
    // Deep copy to avoid mutation
    const fixed: PrescriptionOutputSnapshot = JSON.parse(JSON.stringify(generated))
    const appliedFixes: RulesViolation[] = []
    const remainingViolations: RulesViolation[] = []

    for (const violation of violations) {
        let wasFixed = false

        switch (violation.rule_id) {
            case 'restricted_exercise': {
                // Remove the restricted exercise from the workout
                const wi = violation.context.workout_index
                const eid = violation.context.exercise_id
                if (wi !== undefined && eid) {
                    const workout = fixed.workouts[wi]
                    if (workout) {
                        workout.items = workout.items.filter(item => item.exercise_id !== eid)
                        // Re-index order_index
                        workout.items.forEach((item, i) => { item.order_index = i })
                        wasFixed = true
                    }
                }
                break
            }

            case 'volume_exceeds_max': {
                // Reduce sets on exercises of the offending muscle group until within range
                const mg = violation.context.muscle_group
                const expectedMax = violation.context.expected_range?.max
                if (mg && expectedMax) {
                    reduceVolumeForMuscleGroup(fixed.workouts, mg, expectedMax)
                    wasFixed = true
                }
                break
            }

            case 'rest_too_low_compound': {
                // Increase rest to minimum
                const wi = violation.context.workout_index
                const eid = violation.context.exercise_id
                if (wi !== undefined && eid) {
                    const workout = fixed.workouts[wi]
                    const item = workout?.items.find(i => i.exercise_id === eid)
                    if (item) {
                        item.rest_seconds = PRESCRIPTION_CONSTRAINTS.min_rest_seconds_compound
                        wasFixed = true
                    }
                }
                break
            }

            default:
                break
        }

        if (wasFixed) {
            appliedFixes.push({ ...violation, auto_fixed: true })
        } else {
            remainingViolations.push(violation)
        }
    }

    return { fixed, appliedFixes, remainingViolations }
}

// ============================================================================
// resolveAiMode
// ============================================================================

/**
 * Determines the AI operation mode based on student profile and performance context.
 * PRD §3.1: auto (beginner/new), copilot (intermediate), assistant (advanced/complex).
 */
export function resolveAiMode(
    profile: StudentPrescriptionProfile,
    performanceContext: PrescriptionPerformanceContext | null,
): AiMode {
    // Explicit override: trainer manually set mode
    // (ai_mode field is always present and defaults to 'copilot')

    // Rule: Severe medical restrictions → always assistant
    const hasSevereRestriction = profile.medical_restrictions.some(r => r.severity === 'severe')
    if (hasSevereRestriction) {
        return 'assistant'
    }

    // Rule: Advanced level → assistant
    if (profile.training_level === 'advanced') {
        return 'assistant'
    }

    // Rule: Beginner OR < 4 weeks of history → auto
    if (profile.training_level === 'beginner') {
        return 'auto'
    }
    if (!performanceContext || performanceContext.weeks_of_history < 4) {
        return 'auto'
    }

    // Rule: Intermediate with history → copilot
    return 'copilot'
}

// ============================================================================
// Helpers (exported for testing)
// ============================================================================

/**
 * Computes total weekly sets per muscle group across all workouts.
 * Accounts for workout frequency (scheduled_days.length).
 */
export function computeWeeklyVolumePerMuscle(
    workouts: GeneratedWorkout[],
): Record<string, number> {
    const volume: Record<string, number> = {}

    for (const workout of workouts) {
        // Frequency: how many times per week this workout is done
        const frequency = Math.max(1, workout.scheduled_days.length)

        for (const item of workout.items) {
            const group = item.exercise_muscle_group
            if (!group) continue
            const weeklySets = item.sets * frequency
            volume[group] = (volume[group] || 0) + weeklySets
        }
    }

    return volume
}

/**
 * Reduces volume for a specific muscle group to fit within maxSets.
 * Removes sets from the exercises with the most sets first.
 */
function reduceVolumeForMuscleGroup(
    workouts: GeneratedWorkout[],
    muscleGroup: string,
    maxSets: number,
): void {
    // Collect all items for this muscle group with their workout frequency
    const entries: { workout: GeneratedWorkout; item: GeneratedWorkoutItem; frequency: number }[] = []
    for (const workout of workouts) {
        const frequency = Math.max(1, workout.scheduled_days.length)
        for (const item of workout.items) {
            if (item.exercise_muscle_group === muscleGroup) {
                entries.push({ workout, item, frequency })
            }
        }
    }

    // Sort by sets descending (reduce the biggest contributors first)
    entries.sort((a, b) => b.item.sets - a.item.sets)

    let currentTotal = entries.reduce(
        (sum, e) => sum + e.item.sets * e.frequency, 0,
    )

    for (const entry of entries) {
        if (currentTotal <= maxSets) break
        const excess = currentTotal - maxSets
        const canReduce = Math.min(
            entry.item.sets - 1, // Never reduce below 1 set
            Math.ceil(excess / entry.frequency),
        )
        if (canReduce > 0) {
            entry.item.sets -= canReduce
            currentTotal -= canReduce * entry.frequency
        }
    }
}
