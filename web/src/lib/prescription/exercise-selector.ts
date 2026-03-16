// ============================================================================
// Kinevo Prescription Engine — Smart Exercise Selector
// ============================================================================
// Replaces selectBalancedExercises() with score-based selection that considers
// safety, novelty, difficulty match, and preferences. Ensures movement pattern
// diversity within each muscle group.

import type { PrescriptionExerciseRef } from '@kinevo/shared/types/prescription'
import type { PrescriptionConstraints } from './constraints-engine'

// ============================================================================
// Types
// ============================================================================

export interface ScoredExercise extends PrescriptionExerciseRef {
    adequacy_score: number // 0-100
}

interface ScoreWeights {
    safety: number
    novelty: number
    difficulty: number
    preference: number
}

// ============================================================================
// Config
// ============================================================================

const DEFAULT_WEIGHTS: ScoreWeights = {
    safety: 0.35,
    novelty: 0.25,
    difficulty: 0.20,
    preference: 0.20,
}

/** Original limits (pre-Tier 1) — kept for feature flag fallback */
const SMART_GROUP_LIMITS_ORIGINAL: Record<string, number> = {
    'Peito': 8,
    'Costas': 8,
    'Ombros': 8,
    'Quadríceps': 8,
    'Glúteo': 8,
    'Posterior de Coxa': 6,
    'Bíceps': 5,
    'Tríceps': 5,
    'Panturrilha': 4,
    'Abdominais': 6,
    'Oblíquos': 3,
    'Adutores': 3,
    'Trapézio': 3,
    'Antebraço': 2,
}

/** Tier 1 compact limits — sized to typical program needs + 1-2 alternatives */
const SMART_GROUP_LIMITS_COMPACT: Record<string, number> = {
    'Peito': 4,
    'Costas': 4,
    'Ombros': 3,
    'Quadríceps': 4,
    'Glúteo': 3,
    'Posterior de Coxa': 3,
    'Bíceps': 2,
    'Tríceps': 2,
    'Panturrilha': 2,
    'Abdominais': 2,
    'Oblíquos': 1,
    'Adutores': 1,
    'Trapézio': 1,
    'Antebraço': 1,
}

function getSmartGroupLimits(): Record<string, number> {
    const useCompact = process.env.ENABLE_COMPACT_EXERCISE_POOL !== 'false'
    return useCompact ? SMART_GROUP_LIMITS_COMPACT : SMART_GROUP_LIMITS_ORIGINAL
}

// ============================================================================
// Score computation
// ============================================================================

export function computeAdequacyScore(
    exercise: PrescriptionExerciseRef,
    constraints: PrescriptionConstraints,
    previousExerciseIds: Set<string>,
): number {
    // --- SAFETY (0-100, weight 0.35) ---
    const isProhibited = constraints.prohibited_exercise_ids.includes(exercise.id)
    const isRestrictedGroup = exercise.muscle_group_names.some(
        g => constraints.prohibited_muscle_groups.includes(g),
    )
    const safetyScore = isProhibited ? 0 : isRestrictedGroup ? 30 : 100

    // --- NOVELTY (0-100, weight 0.25) ---
    const noveltyScore = previousExerciseIds.has(exercise.id) ? 40 : 100

    // --- DIFFICULTY MATCH (0-100, weight 0.20) ---
    const levelMap: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
    const exerciseLevel = levelMap[exercise.difficulty_level] ?? 1
    // Infer student level from volume budget
    const chestMax = constraints.volume_budget['Peito']?.max ?? 15
    const studentLevel = chestMax <= 12 ? 0 : chestMax <= 15 ? 1 : 2
    const levelDiff = Math.abs(exerciseLevel - studentLevel)
    const difficultyScore = levelDiff === 0 ? 100 : levelDiff === 1 ? 60 : 20

    // --- PREFERENCE (0-100, weight 0.20) ---
    const isFavorite = constraints.favorite_exercise_ids.includes(exercise.id)
    const isDisliked = constraints.disliked_exercise_ids.includes(exercise.id)
    const preferenceScore = isDisliked ? 0 : isFavorite ? 100 : 50

    const baseScore = Math.round(
        safetyScore * DEFAULT_WEIGHTS.safety +
        noveltyScore * DEFAULT_WEIGHTS.novelty +
        difficultyScore * DEFAULT_WEIGHTS.difficulty +
        preferenceScore * DEFAULT_WEIGHTS.preference,
    )

    // Curated exercises get a small tiebreaker bonus
    const curatedBonus = exercise.prescription_notes ? 3 : 0

    return Math.min(100, baseScore + curatedBonus)
}

