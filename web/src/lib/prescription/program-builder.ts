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
    ExerciseFunction,
} from '@kinevo/shared/types/prescription'

import { computeWeeklyVolumePerMuscle } from './rules-engine'

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

    // 6.5 Track accumulated weekly volume INCLUDING secondary contributions
    // This prevents secondary overflow (e.g. Glúteo from Quad/Post compounds)
    const weeklyGroupVolume: Record<string, number> = {}

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
            weeklyGroupVolume,
        )
        workouts.push(workout)
    }

    // 8. Post-process: cap any remaining overflow (safety net)
    capSecondaryVolumeOverflow(workouts, available, level)

    // 9. Build reasoning
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
    weeklyGroupVolume: Record<string, number>,
): GeneratedWorkout {
    const items: GeneratedWorkoutItem[] = []
    const usedExerciseIds = new Set<string>()
    const favoriteIds = new Set(profile.favorite_exercise_ids)
    let itemIndex = 0
    const freq = Math.max(1, scheduledDays.length)
    const maxVolume = VOLUME_RANGES[level].max

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

    // Helper: track volume for an added exercise (direct + secondary)
    function trackVolume(pick: PrescriptionExerciseRef, sets: number, targetGroup: string) {
        const weeklySets = sets * freq
        weeklyGroupVolume[targetGroup] = (weeklyGroupVolume[targetGroup] || 0) + weeklySets
        if (pick.is_compound) {
            const secondaries = BUILDER_SECONDARY_MAP[targetGroup] || []
            for (const { group: secGroup, weight } of secondaries) {
                weeklyGroupVolume[secGroup] = (weeklyGroupVolume[secGroup] || 0) + Math.round(weeklySets * weight)
            }
        }
    }

    // Helper: check if adding a compound (at minimum 2 sets) would push any secondary target over max
    function wouldOverflowSecondary(pick: PrescriptionExerciseRef, targetGroup: string): boolean {
        if (!pick.is_compound) return false
        for (const { group: secGroup, weight } of BUILDER_SECONDARY_MAP[targetGroup] || []) {
            const current = weeklyGroupVolume[secGroup] || 0
            const minAdd = Math.round(2 * freq * weight) // minimum 2 sets × frequency × weight
            if (current + minAdd > maxVolume) return true
        }
        return false
    }

    // Helper: max sets allowed before a group (or its secondary targets) hits maxVolume
    function maxSetsWithinBudget(pick: PrescriptionExerciseRef, targetGroup: string, baseSets: number): number {
        let allowed = baseSets
        // Check direct group
        const currentDirect = weeklyGroupVolume[targetGroup] || 0
        const directRoom = Math.max(0, maxVolume - currentDirect)
        allowed = Math.min(allowed, Math.ceil(directRoom / freq))
        // Check secondary targets
        if (pick.is_compound) {
            for (const { group: secGroup, weight } of BUILDER_SECONDARY_MAP[targetGroup] || []) {
                const currentSec = weeklyGroupVolume[secGroup] || 0
                const secRoom = Math.max(0, maxVolume - currentSec)
                if (weight > 0) {
                    allowed = Math.min(allowed, Math.ceil(secRoom / (freq * weight)))
                }
            }
        }
        return Math.max(2, allowed) // minimum 2 sets per exercise
    }

    // ── Phase 1: One compound per primary group ──
    // Guarantee: at least 1 compound per workout. The first compound is always
    // allowed even if it would overflow secondary targets (volume cap handles it later).
    let hasCompoundInWorkout = false

    for (const group of primaryGroups) {
        if (items.length >= max) break

        // Skip if this group already at/over volume max from secondary contributions
        if ((weeklyGroupVolume[group] || 0) >= maxVolume) continue

        // Try compound first; fall back to isolation if compound would overflow secondary
        const compoundCandidates = (byMuscleGroup.get(group) || [])
            .filter(e => e.is_compound && !usedExerciseIds.has(e.id))

        const sortedCompounds = sortByPrimaryGroupMatch(compoundCandidates, group, favoriteIds, level)
        const compoundPick = sortedCompounds[0] || null

        // First compound is always allowed (even with secondary overflow) to
        // guarantee every workout has at least 1 compound movement.
        const overflows = compoundPick && wouldOverflowSecondary(compoundPick, group)
        const useIsolation = overflows && hasCompoundInWorkout
        let pick: PrescriptionExerciseRef | null

        if (useIsolation || !compoundPick) {
            const isolationCandidates = (byMuscleGroup.get(group) || [])
                .filter(e => !e.is_compound && !usedExerciseIds.has(e.id))
            pick = pickExercise(isolationCandidates, favoriteIds, level) || compoundPick
        } else {
            pick = compoundPick
        }

        if (pick) {
            const occurrences = groupFrequency[group] || 1
            const budget = Math.max(2, Math.round(targetSetsPerGroup / occurrences))
            const sets = Math.min(4, maxSetsWithinBudget(pick, group, budget))
            items.push(buildItem(pick, sets, goal, pick.is_compound, itemIndex++, group))
            usedExerciseIds.add(pick.id)
            trackVolume(pick, sets, group)
            if (pick.is_compound) hasCompoundInWorkout = true
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
            trackVolume(pick, 3, group)
        }
    }

    // ── Phase 3: Fill remaining slots with primary group isolations/accessories ──
    for (const group of primaryGroups) {
        if (items.length >= max) break

        // Skip if this group already at/over volume max
        if ((weeklyGroupVolume[group] || 0) >= maxVolume) continue

        let candidates = (byMuscleGroup.get(group) || [])
            .filter(e => !usedExerciseIds.has(e.id))

        // Filter out compounds that would overflow secondary targets
        candidates = candidates.filter(e => !wouldOverflowSecondary(e, group))

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
            const sets = Math.min(3, maxSetsWithinBudget(pick, group, setsRemaining))

            items.push(buildItem(pick, sets, goal, pick.is_compound, itemIndex++, group))
            usedExerciseIds.add(pick.id)
            trackVolume(pick, sets, group)
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

    // Assign exercise_function based on exercise characteristics (not just position)
    items.forEach((item) => {
        const ex = exerciseLookup.get(item.exercise_id)
        if (!ex) return
        if (ex.is_compound) {
            item.exercise_function = 'main'
        } else {
            item.exercise_function = 'accessory'
        }
    })

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
        exercise_function: null,
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

// ============================================================================
// Post-Processing: Cap Volume for Secondary Contributions
// ============================================================================
// After building all workouts, compounds may cause secondary muscle groups
// (e.g. Glúteo from Agachamento, Ombros from Supino) to exceed the volume max.
// This pass reduces sets in priority order:
//   1. Direct isolations for the overflowing group
//   2. Compounds contributing via secondary activation (if their primary group has headroom)
//   3. Direct compounds for the overflowing group (last resort)

const BUILDER_SECONDARY_MAP: Record<string, Array<{ group: string; weight: number }>> = {
    'Quadríceps':        [{ group: 'Glúteo', weight: 1.0 }],
    'Posterior de Coxa': [{ group: 'Glúteo', weight: 1.0 }],
    'Peito':             [{ group: 'Ombros', weight: 0.5 }, { group: 'Tríceps', weight: 0.5 }],
    'Costas':            [{ group: 'Bíceps', weight: 0.5 }],
    'Ombros':            [{ group: 'Tríceps', weight: 0.5 }],
}

function capSecondaryVolumeOverflow(
    workouts: GeneratedWorkout[],
    available: PrescriptionExerciseRef[],
    level: TrainingLevel,
): void {
    const exerciseMap = new Map(available.map(e => [e.id, e]))
    const maxSets = VOLUME_RANGES[level].max
    const minSets = VOLUME_RANGES[level].min

    // Iterate: reducing one group may affect others via shared compounds
    for (let pass = 0; pass < 3; pass++) {
        const weeklyVolume = computeWeeklyVolumePerMuscle(workouts, exerciseMap)
        let anyChanged = false

        for (const group of PRIMARY_MUSCLE_GROUPS) {
            const totalSets = weeklyVolume[group] || 0
            if (totalSets <= maxSets) continue

            let excess = totalSets - maxSets

            // Collect ALL items contributing to this group (direct + secondary)
            type Contribution = {
                workout: GeneratedWorkout
                item: GeneratedWorkoutItem
                frequency: number
                isDirect: boolean
                weight: number // 1.0 for direct, secondary weight otherwise
                isCompound: boolean
            }
            const contributions: Contribution[] = []

            for (const workout of workouts) {
                const freq = Math.max(1, workout.scheduled_days.length)
                for (const item of workout.items) {
                    const ref = exerciseMap.get(item.exercise_id)
                    const isCompound = ref?.is_compound ?? false

                    if (item.exercise_muscle_group === group) {
                        contributions.push({ workout, item, frequency: freq, isDirect: true, weight: 1.0, isCompound })
                    } else if (isCompound) {
                        const secondaries = BUILDER_SECONDARY_MAP[item.exercise_muscle_group] || []
                        const sec = secondaries.find(s => s.group === group)
                        if (sec) {
                            contributions.push({ workout, item, frequency: freq, isDirect: false, weight: sec.weight, isCompound: true })
                        }
                    }
                }
            }

            // Sort priority: direct isolations → direct compounds → secondary compounds
            contributions.sort((a, b) => {
                const aPriority = a.isDirect ? (a.isCompound ? 2 : 0) : 3
                const bPriority = b.isDirect ? (b.isCompound ? 2 : 0) : 3
                if (aPriority !== bPriority) return aPriority - bPriority
                return b.item.sets - a.item.sets
            })

            for (const c of contributions) {
                if (excess <= 0) break
                const canReduce = c.item.sets - 2
                if (canReduce <= 0) continue

                // For secondary contributors, check primary group headroom
                if (!c.isDirect) {
                    const primaryGroup = c.item.exercise_muscle_group
                    const primaryVol = weeklyVolume[primaryGroup] || 0
                    const primaryHeadroom = primaryVol - minSets
                    if (primaryHeadroom <= 0) continue
                    const maxByHeadroom = Math.floor(primaryHeadroom / c.frequency)
                    if (maxByHeadroom <= 0) continue
                    const reduction = Math.min(canReduce, maxByHeadroom, Math.ceil(excess / (c.frequency * c.weight)))
                    if (reduction > 0) {
                        c.item.sets -= reduction
                        excess -= Math.round(reduction * c.frequency * c.weight)
                        weeklyVolume[primaryGroup] -= reduction * c.frequency
                        anyChanged = true
                    }
                } else {
                    const reduction = Math.min(canReduce, Math.ceil(excess / c.frequency))
                    c.item.sets -= reduction
                    excess -= reduction * c.frequency
                    anyChanged = true
                }
            }

            // If still over, remove direct isolations entirely
            if (excess > 0) {
                for (const c of contributions) {
                    if (excess <= 0) break
                    if (!c.isDirect || c.isCompound) continue
                    const idx = c.workout.items.indexOf(c.item)
                    if (idx >= 0) {
                        c.workout.items.splice(idx, 1)
                        c.workout.items.forEach((it, i) => { it.order_index = i })
                        excess -= c.item.sets * c.frequency
                        anyChanged = true
                    }
                }
            }
        }

        if (!anyChanged) break
    }
}
