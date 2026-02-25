// ============================================================================
// Kinevo Prescription Engine — Heuristic Program Builder
// ============================================================================
// Generates a valid program WITHOUT the AI. This is the fallback when:
// - OpenAI is unavailable or disabled
// - The AI returns an invalid response
// - The trainer wants a quick draft
//
// The output MUST pass validateOutput() without error-severity violations.

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

// ============================================================================
// Difficulty Preference — maps student level to exercise difficulty preference
// ============================================================================
// Lower score = more preferred. NOT a filter — just a tie-breaker.

type DifficultyLevel = PrescriptionExerciseRef['difficulty_level']

const DIFFICULTY_PREFERENCE: Record<TrainingLevel, Record<DifficultyLevel, number>> = {
    beginner:     { beginner: 0, intermediate: 1, advanced: 2 },
    intermediate: { intermediate: 0, beginner: 1, advanced: 2 },
    advanced:     { advanced: 0, intermediate: 1, beginner: 2 },
}

// Session position sort order for final workout ordering
const SESSION_POSITION_ORDER: Record<string, number> = {
    first: 0,
    middle: 1,
    last: 2,
}

import {
    VOLUME_RANGES,
    FREQUENCY_STRUCTURE,
    PRESCRIPTION_CONSTRAINTS,
} from '@kinevo/shared/types/prescription'

import {
    DEFAULT_DURATION_WEEKS,
    REP_RANGES_BY_GOAL,
    REST_SECONDS,
    SPLIT_TEMPLATES,
    COMPOUND_EXERCISE_PATTERNS,
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SMALL_GROUP_EXERCISE_LIMITS,
    calcExercisesPerWorkout,
} from './constants'

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Builds a complete program using heuristic rules — no AI involved.
 * Designed to always produce a valid program for any input combination.
 */
export function buildHeuristicProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
): PrescriptionOutputSnapshot {
    const frequency = profile.available_days.length
    const level = profile.training_level
    const goal = profile.goal

    // 1. Determine structure
    const structureKey = resolveStructure(frequency)
    const splitTemplate = SPLIT_TEMPLATES[structureKey]

    // 2. Filter exercises
    const available = filterExercises(exercises, profile)

    // 3. Build exercise map by muscle group
    const byMuscleGroup = groupExercisesByMuscle(available)

    // 4. Target volume (always start at min for week 1) — applies to PRIMARY groups only
    const volumeRange = VOLUME_RANGES[level]
    const targetSetsPerGroup = volumeRange.min

    // 5. Compute how many workouts train each muscle group (for volume budgeting)
    const workoutCount = Math.min(frequency, splitTemplate.length)
    const groupFrequency: Record<string, number> = {}
    for (let i = 0; i < workoutCount; i++) {
        for (const group of splitTemplate[i].groups) {
            groupFrequency[group] = (groupFrequency[group] || 0) + 1
        }
    }

    // 6. Track small group exercises per week (enforces SMALL_GROUP_EXERCISE_LIMITS)
    const weeklySmallGroupCount: Record<string, number> = {}

    // 7. Build workouts
    const workouts: GeneratedWorkout[] = []

    for (let i = 0; i < workoutCount; i++) {
        const template = splitTemplate[i]
        const scheduledDay = profile.available_days[i]

        const workout = buildWorkout(
            template.label,
            [...template.groups],
            i,
            scheduledDay !== undefined ? [scheduledDay] : [],
            byMuscleGroup,
            available,
            level,
            goal,
            targetSetsPerGroup,
            groupFrequency,
            profile,
            weeklySmallGroupCount,
        )
        workouts.push(workout)
    }

    // 8. Build reasoning
    const reasoning = buildReasoning(level, goal, frequency, structureKey, workouts)

    return {
        program: {
            name: buildProgramName(level, goal, frequency),
            description: buildProgramDescription(level, goal, frequency),
            duration_weeks: DEFAULT_DURATION_WEEKS,
        },
        workouts,
        reasoning,
    }
}

// ============================================================================
// Controlled Randomization
// ============================================================================
// Fisher-Yates shuffle — produces different programs on each generation while
// keeping all constraint logic intact.  Only applied WITHIN candidate lists,
// so favorites and primary-group-match still take priority.

function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

// ============================================================================
// Structure Resolution
// ============================================================================

type StructureKey = keyof typeof SPLIT_TEMPLATES

