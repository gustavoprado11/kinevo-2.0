// ============================================================================
// Kinevo Prescription Engine — Heuristic Program Builder
// ============================================================================
// Generates a valid program WITHOUT the AI. This is the fallback when:
// - OpenAI is unavailable or disabled
// - The AI returns an invalid response
// - The trainer wants a quick draft
//
// The output MUST pass validateOutput() without error-severity violations.
//
// TWO BUILDERS:
// - buildHeuristicProgram() — original 3-phase builder (legacy)
// - buildSlotBasedProgram() — slot-based builder with graph integration (Tier 2)
//
// Feature flag: ENABLE_SLOT_BASED_BUILDER (default: true)
// When false → uses legacy builder. When true → uses slot-based builder.

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
import type { PrescriptionConstraints } from './constraints-engine'
import type { EnrichedStudentContext, LoadProgressionEntry } from './context-enricher'
import { SLOT_TEMPLATES, matchesSlotPattern, getSlotLabels } from './slot-templates'
import type { WorkoutSlot } from './slot-templates'
import {
    getSubstitutesForBatch,
    findVariationForStalled,
    filterBySafety,
} from './exercise-graph'
import { getContributions } from './contribution-matrix'

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
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SMALL_GROUP_EXERCISE_LIMITS,
    calcExercisesPerWorkout,
} from './constants'

// ============================================================================
// Main Entry Point — dispatches to legacy or slot-based builder
// ============================================================================

/**
 * Builds a complete program using heuristic rules — no AI involved.
 * Designed to always produce a valid program for any input combination.
 */
export function buildHeuristicProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
): PrescriptionOutputSnapshot {
    return buildLegacyProgram(profile, exercises)
}

/**
 * Builds a program using the slot-based builder with graph integration.
 * Requires constraints and enriched context for full feature set.
 * Falls back to legacy builder on error.
 */
export async function buildSlotBasedProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
): Promise<PrescriptionOutputSnapshot> {
    try {
        const result = await buildWithSlots(profile, exercises, constraints, enrichedContext)
        console.log('[SlotBuilder] Program built successfully')
        return result
    } catch (err) {
        console.error('[SlotBuilder] Error, falling back to legacy builder:', err)
        return buildLegacyProgram(profile, exercises)
    }
}

// ============================================================================
// Controlled Randomization
// ============================================================================

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
// SLOT-BASED BUILDER (Tier 2 Phase B)
// ============================================================================
// Replaces the 3-phase approach with slot templates + graph-aware scoring.
// 7 improvements:
// 1. Movement pattern family matching (exact → family fallback)
// 2. Fatigue management via fatigue_class (max 1 high-fatigue compound per workout)
// 3. Controlled variety (random among candidates within 5 points of best score)
// 4. Exercise diversity protection (penalty for same pattern + same group in workout)
// 5. Graph-aware stall replacement via findVariationForStalled()
// 6. Graph-based substitute generation via getSubstitutesForBatch()
// 7. Volume distribution using constraints.volume_budget

// ============================================================================
// Volume V2 — VolumeTracker + forecast-based allocation
// ============================================================================

interface VolumeTracker {
    volume: Record<string, number>
    /** V3: primary (direct) volume per group, used for secondary cap */
    primary: Record<string, number>
}

function createVolumeTracker(): VolumeTracker {
    return { volume: {}, primary: {} }
}

/**
 * FORECAST: Before allocating, predict the max sets this exercise can take
 * without exceeding any group's budget.max (primary + secondary).
 */
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

    // Check primary group headroom
    const primaryUsed = tracker.volume[targetGroup] || 0
    const primaryBudget = budget[targetGroup]
    if (primaryBudget) {
        const primaryRoom = Math.max(0, primaryBudget.max - primaryUsed)
        maxAllowed = Math.min(maxAllowed, Math.ceil(primaryRoom / workoutFreq))
    }

    // Check secondary group headroom
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

    const result = Math.max(slotMinSets, maxAllowed)
    if (result < slotMaxSets) {
        console.log(
            `[VolumeV2] Forecast ceiling for ${exercise.name} (${targetGroup}): ` +
            `${result} sets (budget limited from ${slotMaxSets})`,
        )
    }
    return result
}

/**
 * COMMIT: After picking an exercise and its sets, record all volume
 * (primary + secondary contributions).
 */
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
            // V3: Secondary volume cap — cumulative secondary contribution
            // to a muscle cannot exceed 60% of its primary (direct) volume.
            // If the group has NO primary volume yet, secondary flows uncapped
            // (those groups rely entirely on compound contributions).
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

// ============================================================================
// Dynamic Accessory Slots
// ============================================================================

const DYNAMIC_SLOT_ELIGIBLE_GROUPS = ['Abdominais', 'Panturrilha', 'Adutores', 'Trapézio', 'Antebraço']
const MAX_DYNAMIC_SLOTS = 1

/**
 * Generates dynamic accessory slots for groups that:
 * 1. Have budget > 0 (not removed by FREQUENCY_CUTS)
 * 2. Have forecasted volume < budget.min * 0.85
 * 3. Are not already covered by template slots in this workout
 * 4. Fit within the session exercise limit
 */
