// ============================================================================
// Kinevo Prescription Engine — Rules Engine
// ============================================================================
// Validates prescription inputs and outputs against the Kinevo methodology.
// Runs BEFORE and AFTER the AI. All rules derive from shared constants.

import type {
    TrainingLevel,
    AiMode,
    ExerciseFunction,
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    RulesViolation,
    PrescriptionPerformanceContext,
} from '@kinevo/shared/types/prescription'

import type { PrescriptionConstraints } from './constraints-engine'

import { EXERCISE_FUNCTION_ORDER } from '@kinevo/shared/types/prescription'

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
    constraints?: PrescriptionConstraints | null,
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

    // ---- Rule: Exercise must exist in provided pool ----
    for (const workout of generated.workouts) {
        for (const item of workout.items) {
            if (!exerciseMap.has(item.exercise_id)) {
                violations.push({
                    rule_id: 'exercise_not_in_pool',
                    description: `Exercício "${item.exercise_name}" (${item.exercise_id}) não está no pool disponível.`,
                    severity: 'error',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
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
                severity: 'warning',
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

    // ---- Rule: Volume per PRIMARY muscle group within budget (PRD §2.2) ----
    // When constraints are provided, use the per-group volume_budget (post-cap).
    // Otherwise fall back to the fixed VOLUME_RANGES by level.
    const weeklyVolume = computeWeeklyVolumePerMuscle(generated.workouts, exerciseMap)
    const fallbackRange = VOLUME_RANGES[level]

    for (const [muscleGroup, totalSets] of Object.entries(weeklyVolume)) {
        // Only enforce volume caps on primary muscle groups
        if (!PRIMARY_MUSCLE_GROUPS.includes(muscleGroup)) continue

        const groupBudget = constraints?.volume_budget?.[muscleGroup]
        const effectiveMax = groupBudget?.max ?? fallbackRange.max

        if (totalSets > effectiveMax) {
            violations.push({
                rule_id: 'volume_exceeds_max',
                description: `Volume semanal de "${muscleGroup}" (${totalSets} séries) excede o máximo de ${effectiveMax}${groupBudget ? ' (budget)' : ` para nível ${level}`}.`,
                severity: level === 'advanced' ? 'warning' : 'error',
                auto_fixed: false,
                context: {
                    muscle_group: muscleGroup,
                    actual_value: totalSets,
                    expected_range: { min: groupBudget?.min ?? fallbackRange.min, max: effectiveMax },
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

    // ---- Rule 8: Scheduled days match available days ----
    for (const workout of generated.workouts) {
        for (const day of workout.scheduled_days) {
            if (!profile.available_days.includes(day)) {
                violations.push({
                    rule_id: 'scheduled_days_mismatch',
                    description: `Treino "${workout.name}" agendado para dia ${day}, que não está nos dias disponíveis [${profile.available_days.join(',')}].`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                    },
                })
            }
        }
    }

    // ---- Rule 9: No duplicate exercises across program ----
    const seenExercises = new Map<string, string>() // exerciseId → workoutName
    for (const workout of generated.workouts) {
        for (const item of workout.items) {
            if (seenExercises.has(item.exercise_id)) {
                violations.push({
                    rule_id: 'duplicate_exercise',
                    description: `"${item.exercise_name}" aparece em "${seenExercises.get(item.exercise_id)}" e "${workout.name}".`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
                    },
                })
            } else {
                seenExercises.set(item.exercise_id, workout.name)
            }
        }
    }

    // ---- Rule 10: Movement pattern diversity per workout ----
    for (const workout of generated.workouts) {
        const patternCount = new Map<string, string[]>()
        for (const item of workout.items) {
            const pattern = exerciseMap.get(item.exercise_id)?.movement_pattern
            if (!pattern || pattern === 'isolation' || pattern === 'core') continue
            if (!patternCount.has(pattern)) patternCount.set(pattern, [])
            patternCount.get(pattern)!.push(item.exercise_name)
        }
        for (const [pattern, names] of patternCount) {
            if (names.length >= 3) {
                violations.push({
                    rule_id: 'duplicate_movement_pattern',
                    description: `"${workout.name}" tem ${names.length} exercícios do padrão "${pattern}": ${names.join(', ')}.`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        muscle_group: pattern,
                    },
                })
            }
        }
    }

    // ---- Rule 11: Exercise function ordering ----
    for (const workout of generated.workouts) {
        let lastOrder = -1
        for (const item of workout.items) {
            const fn = (item.exercise_function || 'accessory') as ExerciseFunction
            const currentOrder = EXERCISE_FUNCTION_ORDER[fn] ?? 3
            if (currentOrder < lastOrder) {
                violations.push({
                    rule_id: 'function_ordering',
                    description: `"${workout.name}": "${item.exercise_name}" (${fn}) está depois de um exercício de ordem superior.`,
                    severity: 'warning',
                    auto_fixed: false,
                    context: {
                        workout_index: workout.order_index,
                        exercise_id: item.exercise_id,
                    },
                })
                break // 1 violation per workout is sufficient
            }
            lastOrder = currentOrder
        }
    }

    // ---- Rule 12: Session duration estimate ----
    const SETUP_TIME_PER_EXERCISE = 1.5 // minutes to switch exercises
    const AVG_REP_DURATION = 4 // seconds per rep (average)
    for (const workout of generated.workouts) {
        let totalMinutes = 0
        for (const item of workout.items) {
            const reps = parseInt(item.reps) || 10
            const repTime = (item.sets * reps * AVG_REP_DURATION) / 60
            const restTime = (item.sets * item.rest_seconds) / 60
            totalMinutes += repTime + restTime + SETUP_TIME_PER_EXERCISE
        }
        if (totalMinutes > profile.session_duration_minutes * 1.2) {
            violations.push({
                rule_id: 'session_duration_exceeded',
                description: `"${workout.name}" estimado em ${Math.round(totalMinutes)}min (limite: ${profile.session_duration_minutes}min).`,
                severity: 'warning',
                auto_fixed: false,
                context: {
                    workout_index: workout.order_index,
                    actual_value: Math.round(totalMinutes),
                    expected_range: { min: 0, max: profile.session_duration_minutes },
                },
            })
        }
    }

    // ---- Rule 13: Volume below minimum for primary groups ----
    // Reuse weeklyVolume from computeWeeklyVolumePerMuscle() (same source as Rule 4)
    // to ensure consistent counting with frequency multiplication and secondary contributions.
    for (const group of PRIMARY_MUSCLE_GROUPS) {
        const totalSets = weeklyVolume[group] || 0
        if (totalSets === 0) continue

        const groupBudget = constraints?.volume_budget?.[group]
        const effectiveMin = groupBudget?.min ?? fallbackRange.min
        const effectiveMax = groupBudget?.max ?? fallbackRange.max

        if (totalSets < effectiveMin) {
            violations.push({
                rule_id: 'volume_below_minimum',
                description: `"${group}" com ${totalSets} séries/semana — mínimo é ${effectiveMin}${groupBudget ? ' (budget)' : ` para nível ${level}`}.`,
                severity: 'warning',
                auto_fixed: false,
                context: {
                    muscle_group: group,
                    actual_value: totalSets,
                    expected_range: { min: effectiveMin, max: effectiveMax },
                },
            })
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
            case 'exercise_not_in_pool':
            case 'restricted_exercise': {
                // Remove the exercise from the workout
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
                    reduceVolumeForMuscleGroup(fixed.workouts, mg, expectedMax, exerciseMap)
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

            case 'duplicate_exercise': {
                // Remove the second occurrence of the duplicate exercise
                const wi = violation.context.workout_index
                const eid = violation.context.exercise_id
                if (wi !== undefined && eid) {
                    const workout = findWorkoutByIndex(fixed.workouts, wi)
                    if (workout) {
                        workout.items = workout.items.filter(item => item.exercise_id !== eid)
                        workout.items.forEach((item, i) => { item.order_index = i })
                        wasFixed = true
                    }
                }
                break
            }

            case 'function_ordering': {
                // Reorder items by exercise_function order
                const wi = violation.context.workout_index
                if (wi !== undefined) {
                    const workout = findWorkoutByIndex(fixed.workouts, wi)
                    if (workout) {
                        workout.items.sort((a, b) => {
                            const orderA = EXERCISE_FUNCTION_ORDER[(a.exercise_function || 'accessory') as ExerciseFunction] ?? 3
                            const orderB = EXERCISE_FUNCTION_ORDER[(b.exercise_function || 'accessory') as ExerciseFunction] ?? 3
                            return orderA - orderB
                        })
                        workout.items.forEach((item, i) => { item.order_index = i })
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

/**
 * Finds a workout by its order_index (robust lookup instead of direct array access).
 */
function findWorkoutByIndex(workouts: GeneratedWorkout[], orderIndex: number): GeneratedWorkout | undefined {
    return workouts.find(w => w.order_index === orderIndex) ?? workouts[orderIndex]
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
 * When exerciseMap is provided, also counts secondary muscle group volume
 * for compound exercises using the contribution matrix.
 */
export function computeWeeklyVolumePerMuscle(
    workouts: GeneratedWorkout[],
    exerciseMap?: Map<string, PrescriptionExerciseRef>,
): Record<string, number> {
    const volume: Record<string, number> = {}

    for (const workout of workouts) {
        const frequency = Math.max(1, workout.scheduled_days.length)

        for (const item of workout.items) {
            const weeklySets = item.sets * frequency
            const ref = exerciseMap?.get(item.exercise_id)
            const groups = ref?.muscle_group_names
                ?? (item.exercise_muscle_group ? [item.exercise_muscle_group] : [])

            for (const group of groups) {
                if (!PRIMARY_MUSCLE_GROUPS.includes(group) && !SMALL_MUSCLE_GROUPS.includes(group)) continue
                volume[group] = (volume[group] || 0) + weeklySets
            }
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
    exerciseMap?: Map<string, PrescriptionExerciseRef>,
): void {
    // Collect all exercises that train this muscle group
    const entries: {
        workout: GeneratedWorkout
        item: GeneratedWorkoutItem
        frequency: number
        isCompound: boolean
    }[] = []

    for (const workout of workouts) {
        const frequency = Math.max(1, workout.scheduled_days.length)
        for (const item of workout.items) {
            const ref = exerciseMap?.get(item.exercise_id)
            const groups = ref?.muscle_group_names ?? [item.exercise_muscle_group]
            if (groups.includes(muscleGroup)) {
                entries.push({ workout, item, frequency, isCompound: ref?.is_compound ?? false })
            }
        }
    }

    // Reduce isolations first, then compounds. Biggest contributors first.
    entries.sort((a, b) => {
        const aPriority = a.isCompound ? 1 : 0
        if (aPriority !== (b.isCompound ? 1 : 0)) return aPriority - (b.isCompound ? 1 : 0)
        return (b.item.sets * b.frequency) - (a.item.sets * a.frequency)
    })

    let currentTotal = entries.reduce(
        (sum, e) => sum + e.item.sets * e.frequency, 0,
    )

    for (const entry of entries) {
        if (currentTotal <= maxSets) break
        const excess = currentTotal - maxSets
        const canReduce = Math.min(
            entry.item.sets - 1,
            Math.ceil(excess / entry.frequency),
        )
        if (canReduce > 0) {
            entry.item.sets -= canReduce
            currentTotal -= canReduce * entry.frequency
        }
    }
}