// ============================================================================
// Smart selection
// ============================================================================

export function selectSmartExercises(
    exercises: PrescriptionExerciseRef[],
    constraints: PrescriptionConstraints,
    previousExerciseIds: Set<string>,
): ScoredExercise[] {
    // STEP 1: Filter prohibited + disliked
    const safe = exercises.filter(ex => {
        if (constraints.prohibited_exercise_ids.includes(ex.id)) return false
        if (constraints.disliked_exercise_ids.includes(ex.id)) return false
        return true
    })

    // STEP 1.5: Hard difficulty filter
    // Remove advanced exercises for beginners or when adherence is minimal
    const chestMax = constraints.volume_budget['Peito']?.max ?? 15
    const studentLevel = chestMax <= 12 ? 'beginner' : chestMax <= 15 ? 'intermediate' : 'advanced'
    const levelFiltered = safe.filter(ex => {
        if (ex.difficulty_level === 'advanced') {
            if (studentLevel === 'beginner') return false
            if (constraints.adherence_adjustment === 'minimal') return false
        }
        return true
    })

    // STEP 2: Compute score for each exercise
    const scored: ScoredExercise[] = levelFiltered.map(ex => ({
        ...ex,
        adequacy_score: computeAdequacyScore(ex, constraints, previousExerciseIds),
    }))

    // STEP 3: Group by primary muscle group
    const byGroup: Record<string, ScoredExercise[]> = {}
    for (const ex of scored) {
        const group = ex.muscle_group_names[0] || 'Outros'
        if (!byGroup[group]) byGroup[group] = []
        byGroup[group].push(ex)
    }

    // STEP 4: Select top N per group with movement pattern diversity
    const selected: ScoredExercise[] = []
    const selectedIds = new Set<string>()

    const groupLimits = getSmartGroupLimits()

    for (const [group, limit] of Object.entries(groupLimits)) {
        const groupExercises = byGroup[group] || []

        // Sort by score descending
        groupExercises.sort((a, b) => b.adequacy_score - a.adequacy_score)

        // Pass 1: best of each movement_pattern
        const patternsUsed = new Set<string>()
        const groupSelected: ScoredExercise[] = []

        for (const ex of groupExercises) {
            if (groupSelected.length >= limit) break
            const mp = ex.movement_pattern || 'isolation'
            if (!patternsUsed.has(mp)) {
                patternsUsed.add(mp)
                groupSelected.push(ex)
            }
        }

        // Pass 2: fill remaining with best scores
        for (const ex of groupExercises) {
            if (groupSelected.length >= limit) break
            if (!groupSelected.includes(ex)) {
                groupSelected.push(ex)
            }
        }

        for (const ex of groupSelected) {
            if (!selectedIds.has(ex.id)) {
                selected.push(ex)
                selectedIds.add(ex.id)
            }
        }
    }

    // Diagnostic log
    const countByGroup: Record<string, number> = {}
    const countByPattern: Record<string, number> = {}
    const scores = selected.map(e => e.adequacy_score)
    for (const e of selected) {
        const g = e.muscle_group_names[0] || 'Outros'
        countByGroup[g] = (countByGroup[g] || 0) + 1
        const mp = e.movement_pattern || 'isolation'
        countByPattern[mp] = (countByPattern[mp] || 0) + 1
    }
    console.log(
        `[ExerciseSelector] Smart selection: ${selected.length} exercises. ` +
        `Score range: ${Math.min(...scores)}-${Math.max(...scores)}. ` +
        `Patterns: ${JSON.stringify(countByPattern)}`,
    )

    return selected
}