function generateDynamicSlots(
    budget: Record<string, { min: number; max: number }>,
    tracker: VolumeTracker,
    coveredGroups: Set<string>,
    remainingExerciseSlots: number,
): WorkoutSlot[] {
    const dynamicSlots: WorkoutSlot[] = []

    // Find under-served groups, sorted by deficit ratio
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

    const maxSlots = Math.min(MAX_DYNAMIC_SLOTS, remainingExerciseSlots)

    for (const { group } of deficits) {
        if (dynamicSlots.length >= maxSlots) break

        console.log(`[VolumeV2] Dynamic slot added: ${group} (current=${tracker.volume[group] || 0}, threshold=${(budget[group]?.min || 0) * 0.85})`)

        dynamicSlots.push({
            movement_pattern: 'isolation',
            target_group: group,
            function: 'accessory',
            min_sets: 2,
            max_sets: 3,
            priority: 90 + dynamicSlots.length,
            optional: true,
            prefer_compound: false,
        })
    }

    return dynamicSlots
}

// ============================================================================
// Stimulus Diversity — template key resolution for same-label penalty
// ============================================================================

function getTemplateKey(splitType: string, label: string): string {
    // Map workout labels to their shared slot template
    if (label.startsWith('Push')) return `${splitType}:push`
    if (label.startsWith('Pull')) return `${splitType}:pull`
    if (label.startsWith('Upper')) return `${splitType}:upper`
    // Legs A and Legs B use DIFFERENT templates, no same-label penalty
    if (label === 'Legs A') return `${splitType}:legs_a`
    if (label === 'Legs B') return `${splitType}:legs_b`
    if (label.startsWith('Full Body')) return `${splitType}:${label}` // each unique
    return `${splitType}:${label}`
}

// ============================================================================
// Scoring Context
// ============================================================================

interface SlotScoringContext {
    favoriteIds: Set<string>
    stalledIds: Set<string>
    previousIds: Set<string>
    emphasizedGroups: Set<string>
    level: TrainingLevel
    usedPatternsInWorkout: Set<string>
    usedGroupsInWorkout: Map<string, number>
    highFatigueUsedInWorkout: boolean
    /** Exercise IDs used in other workouts this week */
    weeklyUsedIds: Set<string>
    /** Exercise IDs used in workouts with same slot template */
    sameLabelUsedIds: Set<string>
}