function resolveStructure(frequency: number): StructureKey {
    const clamped = Math.max(2, Math.min(frequency, 6))
    const mapped = FREQUENCY_STRUCTURE[clamped as keyof typeof FREQUENCY_STRUCTURE]
    return (mapped || 'full_body') as StructureKey
}

// ============================================================================
// Exercise Filtering
// ============================================================================

function filterExercises(
    exercises: PrescriptionExerciseRef[],
    profile: StudentPrescriptionProfile,
): PrescriptionExerciseRef[] {
    const restrictedIds = new Set(
        profile.medical_restrictions.flatMap(r => r.restricted_exercise_ids),
    )
    const dislikedIds = new Set(profile.disliked_exercise_ids)

    return exercises.filter(e => {
        if (restrictedIds.has(e.id)) return false
        if (dislikedIds.has(e.id)) return false
        return true
    })
}

function groupExercisesByMuscle(
    exercises: PrescriptionExerciseRef[],
): Map<string, PrescriptionExerciseRef[]> {
    const map = new Map<string, PrescriptionExerciseRef[]>()
    for (const ex of exercises) {
        for (const group of ex.muscle_group_names) {
            const list = map.get(group) || []
            list.push(ex)
            map.set(group, list)
        }
    }
    return map
}

// ============================================================================
// Workout Building — 3-Phase Approach
// ============================================================================
// Phase 1: Compounds for primary muscle groups (foundation of the workout)
// Phase 2: Isolation/accessory for small muscle groups (respecting weekly limits)
// Phase 3: Fill remaining slots with primary group isolations/accessories

function buildWorkout(
    label: string,
    muscleGroups: string[],
    orderIndex: number,
    scheduledDays: number[],
    byMuscleGroup: Map<string, PrescriptionExerciseRef[]>,
    available: PrescriptionExerciseRef[],
    level: TrainingLevel,
    goal: PrescriptionGoal,
    targetSetsPerGroup: number,
    groupFrequency: Record<string, number>,
    profile: StudentPrescriptionProfile,
    weeklySmallGroupCount: Record<string, number>,
): GeneratedWorkout {
    const items: GeneratedWorkoutItem[] = []
    const usedExerciseIds = new Set<string>()
    const favoriteIds = new Set(profile.favorite_exercise_ids)
    let itemIndex = 0

    // Calculate dynamic exercise limits for this workout
    const { max } = calcExercisesPerWorkout(
        profile.session_duration_minutes,
        level,
        profile.available_days.length,
    )

    const weeklySmallLimit = SMALL_GROUP_EXERCISE_LIMITS[level]

    // Classify groups in this template
    const primaryGroups = muscleGroups.filter(g => PRIMARY_MUSCLE_GROUPS.includes(g))
    const smallGroups = muscleGroups.filter(g => SMALL_MUSCLE_GROUPS.includes(g))

    // ── Phase 1: One compound per primary group ──
    for (const group of primaryGroups) {
        if (items.length >= max) break

        const candidates = (byMuscleGroup.get(group) || [])
            .filter(e => e.is_compound && !usedExerciseIds.has(e.id))

        // Prefer exercises where this group is the PRIMARY (first) muscle group.
        // This avoids e.g. picking Agachamento (Quadríceps first) for Glúteo
        // when Hip Thrust (Glúteo first) is available.
        // Also prefers is_primary_movement and difficulty_level matching student level.
        const sorted = sortByPrimaryGroupMatch(candidates, group, favoriteIds, level)

        const pick = sorted[0] || null
        if (pick) {
            const occurrences = groupFrequency[group] || 1
            const budget = Math.max(2, Math.round(targetSetsPerGroup / occurrences))
            const sets = Math.max(2, Math.min(4, budget))
            items.push(buildItem(pick, sets, goal, true, itemIndex++, group))
            usedExerciseIds.add(pick.id)
        }
    }

    // ── Phase 2: One exercise per small group (respecting weekly limit) ──
    for (const group of smallGroups) {
        if (items.length >= max) break

        // Check weekly limit for this small group
        if ((weeklySmallGroupCount[group] || 0) >= weeklySmallLimit) continue

        const candidates = (byMuscleGroup.get(group) || [])
            .filter(e => !usedExerciseIds.has(e.id))

        const pick = pickExercise(candidates, favoriteIds, level)
        if (pick) {
            items.push(buildItem(pick, 3, goal, pick.is_compound, itemIndex++, group))
            usedExerciseIds.add(pick.id)
            weeklySmallGroupCount[group] = (weeklySmallGroupCount[group] || 0) + 1
        }
    }

    // ── Phase 3: Fill remaining slots with primary group isolations/accessories ──
    for (const group of primaryGroups) {
        if (items.length >= max) break

        const candidates = (byMuscleGroup.get(group) || [])
            .filter(e => !usedExerciseIds.has(e.id))

        // Prefer exercises whose primary group matches + difficulty preference
        const sorted = sortByPrimaryGroupMatch(candidates, group, favoriteIds, level)

        const pick = sorted[0] || null
        if (pick) {
            const occurrences = groupFrequency[group] || 1
            const budget = Math.max(2, Math.round(targetSetsPerGroup / occurrences))
            const setsUsedForGroup = items
                .filter(i => i.exercise_muscle_group === group)
                .reduce((s, i) => s + i.sets, 0)
            const setsRemaining = Math.max(2, budget - setsUsedForGroup)
            const sets = Math.min(3, setsRemaining)

            items.push(buildItem(pick, sets, goal, pick.is_compound, itemIndex++, group))
            usedExerciseIds.add(pick.id)
        }
    }

    // ── Final: Re-sort items by session_position (first → middle → last) ──
    // Preserves the selection from phases above but ensures proper exercise ordering
    // within the workout (heavy compounds first, accessories middle, finishers last).
    const exerciseLookup = new Map(available.map(e => [e.id, e]))
    items.sort((a, b) => {
        const posA = SESSION_POSITION_ORDER[exerciseLookup.get(a.exercise_id)?.session_position || 'middle'] ?? 1
        const posB = SESSION_POSITION_ORDER[exerciseLookup.get(b.exercise_id)?.session_position || 'middle'] ?? 1
        return posA - posB
    })
    // Update order_index to reflect the new ordering
    items.forEach((item, idx) => { item.order_index = idx })

    const workoutName = `Treino ${String.fromCharCode(65 + orderIndex)} — ${label}`

    return {
        name: workoutName,
        order_index: orderIndex,
        scheduled_days: scheduledDays,
        items,
    }
}