async function buildWithSlots(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
): Promise<PrescriptionOutputSnapshot> {
    const frequency = profile.available_days.length
    const level = profile.training_level
    const goal = profile.goal
    const splitType = constraints.split_type
    const useVolumeV2 = process.env.ENABLE_VOLUME_V2 !== 'false'

    // 1. Filter exercises by restrictions/dislikes
    const available = filterExercises(exercises, profile)
    const exerciseMap = new Map(available.map(e => [e.id, e]))

    // 2. Apply graph safety filter (remove contraindicated exercises)
    const conditionIds = constraints.clinical_conditions || []
    let safePool = available
    if (conditionIds.length > 0) {
        const safetyResult = await filterBySafety(available.map(e => e.id), conditionIds)
        const safeIds = new Set(safetyResult.safe)
        safePool = available.filter(e => safeIds.has(e.id))
    }

    // 3. Build context for scoring
    const stalledIds = new Set(
        enrichedContext.load_progression
            .filter(lp => lp.trend === 'stalled')
            .map(lp => lp.exercise_id),
    )
    const previousIds = new Set(enrichedContext.previous_exercise_ids || [])
    const favoriteIds = new Set(profile.favorite_exercise_ids)
    const emphasizedGroups = new Set(constraints.emphasized_groups || [])

    // 4. Handle stall replacements from graph
    const stalledExercises = enrichedContext.load_progression.filter(lp => lp.trend === 'stalled')
    const stallReplacements = new Map<string, PrescriptionExerciseRef>()

    for (const stalled of stalledExercises) {
        const variations = await findVariationForStalled(
            stalled.exercise_id,
            profile.available_equipment || [],
            conditionIds,
        )
        if (variations.length > 0) {
            const replacement = exerciseMap.get(variations[0].exercise_id)
            if (replacement) {
                stallReplacements.set(stalled.exercise_id, replacement)
            }
        }
    }

    // 5. Build exercise index by muscle group
    const byMuscleGroup = groupExercisesByMuscle(safePool)

    // 6. Get slot template
    const slotLabels = getSlotLabels(splitType)
    if (slotLabels.length === 0) {
        console.warn(`[SlotBuilder] No slot templates for split_type=${splitType}, falling back`)
        return buildLegacyProgram(profile, exercises)
    }

    // 7. Compute group frequency across workouts (total occurrences)
    const workoutCount = Math.min(frequency, slotLabels.length)
    const groupFrequency: Record<string, number> = {}
    const templates = SLOT_TEMPLATES[splitType]
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

    // 8. Volume tracking — V2 uses VolumeTracker, V1 uses flat record
    const tracker = createVolumeTracker()
    const weeklyGroupVolume: Record<string, number> = {} // V1 fallback
    // Remaining occurrences for V2 smart allocator
    const remainingOccurrences: Record<string, number> = { ...groupFrequency }

    if (useVolumeV2) {
        console.log(`[VolumeV2] Active. Group frequencies: ${JSON.stringify(groupFrequency)}`)
        console.log(`[VolumeV2] Remaining occurrences init: ${JSON.stringify(remainingOccurrences)}`)
    }

    // 9. Build each workout
    const workouts: GeneratedWorkout[] = []
    const weeklyUsedIds = new Set<string>()
    const workoutExerciseIds: Record<string, Set<string>> = {}

    for (let i = 0; i < workoutCount; i++) {
        const label = slotLabels[i]
        const slots = templates[label]
        if (!slots) continue

        const scheduledDay = profile.available_days[i]

        // Build same-label used IDs for diversity penalty (Phase 5)
        const sameLabelUsedIds = new Set<string>()
        if (useVolumeV2) {
            const templateKey = getTemplateKey(splitType, label)
            for (const [prevLabel, ids] of Object.entries(workoutExerciseIds)) {
                if (getTemplateKey(splitType, prevLabel) === templateKey) {
                    for (const id of ids) sameLabelUsedIds.add(id)
                }
            }
        }

        const workout = buildSlotWorkout(
            label,
            slots,
            i,
            scheduledDay !== undefined ? [scheduledDay] : [],
            byMuscleGroup,
            safePool,
            level,
            goal,
            constraints,
            groupFrequency,
            useVolumeV2 ? tracker : null,
            weeklyGroupVolume,
            weeklyUsedIds,
            {
                favoriteIds,
                stalledIds,
                previousIds,
                emphasizedGroups,
                level,
                usedPatternsInWorkout: new Set(),
                usedGroupsInWorkout: new Map(),
                highFatigueUsedInWorkout: false,
                weeklyUsedIds,
                sameLabelUsedIds,
            },
            stallReplacements,
            useVolumeV2 ? remainingOccurrences : null,
        )

        workouts.push(workout)
        // Track exercise IDs per workout for same-label diversity
        workoutExerciseIds[label] = new Set(workout.items.map(it => it.exercise_id))
    }

    // 10. Post-process: cap any remaining overflow (safety net)
    capSecondaryVolumeOverflow(workouts, safePool, level)

    // 11. Attach graph substitutes (batch)
    await attachGraphSubstitutes(workouts, exerciseMap)

    // 12. Build reasoning
    const volumeForStats = useVolumeV2 ? tracker.volume : weeklyGroupVolume
    const reasoning = buildSlotReasoning(level, goal, frequency, splitType, workouts, constraints, enrichedContext, stallReplacements)

    // 13. Log builder stats
    logBuilderStats(workouts, volumeForStats, constraints, stallReplacements.size)

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

function buildSlotWorkout(
    label: string,
    slots: WorkoutSlot[],
    orderIndex: number,
    scheduledDays: number[],
    byMuscleGroup: Map<string, PrescriptionExerciseRef[]>,
    pool: PrescriptionExerciseRef[],
    level: TrainingLevel,
    goal: PrescriptionGoal,
    constraints: PrescriptionConstraints,
    groupFrequency: Record<string, number>,
    tracker: VolumeTracker | null,
    weeklyGroupVolume: Record<string, number>,
    weeklyUsedIds: Set<string>,
    scoringCtx: SlotScoringContext,
    stallReplacements: Map<string, PrescriptionExerciseRef>,
    remainingOccurrences: Record<string, number> | null,
): GeneratedWorkout {
    const items: GeneratedWorkoutItem[] = []
    const usedInWorkout = new Set<string>()
    let itemIndex = 0
    const freq = Math.max(1, scheduledDays.length)
    const useV2 = tracker !== null

    // Reset per-workout tracking in scoring context
    scoringCtx.usedPatternsInWorkout = new Set()
    scoringCtx.usedGroupsInWorkout = new Map()
    scoringCtx.highFatigueUsedInWorkout = false

    // Calculate session exercise limit
    const { max: exerciseLimit } = calcExercisesPerWorkout(
        constraints.session_duration_minutes,
        level,
        constraints.split_detail?.length || 4,
    )
    const maxExercises = Math.min(exerciseLimit, constraints.exercises_per_session || exerciseLimit)

    // Determine active slots: required + optional (up to exercise limit)
    const requiredSlots = slots.filter(s => !s.optional)
    const optionalSlots = slots.filter(s => s.optional)
    const optionalCount = Math.max(0, maxExercises - requiredSlots.length)
    const activeSlots = [...requiredSlots, ...optionalSlots.slice(0, optionalCount)]
    activeSlots.sort((a, b) => a.priority - b.priority)

    // Track which groups are covered by template slots
    const coveredGroups = new Set<string>()

    // Fill each slot (shared logic for template + dynamic slots)
    function fillSlot(slot: WorkoutSlot): void {
        if (items.length >= maxExercises) return

        // Find candidates for this slot
        const candidates = findCandidatesForSlot(
            slot,
            byMuscleGroup,
            pool,
            usedInWorkout,
            scoringCtx,
            stallReplacements,
        )

        if (candidates.length === 0) return

        // Score and pick with controlled variety
        const scored = candidates.map(ex => ({
            exercise: ex,
            score: computeSlotScore(ex, slot, scoringCtx),
        }))
        scored.sort((a, b) => b.score - a.score)

        const bestScore = scored[0].score
        const topCandidates = scored.filter(s => s.score >= bestScore - 5)
        const pick = topCandidates[Math.floor(Math.random() * topCandidates.length)].exercise

        // Compute sets
        let sets: number
        if (useV2 && remainingOccurrences) {
            // Phase 2+3: Forecast ceiling + smart allocator
            const forecastCeiling = forecastMaxSets(
                pick, slot.target_group, slot.min_sets, slot.max_sets,
                freq, tracker!, constraints.volume_budget,
            )
            sets = distributeSetsForSlotV2(
                slot, pick, constraints.volume_budget, tracker!,
                remainingOccurrences, freq, forecastCeiling,
            )
        } else {
            // V1 fallback
            sets = distributeSetsForSlot(
                slot, pick, constraints.volume_budget,
                weeklyGroupVolume, groupFrequency, freq,
            )
        }

        // Build item
        const item = buildItemFromSlot(pick, sets, goal, slot, itemIndex++)
        items.push(item)

        // Track state
        usedInWorkout.add(pick.id)
        weeklyUsedIds.add(pick.id)
        coveredGroups.add(slot.target_group)

        // Track volume
        if (useV2) {
            commitVolume(pick, sets, slot.target_group, freq, tracker!)
        } else {
            trackVolumeForExercise(pick, sets, slot.target_group, freq, weeklyGroupVolume)
        }

        // Update scoring context for diversity protection
        const pattern = pick.movement_pattern || 'isolation'
        scoringCtx.usedPatternsInWorkout.add(`${pattern}:${slot.target_group}`)
        const groupCount = scoringCtx.usedGroupsInWorkout.get(slot.target_group) || 0
        scoringCtx.usedGroupsInWorkout.set(slot.target_group, groupCount + 1)

        // Track fatigue
        if (pick.fatigue_class === 'high' && pick.is_compound) {
            scoringCtx.highFatigueUsedInWorkout = true
        }
    }

    // Fill template slots
    for (const slot of activeSlots) {
        fillSlot(slot)
    }

    // Phase 4: Dynamic accessory slots (V2 only)
    if (useV2) {
        const remainingCapacity = maxExercises - items.length
        if (remainingCapacity > 0) {
            const dynamicSlots = generateDynamicSlots(
                constraints.volume_budget,
                tracker!,
                coveredGroups,
                remainingCapacity,
            )
            for (const dynSlot of dynamicSlots) {
                fillSlot(dynSlot)
            }
        }
    }

    // Sort items by session_position (compounds first, isolation last)
    const exerciseLookup = new Map(pool.map(e => [e.id, e]))
    items.sort((a, b) => {
        const posA = SESSION_POSITION_ORDER[exerciseLookup.get(a.exercise_id)?.session_position || 'middle'] ?? 1
        const posB = SESSION_POSITION_ORDER[exerciseLookup.get(b.exercise_id)?.session_position || 'middle'] ?? 1
        return posA - posB
    })
    items.forEach((item, idx) => { item.order_index = idx })

    const workoutName = `Treino ${String.fromCharCode(65 + orderIndex)} — ${label}`

    return {
        name: workoutName,
        order_index: orderIndex,
        scheduled_days: scheduledDays,
        items,
    }
}

// ============================================================================
// Slot Candidate Finding
// ============================================================================

function findCandidatesForSlot(
    slot: WorkoutSlot,
    byMuscleGroup: Map<string, PrescriptionExerciseRef[]>,
    pool: PrescriptionExerciseRef[],
    usedInWorkout: Set<string>,
    scoringCtx: SlotScoringContext,
    stallReplacements: Map<string, PrescriptionExerciseRef>,
): PrescriptionExerciseRef[] {
    // Get exercises for the target group
    let candidates = byMuscleGroup.get(slot.target_group) || []

    // If target_group is a wildcard (e.g., Full Body isolation slot), use full pool
    if (slot.target_group === '*') {
        candidates = pool
    }

    // Filter: not used in this workout, matches movement pattern
    candidates = candidates.filter(ex => {
        if (usedInWorkout.has(ex.id)) return false

        // Improvement 1: Movement pattern matching (exact → family fallback)
        if (!matchesSlotPattern(ex.movement_pattern, ex.movement_pattern_family, slot.movement_pattern)) {
            return false
        }

        // Compound preference filter for main slots
        if (slot.prefer_compound && !ex.is_compound) {
            // Still allow non-compounds if no compounds available
            // (handled by returning all and scoring compounds higher)
        }

        return true
    })

    // Improvement 5: Apply stall replacements — swap stalled exercises with graph variations
    candidates = candidates.map(ex => {
        if (scoringCtx.stalledIds.has(ex.id) && stallReplacements.has(ex.id)) {
            const replacement = stallReplacements.get(ex.id)!
            // Only use replacement if it matches the slot
            if (matchesSlotPattern(replacement.movement_pattern, replacement.movement_pattern_family, slot.movement_pattern)) {
                return replacement
            }
        }
        return ex
    })

    // Deduplicate (replacement might already be in candidates)
    const seen = new Set<string>()
    candidates = candidates.filter(ex => {
        if (seen.has(ex.id)) return false
        seen.add(ex.id)
        return true
    })

    // V3: Hard duplicate rule — max 1 occurrence per exercise per program,
    // except for Panturrilha and Abdominais which may repeat across workouts
    const DUPLICATE_EXEMPT_GROUPS = new Set(['Panturrilha', 'Abdominais'])
    if (!DUPLICATE_EXEMPT_GROUPS.has(slot.target_group)) {
        candidates = candidates.filter(ex => !scoringCtx.weeklyUsedIds.has(ex.id))
    }

    return candidates
}

// ============================================================================
// Slot Scoring Function
// ============================================================================

function computeSlotScore(
    exercise: PrescriptionExerciseRef,
    slot: WorkoutSlot,
    ctx: SlotScoringContext,
): number {
    let score = 50 // base

    // Favorites bonus (+20)
    if (ctx.favoriteIds.has(exercise.id)) score += 20

    // Novelty bonus (+15 if not in previous program)
    if (!ctx.previousIds.has(exercise.id)) score += 15

    // Stall penalty (-30 if stalled)
    if (ctx.stalledIds.has(exercise.id)) score -= 30

    // Difficulty match (+10)
    const levelMap: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
    if (levelMap[exercise.difficulty_level] === levelMap[ctx.level]) score += 10

    // Primary movement flag (+10)
    if (exercise.is_primary_movement) score += 10

    // Compound bonus for main slots (+5)
    if (slot.function === 'main' && exercise.is_compound) score += 5

    // Emphasis bonus (+10 if group is emphasized by trainer)
    if (ctx.emphasizedGroups.has(slot.target_group)) score += 10

    // Improvement 2: Fatigue management — penalize high-fatigue if one already used
    if (exercise.fatigue_class === 'high' && exercise.is_compound && ctx.highFatigueUsedInWorkout) {
        score -= 20
    }

    // Improvement 4: Exercise diversity protection
    // Penalty for same movement_pattern + same target_group already in workout
    const patternKey = `${exercise.movement_pattern || 'isolation'}:${slot.target_group}`
    if (ctx.usedPatternsInWorkout.has(patternKey)) {
        score -= 15
    }

    // Phase 5: Cross-workout stimulus diversity
    // Weekly reuse penalty — exercise used in another workout this week
    if (ctx.weeklyUsedIds.has(exercise.id)) {
        score -= 25
    }
    // Same-template reuse penalty — exercise used in workout with same slot template
    // (e.g., Push A exercise reused in Push B)
    if (ctx.sameLabelUsedIds.has(exercise.id)) {
        score -= 60
    }

    return Math.max(0, Math.min(100, score))
}

// ============================================================================
// Volume Distribution (Improvement 7)
// ============================================================================

function distributeSetsForSlot(
    slot: WorkoutSlot,
    exercise: PrescriptionExerciseRef,
    volumeBudget: Record<string, { min: number; max: number }>,
    weeklyVolumeUsed: Record<string, number>,
    groupFrequency: Record<string, number>,
    workoutFreq: number,
): number {
    const group = slot.target_group
    const budget = volumeBudget[group]

    if (!budget) return slot.min_sets

    const currentVolume = weeklyVolumeUsed[group] || 0
    const remaining = Math.max(0, budget.max - currentVolume)
    const occurrences = groupFrequency[group] || 1

    // Target: distribute remaining budget across remaining occurrences
    const perOccurrence = Math.ceil(remaining / occurrences)

    // Clamp to slot bounds
    const sets = Math.max(slot.min_sets, Math.min(slot.max_sets, perOccurrence))

    return sets
}

// ============================================================================
// Volume Distribution V2 (Phase 3: Smart Volume Allocator)
// ============================================================================

/**
 * Improved volume distribution that:
 * - Targets min + (max-min)*0.7 instead of max
 * - Divides by REMAINING occurrences, not total
 * - Respects forecast ceiling from forecastMaxSets
 */
function distributeSetsForSlotV2(
    slot: WorkoutSlot,
    exercise: PrescriptionExerciseRef,
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
    // Target = min + (max - min) * 0.7
    const target = Math.round(groupBudget.min + (groupBudget.max - groupBudget.min) * 0.7)
    const remaining = Math.max(0, target - currentVolume)
    const remOcc = remainingOccurrences[group] || 1

    // Distribute remaining budget evenly across remaining occurrences
    const perOccurrence = Math.ceil(remaining / remOcc)

    // Clamp to slot bounds AND forecast ceiling
    const sets = Math.max(
        slot.min_sets,
        Math.min(slot.max_sets, perOccurrence, forecastCeiling),
    )

    // Decrement remaining occurrences for this group
    remainingOccurrences[group] = Math.max(0, remOcc - 1)

    console.log(
        `[VolumeV2] Remaining occurrences ${group}: ${remOcc} → ${remainingOccurrences[group]}. ` +
        `Volume: ${currentVolume}/${target} (budget ${groupBudget.min}-${groupBudget.max}). ` +
        `Allocated: ${sets} sets`,
    )

    return sets
}

// ============================================================================
// Volume Tracking (with secondary contributions)
// ============================================================================

function trackVolumeForExercise(
    exercise: PrescriptionExerciseRef,
    sets: number,
    targetGroup: string,
    frequency: number,
    weeklyGroupVolume: Record<string, number>,
): void {
    const weeklySets = sets * frequency
    weeklyGroupVolume[targetGroup] = (weeklyGroupVolume[targetGroup] || 0) + weeklySets

    if (exercise.is_compound) {
        const secondaries = getContributions(targetGroup, exercise.movement_pattern, true)
        for (const { group: secGroup, weight } of secondaries) {
            weeklyGroupVolume[secGroup] = (weeklyGroupVolume[secGroup] || 0) + Math.round(weeklySets * weight)
        }
    }
}

// ============================================================================
// Graph Substitute Attachment (Improvement 6)
// ============================================================================

async function attachGraphSubstitutes(
    workouts: GeneratedWorkout[],
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): Promise<void> {
    const allExerciseIds = new Set<string>()
    for (const w of workouts) {
        for (const item of w.items) {
            allExerciseIds.add(item.exercise_id)
        }
    }

    const poolIds = new Set(exerciseMap.keys())
    const subsMap = await getSubstitutesForBatch([...allExerciseIds])

    for (const w of workouts) {
        for (const item of w.items) {
            const subs = subsMap.get(item.exercise_id) || []
            item.substitute_exercise_ids = subs
                .filter(s => poolIds.has(s.exercise_id) && s.exercise_id !== item.exercise_id)
                .slice(0, 2)
                .map(s => s.exercise_id)
        }
    }
}

// ============================================================================
// Item Builder (slot-based)
// ============================================================================

function buildItemFromSlot(
    exercise: PrescriptionExerciseRef,
    sets: number,
    goal: PrescriptionGoal,
    slot: WorkoutSlot,
    orderIndex: number,
): GeneratedWorkoutItem {
    const isCompound = exercise.is_compound
    const repRange = isCompound
        ? REP_RANGES_BY_GOAL[goal].compound
        : REP_RANGES_BY_GOAL[goal].isolation

    const restSeconds = isCompound
        ? REST_SECONDS.compound[goal]
        : REST_SECONDS.isolation[goal]

    const muscleGroup = slot.target_group !== '*' && exercise.muscle_group_names.includes(slot.target_group)
        ? slot.target_group
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
        exercise_function: slot.function,
    }
}

// ============================================================================
// Reasoning Builder (slot-based)
// ============================================================================

function buildSlotReasoning(
    level: TrainingLevel,
    goal: PrescriptionGoal,
    frequency: number,
    splitType: string,
    workouts: GeneratedWorkout[],
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    stallReplacements: Map<string, PrescriptionExerciseRef>,
): PrescriptionReasoning {
    const structureLabels: Record<string, string> = {
        full_body: 'Full Body',
        upper_lower: 'Upper/Lower',
        ppl_plus: 'Push/Pull/Legs+',
        ppl_complete: 'Push/Pull/Legs',
    }

    const flags: string[] = []

    // Flag stall replacements
    if (stallReplacements.size > 0) {
        flags.push(`${stallReplacements.size} exercício(s) estagnado(s) substituído(s) por variações do grafo.`)
    }

    // Flag emphasis
    if (constraints.emphasized_groups.length > 0) {
        flags.push(`Ênfase em: ${constraints.emphasized_groups.join(', ')} — volume elevado.`)
    }

    // Flag adherence adjustment
    if (constraints.adherence_adjustment !== 'normal') {
        flags.push(`Aderência ${constraints.adherence_adjustment} — volume ajustado.`)
    }

    const workoutNotes = workouts.map(w => {
        const totalSets = w.items.reduce((s, i) => s + i.sets, 0)
        const mainCount = w.items.filter(i => i.exercise_function === 'main').length
        return `${w.name}: ${w.items.length} exercícios (${mainCount} compostos), ${totalSets} séries totais.`
    })

    return {
        structure_rationale: `Estrutura ${structureLabels[splitType] || splitType} com ${frequency} dias/semana. Slot builder v2 para nível ${LEVEL_LABELS[level].toLowerCase()}.`,
        volume_rationale: `Volume distribuído por budget de constraints (min/max por grupo). Progressão após 2 semanas com aderência acima de ${PRESCRIPTION_CONSTRAINTS.adherence_threshold_for_progression}%.`,
        workout_notes: workoutNotes,
        attention_flags: flags.slice(0, 3),
        confidence_score: 0.88,
    }
}