/**
 * Sort candidates by (in priority order):
 * 1) Favorites first
 * 2) is_primary_movement = true first (curated DB flag)
 * 3) Primary group match (exercise's first muscle_group_name matches target)
 * 4) Difficulty preference (beginner exercises for beginner students, etc.)
 *
 * Shuffles the input first so that within the same priority tier,
 * selection varies across generations (stable sort preserves shuffle order).
 */
function sortByPrimaryGroupMatch(
    candidates: PrescriptionExerciseRef[],
    targetGroup: string,
    favoriteIds: Set<string>,
    studentLevel: TrainingLevel = 'intermediate',
): PrescriptionExerciseRef[] {
    const diffPref = DIFFICULTY_PREFERENCE[studentLevel]

    // Shuffle first — stable sort preserves this random order within equal-priority tiers
    return shuffleArray(candidates).sort((a, b) => {
        // 1. Favorites always first
        const aFav = favoriteIds.has(a.id) ? 0 : 1
        const bFav = favoriteIds.has(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav

        // 2. Prefer exercises flagged as primary movements (curated)
        const aPrimMov = a.is_primary_movement ? 0 : 1
        const bPrimMov = b.is_primary_movement ? 0 : 1
        if (aPrimMov !== bPrimMov) return aPrimMov - bPrimMov

        // 3. Prefer exercises where this group is the PRIMARY (first) group
        const aPrimGrp = a.muscle_group_names[0] === targetGroup ? 0 : 1
        const bPrimGrp = b.muscle_group_names[0] === targetGroup ? 0 : 1
        if (aPrimGrp !== bPrimGrp) return aPrimGrp - bPrimGrp

        // 4. Prefer difficulty level matching student level (tie-breaker)
        const aDiff = diffPref[a.difficulty_level] ?? 1
        const bDiff = diffPref[b.difficulty_level] ?? 1
        return aDiff - bDiff
    })
}

function pickExercise(
    candidates: PrescriptionExerciseRef[],
    favoriteIds: Set<string>,
    studentLevel: TrainingLevel = 'intermediate',
): PrescriptionExerciseRef | null {
    if (candidates.length === 0) return null

    const diffPref = DIFFICULTY_PREFERENCE[studentLevel]

    // Shuffle first, then stable sort by: favorites > difficulty preference
    const sorted = shuffleArray(candidates).sort((a, b) => {
        // 1. Favorites first
        const aFav = favoriteIds.has(a.id) ? 0 : 1
        const bFav = favoriteIds.has(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav

        // 2. Difficulty preference (tie-breaker)
        const aDiff = diffPref[a.difficulty_level] ?? 1
        const bDiff = diffPref[b.difficulty_level] ?? 1
        return aDiff - bDiff
    })

    return sorted[0]
}

/**
 * Build a workout item. The `targetGroup` parameter overrides the muscle group
 * attribution — so when Agachamento (Quadríceps, Glúteo) is picked for Glúteo,
 * the item is labeled as Glúteo, not Quadríceps.
 */
function buildItem(
    exercise: PrescriptionExerciseRef,
    sets: number,
    goal: PrescriptionGoal,
    isCompound: boolean,
    orderIndex: number,
    targetGroup?: string,
): GeneratedWorkoutItem {
    const repRange = isCompound
        ? REP_RANGES_BY_GOAL[goal].compound
        : REP_RANGES_BY_GOAL[goal].isolation

    const restSeconds = isCompound
        ? REST_SECONDS.compound[goal]
        : REST_SECONDS.isolation[goal]

    // Use targetGroup if provided (so volume is attributed to the intended group),
    // fallback to the exercise's primary muscle group.
    const muscleGroup = targetGroup && exercise.muscle_group_names.includes(targetGroup)
        ? targetGroup
        : exercise.muscle_group_names[0] || ''

    return {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_muscle_group: muscleGroup,
        exercise_equipment: exercise.equipment,
        sets,
        reps: repRange,
        rest_seconds: restSeconds,
        notes: null,
        substitute_exercise_ids: [],
        order_index: orderIndex,
    }
}

// ============================================================================
// Program Metadata
// ============================================================================

const LEVEL_LABELS: Record<TrainingLevel, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
}

const GOAL_LABELS: Record<PrescriptionGoal, string> = {
    hypertrophy: 'Hipertrofia',
    weight_loss: 'Emagrecimento',
    performance: 'Performance',
    health: 'Saúde',
}

function buildProgramName(level: TrainingLevel, goal: PrescriptionGoal, frequency: number): string {
    return `Programa ${GOAL_LABELS[goal]} — ${frequency}x/semana`
}

function buildProgramDescription(level: TrainingLevel, goal: PrescriptionGoal, frequency: number): string {
    const structureKey = resolveStructure(frequency)
    const structureLabels: Record<string, string> = {
        full_body: 'Full Body',
        upper_lower: 'Upper/Lower',
        ppl_plus: 'Push/Pull/Legs+',
        ppl_complete: 'Push/Pull/Legs',
    }
    return `Programa de ${DEFAULT_DURATION_WEEKS} semanas para ${LEVEL_LABELS[level].toLowerCase()} com foco em ${GOAL_LABELS[goal].toLowerCase()}. Estrutura: ${structureLabels[structureKey] || structureKey}.`
}

// ============================================================================
// Reasoning
// ============================================================================

function buildReasoning(
    level: TrainingLevel,
    goal: PrescriptionGoal,
    frequency: number,
    structureKey: string,
    workouts: GeneratedWorkout[],
): PrescriptionReasoning {
    const range = VOLUME_RANGES[level]

    const structureLabels: Record<string, string> = {
        full_body: 'Full Body',
        upper_lower: 'Upper/Lower',
        ppl_plus: 'Push/Pull/Legs+',
        ppl_complete: 'Push/Pull/Legs',
    }

    return {
        structure_rationale: `Estrutura ${structureLabels[structureKey] || structureKey} selecionada para ${frequency} dias/semana — padrão Kinevo para nível ${LEVEL_LABELS[level].toLowerCase()}.`,
        volume_rationale: `Volume inicial no limite inferior (${range.min} séries/grupo/semana). Progressão após 2 semanas com aderência acima de ${PRESCRIPTION_CONSTRAINTS.adherence_threshold_for_progression}%.`,
        workout_notes: workouts.map(w =>
            `${w.name}: ${w.items.length} exercícios, ${w.items.reduce((s, i) => s + i.sets, 0)} séries totais.`
        ),
        attention_flags: [],
        confidence_score: 0.85,
    }
}