// ============================================================================
// Builder Stats Logging
// ============================================================================

function logBuilderStats(
    workouts: GeneratedWorkout[],
    weeklyVolume: Record<string, number>,
    constraints: PrescriptionConstraints,
    stallReplacementCount: number,
): void {
    const totalExercises = workouts.reduce((s, w) => s + w.items.length, 0)
    const totalSets = workouts.reduce((s, w) => s + w.items.reduce((ss, i) => ss + i.sets, 0), 0)
    const mainCount = workouts.reduce((s, w) => s + w.items.filter(i => i.exercise_function === 'main').length, 0)

    console.log(`[SlotBuilder] Stats: ${totalExercises} exercises, ${totalSets} total sets, ${mainCount} mains`)
    console.log(`[SlotBuilder] Stall replacements: ${stallReplacementCount}`)
    console.log(`[SlotBuilder] Weekly volume:`, JSON.stringify(weeklyVolume))

    // Check volume budget compliance
    for (const [group, budget] of Object.entries(constraints.volume_budget)) {
        const actual = weeklyVolume[group] || 0
        if (actual > budget.max) {
            console.warn(`[SlotBuilder] Volume OVER budget: ${group} = ${actual} (max ${budget.max})`)
        } else if (actual < budget.min) {
            console.warn(`[SlotBuilder] Volume UNDER budget: ${group} = ${actual} (min ${budget.min})`)
        }
    }
}

// ============================================================================
// ============================================================================
// LEGACY BUILDER (Original 3-phase approach)
// ============================================================================
// ============================================================================

function buildLegacyProgram(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
): PrescriptionOutputSnapshot {
    const frequency = profile.available_days.length
    const level = profile.training_level
    const goal = profile.goal

    const structureKey = resolveStructure(frequency)
    const splitTemplate = SPLIT_TEMPLATES[structureKey]
    const available = filterExercises(exercises, profile)
    const byMuscleGroup = groupExercisesByMuscle(available)

    const volumeRange = VOLUME_RANGES[level]
    const targetSetsPerGroup = volumeRange.min

    const workoutCount = Math.min(frequency, splitTemplate.length)
    const groupFrequency: Record<string, number> = {}
    for (let i = 0; i < workoutCount; i++) {
        for (const group of splitTemplate[i].groups) {
            groupFrequency[group] = (groupFrequency[group] || 0) + 1
        }
    }

    const weeklySmallGroupCount: Record<string, number> = {}
    const weeklyGroupVolume: Record<string, number> = {}
    const workouts: GeneratedWorkout[] = []

    for (let i = 0; i < workoutCount; i++) {
        const template = splitTemplate[i]
        const scheduledDay = profile.available_days[i]

        const workout = buildLegacyWorkout(
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

    capSecondaryVolumeOverflow(workouts, available, level)

    const reasoning = buildLegacyReasoning(level, goal, frequency, structureKey, workouts)

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

function buildLegacyWorkout(
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

    const { max } = calcExercisesPerWorkout(
        profile.session_duration_minutes,
        level,
        profile.available_days.length,
    )

    const weeklySmallLimit = SMALL_GROUP_EXERCISE_LIMITS[level]

    const primaryGroups = muscleGroups.filter(g => PRIMARY_MUSCLE_GROUPS.includes(g))
    const smallGroups = muscleGroups.filter(g => SMALL_MUSCLE_GROUPS.includes(g))

    function trackVolume(pick: PrescriptionExerciseRef, sets: number, targetGroup: string) {
        const weeklySets = sets * freq
        weeklyGroupVolume[targetGroup] = (weeklyGroupVolume[targetGroup] || 0) + weeklySets
        if (pick.is_compound) {
            const secondaries = getContributions(targetGroup, pick.movement_pattern, true)
            for (const { group: secGroup, weight } of secondaries) {
                weeklyGroupVolume[secGroup] = (weeklyGroupVolume[secGroup] || 0) + Math.round(weeklySets * weight)
            }
        }
    }

    function wouldOverflowSecondary(pick: PrescriptionExerciseRef, targetGroup: string): boolean {
        if (!pick.is_compound) return false
        for (const { group: secGroup, weight } of getContributions(targetGroup, pick.movement_pattern, true)) {
            const current = weeklyGroupVolume[secGroup] || 0
            const minAdd = Math.round(2 * freq * weight)
            if (current + minAdd > maxVolume) return true
        }
        return false
    }

    function maxSetsWithinBudget(pick: PrescriptionExerciseRef, targetGroup: string, baseSets: number): number {
        let allowed = baseSets
        const currentDirect = weeklyGroupVolume[targetGroup] || 0
        const directRoom = Math.max(0, maxVolume - currentDirect)
        allowed = Math.min(allowed, Math.ceil(directRoom / freq))
        if (pick.is_compound) {
            for (const { group: secGroup, weight } of getContributions(targetGroup, pick.movement_pattern, true)) {
                const currentSec = weeklyGroupVolume[secGroup] || 0
                const secRoom = Math.max(0, maxVolume - currentSec)
                if (weight > 0) {
                    allowed = Math.min(allowed, Math.ceil(secRoom / (freq * weight)))
                }
            }
        }
        return Math.max(2, allowed)
    }

    // ── Phase 1: One compound per primary group ──
    let hasCompoundInWorkout = false

    for (const group of primaryGroups) {
        if (items.length >= max) break
        if ((weeklyGroupVolume[group] || 0) >= maxVolume) continue

        const compoundCandidates = (byMuscleGroup.get(group) || [])
            .filter(e => e.is_compound && !usedExerciseIds.has(e.id))

        const sortedCompounds = sortByPrimaryGroupMatch(compoundCandidates, group, favoriteIds, level)
        const compoundPick = sortedCompounds[0] || null

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

    // ── Phase 2: One exercise per small group ──
    for (const group of smallGroups) {
        if (items.length >= max) break
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

    // ── Phase 3: Fill remaining slots ──
    for (const group of primaryGroups) {
        if (items.length >= max) break
        if ((weeklyGroupVolume[group] || 0) >= maxVolume) continue

        let candidates = (byMuscleGroup.get(group) || [])
            .filter(e => !usedExerciseIds.has(e.id))
        candidates = candidates.filter(e => !wouldOverflowSecondary(e, group))

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

    // ── Final: Sort by session_position ──
    const exerciseLookup = new Map(available.map(e => [e.id, e]))
    items.sort((a, b) => {
        const posA = SESSION_POSITION_ORDER[exerciseLookup.get(a.exercise_id)?.session_position || 'middle'] ?? 1
        const posB = SESSION_POSITION_ORDER[exerciseLookup.get(b.exercise_id)?.session_position || 'middle'] ?? 1
        return posA - posB
    })
    items.forEach((item, idx) => { item.order_index = idx })

    items.forEach((item) => {
        const ex = exerciseLookup.get(item.exercise_id)
        if (!ex) return
        item.exercise_function = ex.is_compound ? 'main' : 'accessory'
    })

    const workoutName = `Treino ${String.fromCharCode(65 + orderIndex)} — ${label}`

    return {
        name: workoutName,
        order_index: orderIndex,
        scheduled_days: scheduledDays,
        items,
    }
}

function sortByPrimaryGroupMatch(
    candidates: PrescriptionExerciseRef[],
    targetGroup: string,
    favoriteIds: Set<string>,
    studentLevel: TrainingLevel = 'intermediate',
): PrescriptionExerciseRef[] {
    const diffPref = DIFFICULTY_PREFERENCE[studentLevel]

    return shuffleArray(candidates).sort((a, b) => {
        const aFav = favoriteIds.has(a.id) ? 0 : 1
        const bFav = favoriteIds.has(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav

        const aPrimMov = a.is_primary_movement ? 0 : 1
        const bPrimMov = b.is_primary_movement ? 0 : 1
        if (aPrimMov !== bPrimMov) return aPrimMov - bPrimMov

        const aPrimGrp = a.muscle_group_names[0] === targetGroup ? 0 : 1
        const bPrimGrp = b.muscle_group_names[0] === targetGroup ? 0 : 1
        if (aPrimGrp !== bPrimGrp) return aPrimGrp - bPrimGrp

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

    const sorted = shuffleArray(candidates).sort((a, b) => {
        const aFav = favoriteIds.has(a.id) ? 0 : 1
        const bFav = favoriteIds.has(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav

        const aDiff = diffPref[a.difficulty_level] ?? 1
        const bDiff = diffPref[b.difficulty_level] ?? 1
        return aDiff - bDiff
    })

    return sorted[0]
}

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
// Legacy Reasoning
// ============================================================================

function buildLegacyReasoning(
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

// BUILDER_SECONDARY_MAP removed — now using getContributions() from contribution-matrix.ts

function capSecondaryVolumeOverflow(
    workouts: GeneratedWorkout[],
    available: PrescriptionExerciseRef[],
    level: TrainingLevel,
): void {
    const exerciseMap = new Map(available.map(e => [e.id, e]))
    const maxSets = VOLUME_RANGES[level].max
    const minSets = VOLUME_RANGES[level].min

    for (let pass = 0; pass < 3; pass++) {
        const weeklyVolume = computeWeeklyVolumePerMuscle(workouts, exerciseMap)
        let anyChanged = false

        for (const group of PRIMARY_MUSCLE_GROUPS) {
            const totalSets = weeklyVolume[group] || 0
            if (totalSets <= maxSets) continue

            let excess = totalSets - maxSets

            type Contribution = {
                workout: GeneratedWorkout
                item: GeneratedWorkoutItem
                frequency: number
                isDirect: boolean
                weight: number
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
                        const secondaries = getContributions(item.exercise_muscle_group, ref?.movement_pattern ?? null, true)
                        const sec = secondaries.find(s => s.group === group)
                        if (sec) {
                            contributions.push({ workout, item, frequency: freq, isDirect: false, weight: sec.weight, isCompound: true })
                        }
                    }
                }
            }

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
