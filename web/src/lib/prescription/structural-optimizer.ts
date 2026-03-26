// ============================================================================
// Kinevo Prescription Engine — Structural Optimizer
// ============================================================================
// Deterministic post-builder optimization layer. Runs AFTER the slot builder
// and BEFORE validation. Improves stimulus quality and time utilization
// without breaking constraints.
//
// Three responsibilities:
// 1. computeStimulusFactor()     — scores exercise quality (0.5–1.2)
// 2. structuralOptimizer()       — swaps low-stimulus exercises, fills time gaps
// 3. generateTradeoffReport()    — explains volume limitations to trainer

import type {
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    PrescriptionQualityScore,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

import type { PrescriptionConstraints } from './constraints-engine'

import { computeWeeklyVolumePerMuscle } from './rules-engine'
import { FREQUENCY_STRUCTURE, VOLUME_RANGES } from '@kinevo/shared/types/prescription'
import { PRIMARY_MUSCLE_GROUPS, SMALL_MUSCLE_GROUPS, REP_RANGES_BY_GOAL, REST_SECONDS } from './constants'

// ============================================================================
// 1. Stimulus Factor
// ============================================================================

/**
 * Computes a stimulus quality factor (0.5–1.2) for an exercise.
 * Derived from existing fields — no new data needed.
 *
 * High factor = more mechanical tension, more motor units, more growth stimulus.
 * Low factor  = less demanding, lower stimulus per set.
 *
 * Used to prioritize high-quality exercises when volume is constrained.
 */
export function computeStimulusFactor(exercise: PrescriptionExerciseRef): number {
    // Compounds generate more stimulus than isolations
    let factor = exercise.is_compound ? 1.0 : 0.70

    // Fatigue class reflects CNS demand and load capacity
    if (exercise.fatigue_class === 'high') {
        factor += 0.10
    } else if (exercise.fatigue_class === 'low') {
        factor -= 0.10
    }

    // Primary movements are the best-in-class compounds
    if (exercise.is_primary_movement) {
        factor += 0.05
    }

    return Math.max(0.50, Math.min(1.20, factor))
}

// ============================================================================
// 2. Structural Optimizer
// ============================================================================

/**
 * Applies deterministic optimizations to a builder output:
 *   Rule 1: Swap low-stimulus exercises for high-stimulus alternatives
 *   Rule 2: Add +1 set where time allows and group is under budget
 *
 * Mutates a deep copy — original is not touched.
 * Returns the optimized output + a log of changes made.
 */
export function structuralOptimizer(
    generated: PrescriptionOutputSnapshot,
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
    exercisePool: PrescriptionExerciseRef[],
): { output: PrescriptionOutputSnapshot; changes: string[] } {
    // Deep copy
    const output: PrescriptionOutputSnapshot = JSON.parse(JSON.stringify(generated))
    const changes: string[] = []

    const exerciseMap = new Map(exercisePool.map(e => [e.id, e]))

    // Collect all exercise IDs currently in the program (for duplicate prevention)
    const usedIds = new Set<string>()
    for (const w of output.workouts) {
        for (const item of w.items) {
            if (item.exercise_id) usedIds.add(item.exercise_id)
        }
    }

    // ---- Rule 1: Swap low-stimulus for high-stimulus ----
    applyRule1_StimulusSwaps(output, exerciseMap, exercisePool, usedIds, constraints, changes)

    // ---- Rule 2: Add +1 set where time allows ----
    applyRule2_FillTimeSets(output, exerciseMap, profile, constraints, changes)

    // ---- Rule 3: Inject coverage for uncovered small groups ----
    applyRule3_CoverageInjection(output, exerciseMap, exercisePool, usedIds, profile, constraints, changes)

    if (changes.length > 0) {
        console.log(`[StructuralOptimizer] Applied ${changes.length} optimizations:`, changes)
    }

    return { output, changes }
}

// ---- Rule 1 implementation ----

const STIMULUS_GAIN_THRESHOLD = 0.15

function applyRule1_StimulusSwaps(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    pool: PrescriptionExerciseRef[],
    usedIds: Set<string>,
    constraints: PrescriptionConstraints,
    changes: string[],
): void {
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)

    for (const workout of output.workouts) {
        for (const item of getExerciseItems(workout.items)) {
            if (!item.exercise_id) continue
            const current = exerciseMap.get(item.exercise_id)
            if (!current) continue

            const currentFactor = computeStimulusFactor(current)
            if (currentFactor >= 0.90) continue // Already good

            const group = item.exercise_muscle_group || current.muscle_group_names[0]
            if (!group) continue

            // Only optimize if this group is at or below budget
            const budget = constraints.volume_budget[group]
            const groupVol = weeklyVolume[group] || 0
            if (budget && groupVol > budget.max) continue // Over budget, don't touch

            // Find a better exercise: same primary group, not already used, higher stimulus
            const candidate = pool
                .filter(e =>
                    e.id !== current.id &&
                    !usedIds.has(e.id) &&
                    e.muscle_group_names[0] === current.muscle_group_names[0] &&
                    computeStimulusFactor(e) >= currentFactor + STIMULUS_GAIN_THRESHOLD &&
                    !isProhibited(e, constraints) &&
                    matchesMovementCategory(e, current),
                )
                .sort((a, b) => computeStimulusFactor(b) - computeStimulusFactor(a))[0]

            if (!candidate) continue

            const newFactor = computeStimulusFactor(candidate)

            // Swap: keep sets, reps, rest, function, order
            usedIds.delete(current.id)
            usedIds.add(candidate.id)

            item.exercise_id = candidate.id
            item.exercise_name = candidate.name
            item.exercise_muscle_group = group
            item.exercise_equipment = candidate.equipment

            changes.push(
                `Swap: ${current.name} (${currentFactor.toFixed(2)}) → ${candidate.name} (${newFactor.toFixed(2)}) [${group}]`,
            )
        }
    }
}

// ---- Rule 2 implementation ----

const TIME_MARGIN_FACTOR = 0.92 // Use up to 92% of session time
const AVG_REP_DURATION_SEC = 4
const SETUP_TIME_MIN = 1.5

function applyRule2_FillTimeSets(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
    changes: string[],
): void {
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)

    for (const workout of output.workouts) {
        const duration = estimateWorkoutDuration(workout)
        const maxDuration = profile.session_duration_minutes * TIME_MARGIN_FACTOR
        let room = maxDuration - duration

        if (room < 3) continue // Less than 3 min free, skip

        const freq = Math.max(1, workout.scheduled_days.length)

        // Try to add +1 set to exercises whose group is under budget
        // Prioritize: groups furthest below their budget.min
        const candidates = getExerciseItems(workout.items)
            .filter(item => {
                if (!item.exercise_id || item.sets == null) return false
                const ref = exerciseMap.get(item.exercise_id)
                if (!ref) return false
                const group = item.exercise_muscle_group || ref.muscle_group_names[0]
                const budget = constraints.volume_budget[group]
                if (!budget) return false
                const currentVol = weeklyVolume[group] || 0
                return currentVol < budget.min && item.sets < 5 // Never exceed 5 sets per exercise
            })
            .map(item => {
                const group = item.exercise_muscle_group || ''
                const budget = constraints.volume_budget[group]
                const deficit = (budget?.min || 0) - (weeklyVolume[group] || 0)
                return { item, group, deficit }
            })
            .sort((a, b) => b.deficit - a.deficit)

        for (const { item, group } of candidates) {
            if (room < 2) break

            // Estimate cost of +1 set
            const reps = parseInt(item.reps || '10') || 10
            const setCostMin = ((reps * AVG_REP_DURATION_SEC) + (item.rest_seconds ?? 60)) / 60

            if (setCostMin > room) continue

            item.sets = (item.sets ?? 0) + 1
            room -= setCostMin
            weeklyVolume[group] = (weeklyVolume[group] || 0) + freq

            changes.push(
                `+1 set: ${item.exercise_name} → ${item.sets} sets [${group}, deficit: ${(constraints.volume_budget[group]?.min || 0) - (weeklyVolume[group] || 0)} remaining]`,
            )
        }
    }
}

// ---- Rule 3 implementation ----

/**
 * Small muscle groups that should always have at least 1 exercise per week.
 * If any of these has 0 sets after builder + Rules 1-2, inject a lightweight
 * isolation exercise in the workout with the most time room.
 */
const COVERAGE_MANDATORY_GROUPS = ['Abdominais', 'Panturrilha', 'Adutores'] as const
const COVERAGE_INJECT_SETS = 2

function applyRule3_CoverageInjection(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    pool: PrescriptionExerciseRef[],
    usedIds: Set<string>,
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
    changes: string[],
): void {
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)

    for (const group of COVERAGE_MANDATORY_GROUPS) {
        // Skip if group already has volume
        if ((weeklyVolume[group] || 0) > 0) continue

        // Skip if group is prohibited
        if (constraints.prohibited_muscle_groups.includes(group)) continue

        // Find an isolation exercise for this group from the pool
        const candidate = pool
            .filter(e =>
                e.muscle_group_names[0] === group &&
                !e.is_compound &&
                !usedIds.has(e.id) &&
                !isProhibited(e, constraints),
            )
            .sort((a, b) => computeStimulusFactor(b) - computeStimulusFactor(a))[0]

        if (!candidate) continue

        // Find the workout with the most time room to inject into
        // Prefer leg days for Panturrilha/Adutores, any day for Abdominais
        const isLowerGroup = group === 'Panturrilha' || group === 'Adutores'
        const lowerGroups = ['Quadríceps', 'Posterior de Coxa', 'Glúteo']

        let bestWorkout: GeneratedWorkout | null = null
        let bestRoom = 0

        for (const workout of output.workouts) {
            const duration = estimateWorkoutDuration(workout)
            const maxDuration = profile.session_duration_minutes * TIME_MARGIN_FACTOR
            const room = maxDuration - duration

            // For lower body groups, prefer workouts that already train legs
            if (isLowerGroup) {
                const hasLowerExercise = workout.items.some(item => {
                    const g = item.exercise_muscle_group
                    return g && lowerGroups.includes(g)
                })
                if (!hasLowerExercise) continue
            }

            if (room > bestRoom) {
                bestRoom = room
                bestWorkout = workout
            }
        }

        // Fallback: if no lower-body workout found, pick any workout with room
        if (!bestWorkout && isLowerGroup) {
            for (const workout of output.workouts) {
                const duration = estimateWorkoutDuration(workout)
                const maxDuration = profile.session_duration_minutes * TIME_MARGIN_FACTOR
                const room = maxDuration - duration
                if (room > bestRoom) {
                    bestRoom = room
                    bestWorkout = workout
                }
            }
        }

        if (!bestWorkout) continue

        // Build the workout item
        const goal = profile.goal || 'hypertrophy'
        const repRange = REP_RANGES_BY_GOAL[goal as keyof typeof REP_RANGES_BY_GOAL]?.isolation || '12-15'
        const restSec = REST_SECONDS.isolation[goal as keyof typeof REST_SECONDS.isolation] || 60

        const newItem: GeneratedWorkoutItem = {
            item_type: 'exercise',
            exercise_id: candidate.id,
            exercise_name: candidate.name,
            exercise_muscle_group: group,
            exercise_equipment: candidate.equipment,
            sets: COVERAGE_INJECT_SETS,
            reps: repRange,
            rest_seconds: restSec,
            order_index: bestWorkout.items.length,
            exercise_function: 'accessory',
        }

        bestWorkout.items.push(newItem)
        usedIds.add(candidate.id)

        const freq = Math.max(1, bestWorkout.scheduled_days.length)
        weeklyVolume[group] = (weeklyVolume[group] || 0) + COVERAGE_INJECT_SETS * freq

        changes.push(
            `+Coverage: ${candidate.name} (${COVERAGE_INJECT_SETS}×${repRange}) → ${bestWorkout.name || 'workout'} [${group}]`,
        )
    }
}

// ============================================================================
// 3. Trade-off Report
// ============================================================================

export interface TradeoffLimitation {
    group: string
    actual_volume: number
    ideal_volume: number
    structural_max: number
    cause: 'frequency' | 'duration' | 'split'
    description: string
}

export interface TradeoffSuggestion {
    action: string
    impact: string
    priority: number // 1 = highest
}

export interface TradeoffReport {
    limitations: TradeoffLimitation[]
    suggestions: TradeoffSuggestion[]
}

/**
 * Analyzes a generated program and produces a structured report of volume
 * trade-offs and actionable suggestions for the trainer.
 *
 * Only reports groups where the achievable volume is meaningfully below
 * the methodology ideal (VOLUME_RANGES[level]).
 */
export function generateTradeoffReport(
    output: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): TradeoffReport {
    const limitations: TradeoffLimitation[] = []
    const suggestions: TradeoffSuggestion[] = []

    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)
    const frequency = profile.available_days.length

    const idealRange = VOLUME_RANGES[profile.training_level]

    // Check each budgeted group
    for (const [group, budget] of Object.entries(constraints.volume_budget)) {
        const actual = weeklyVolume[group] || 0
        const idealMin = isPrimaryGroup(group) ? idealRange.min : Math.round(idealRange.min * 0.5)

        // Only report if actual is meaningfully below ideal (>25% gap)
        const gap = idealMin - actual
        if (gap <= 0 || gap / idealMin < 0.25) continue

        // Determine cause
        const cause = determineLimitationCause(group, frequency, profile, constraints)

        limitations.push({
            group,
            actual_volume: actual,
            ideal_volume: idealMin,
            structural_max: budget.max,
            cause,
            description: buildLimitationDescription(group, actual, idealMin, cause, frequency, profile),
        })
    }

    // Generate suggestions from limitations
    if (limitations.length === 0) return { limitations, suggestions }

    const hasFrequencyLimitation = limitations.some(l => l.cause === 'frequency')
    const hasDurationLimitation = limitations.some(l => l.cause === 'duration')

    if (hasFrequencyLimitation && frequency < 6) {
        const nextFreq = frequency + 1
        const nextSplit = FREQUENCY_STRUCTURE[nextFreq as keyof typeof FREQUENCY_STRUCTURE]
        if (nextSplit) {
            suggestions.push({
                action: `Aumentar frequência para ${nextFreq}x/semana`,
                impact: `Mudaria para split ${formatSplitName(nextSplit)}, distribuindo volume em mais sessões`,
                priority: 1,
            })
        }
    }

    if (hasDurationLimitation) {
        const newDuration = profile.session_duration_minutes + 15
        if (newDuration <= 120) {
            suggestions.push({
                action: `Aumentar duração para ${newDuration} minutos`,
                impact: `Permitiria ~${Math.floor(newDuration / 9)} exercícios por sessão (+1-2)`,
                priority: 2,
            })
        }
    }

    // Stimulus quality suggestion
    const avgStimulus = computeAverageStimulusFactor(output, exerciseMap)
    if (avgStimulus < 0.88) {
        suggestions.push({
            action: `Priorizar compostos livres de alta carga`,
            impact: `Estímulo médio atual: ${Math.round(avgStimulus * 100)}%. Compostos livres atingem ~115%`,
            priority: 3,
        })
    }

    return { limitations, suggestions }
}

// ============================================================================
// 4. Prescription Quality Score (PQS)
// ============================================================================

/**
 * Computes a multi-dimensional quality score (0–100) for a generated program.
 *
 * Dimensions:
 *   Stimulus    (0–40)  — exercise quality based on stimulus factor
 *   Coverage    (0–25)  — muscle group completeness vs budget
 *   Distribution (0–20) — volume balance across groups
 *   Efficiency  (0–15)  — session time utilization
 *
 * Returns breakdown + human-readable summary in Portuguese.
 */
export function computePrescriptionQualityScore(
    output: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    profile: StudentPrescriptionProfile,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
    tradeoffReport?: TradeoffReport,
): PrescriptionQualityScore {
    const stimulus = scoreStimulusDimension(output, exerciseMap)
    const coverage = scoreCoverageDimension(output, constraints, exerciseMap)
    const distribution = scoreDistributionDimension(output, constraints, exerciseMap)
    const efficiency = scoreEfficiencyDimension(output, profile)

    const total = Math.round(stimulus + coverage + distribution + efficiency)
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)
    const avgStimulus = computeAverageStimulusFactor(output, exerciseMap)

    const summary = generatePrescriptionSummary({
        total,
        breakdown: { stimulus, coverage, distribution, efficiency },
        tradeoffs: tradeoffReport ?? null,
        volumes: weeklyVolume,
        volumeBudget: constraints.volume_budget,
        stimulus: avgStimulus,
        frequency: profile.available_days.length,
    })

    return {
        total,
        breakdown: {
            stimulus: Math.round(stimulus * 10) / 10,
            coverage: Math.round(coverage * 10) / 10,
            distribution: Math.round(distribution * 10) / 10,
            efficiency: Math.round(efficiency * 10) / 10,
        },
        summary,
    }
}

// ── Stimulus (0–40) ──

function scoreStimulusDimension(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): number {
    const MAX = 40
    let totalFactor = 0
    let totalWeight = 0

    for (const w of output.workouts) {
        for (const item of getExerciseItems(w.items)) {
            if (!item.exercise_id) continue
            const ref = exerciseMap.get(item.exercise_id)
            if (!ref) continue

            const factor = computeStimulusFactor(ref)
            const sets = item.sets ?? 0
            // Weight by sets — exercises with more sets matter more
            totalFactor += factor * sets
            totalWeight += sets
        }
    }

    if (totalWeight === 0) return 0

    // Average stimulus weighted by sets. Max possible is 1.15 (compound+high+primary).
    // Map 0.5–1.15 → 0–40
    const avgStimulus = totalFactor / totalWeight
    const normalized = Math.max(0, Math.min(1, (avgStimulus - 0.5) / 0.65))
    return normalized * MAX
}

// ── Coverage (0–25) ──

function scoreCoverageDimension(
    output: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): number {
    const MAX = 25
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)
    const budgetEntries = Object.entries(constraints.volume_budget)

    if (budgetEntries.length === 0) return MAX

    let totalScore = 0
    for (const [group, budget] of budgetEntries) {
        const actual = weeklyVolume[group] || 0

        if (actual === 0) {
            // Zero sets = 0 points for this group
            totalScore += 0
        } else if (actual >= budget.min) {
            // At or above minimum = full credit
            totalScore += 1
        } else {
            // Below minimum = proportional credit
            totalScore += actual / budget.min
        }
    }

    return (totalScore / budgetEntries.length) * MAX
}

// ── Distribution (0–20) ──

function scoreDistributionDimension(
    output: PrescriptionOutputSnapshot,
    constraints: PrescriptionConstraints,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): number {
    const MAX = 20
    const weeklyVolume = computeWeeklyVolumePerMuscle(output.workouts, exerciseMap)
    const budgetEntries = Object.entries(constraints.volume_budget)

    if (budgetEntries.length === 0) return MAX

    // Score each group by how close it is to the midpoint of its budget range
    let totalScore = 0
    for (const [group, budget] of budgetEntries) {
        const actual = weeklyVolume[group] || 0
        const midpoint = (budget.min + budget.max) / 2

        if (midpoint === 0) {
            totalScore += 1
            continue
        }

        if (actual >= budget.min && actual <= budget.max) {
            // Within range — score by proximity to midpoint
            const distFromMid = Math.abs(actual - midpoint) / midpoint
            totalScore += 1 - distFromMid * 0.3 // Max 30% penalty for being at edge of range
        } else if (actual < budget.min) {
            // Below range — proportional penalty
            totalScore += Math.max(0, actual / budget.min * 0.7)
        } else {
            // Above range — overshoot penalty (less severe than undershoot)
            const overshoot = (actual - budget.max) / budget.max
            totalScore += Math.max(0.3, 1 - overshoot * 0.5)
        }
    }

    return (totalScore / budgetEntries.length) * MAX
}

// ── Efficiency (0–15) ──

function scoreEfficiencyDimension(
    output: PrescriptionOutputSnapshot,
    profile: StudentPrescriptionProfile,
): number {
    const MAX = 15
    const targetDuration = profile.session_duration_minutes

    if (targetDuration <= 0) return MAX

    let totalScore = 0
    const workoutCount = output.workouts.length

    if (workoutCount === 0) return 0

    for (const workout of output.workouts) {
        const estimated = estimateWorkoutDuration(workout)
        const utilization = estimated / targetDuration

        // Ideal: 80–95% utilization
        if (utilization >= 0.80 && utilization <= 0.95) {
            totalScore += 1.0
        } else if (utilization >= 0.65 && utilization < 0.80) {
            // Slightly under — small penalty
            totalScore += 0.7
        } else if (utilization > 0.95 && utilization <= 1.10) {
            // Slightly over — small penalty
            totalScore += 0.8
        } else if (utilization < 0.65) {
            // Too short — wasting session time
            totalScore += Math.max(0.2, utilization / 0.65 * 0.5)
        } else {
            // Too long — overflow penalty
            totalScore += Math.max(0.2, 1 - (utilization - 1.10) * 0.5)
        }
    }

    return (totalScore / workoutCount) * MAX
}

// ── Summary Generator ──

interface SummaryInput {
    total: number
    breakdown: { stimulus: number; coverage: number; distribution: number; efficiency: number }
    tradeoffs: TradeoffReport | null
    volumes: Record<string, number>
    volumeBudget: Record<string, { min: number; max: number }>
    stimulus: number
    frequency: number
}

/**
 * Generates a concise, specific summary (2–3 sentences max).
 *
 * Structure:
 *   1. Headline — overall quality assessment
 *   2. Main insight — most impactful limitation OR strongest point
 *   3. Secondary insight or suggestion (optional, max 1)
 */
function generatePrescriptionSummary(input: SummaryInput): string {
    const { total, breakdown, tradeoffs, volumes, volumeBudget, stimulus, frequency } = input
    const parts: string[] = []

    // ── 1. Headline (mandatory) ──
    if (total >= 85) {
        parts.push('Treino muito bem estruturado')
    } else if (total >= 70) {
        parts.push('Treino bem equilibrado')
    } else if (total >= 55) {
        parts.push('Treino adequado, com pontos a melhorar')
    } else {
        parts.push('Treino com limitações importantes')
    }

    // ── Collect candidate insights, ranked by impact ──
    const insights: Array<{ text: string; priority: number }> = []

    // Insight from trade-off limitations (most valuable — real data)
    if (tradeoffs && tradeoffs.limitations.length > 0) {
        // Pick the worst limitation (primary groups first, then largest gap)
        const sorted = [...tradeoffs.limitations].sort((a, b) => {
            const aPrimary = isPrimaryGroup(a.group) ? 0 : 1
            const bPrimary = isPrimaryGroup(b.group) ? 0 : 1
            if (aPrimary !== bPrimary) return aPrimary - bPrimary
            return (b.ideal_volume - b.actual_volume) - (a.ideal_volume - a.actual_volume)
        })

        const worst = sorted[0]
        const causeText = worst.cause === 'frequency'
            ? `frequência de ${frequency}x/semana`
            : worst.cause === 'duration'
                ? 'duração limitada das sessões'
                : 'distribuição do split atual'
        insights.push({
            text: `${worst.group} abaixo do ideal (${worst.actual_volume} sets/sem vs ${worst.ideal_volume} recomendados) devido à ${causeText}`,
            priority: 1,
        })
    }

    // Insight from volume overshoot (group with most excess)
    const overshootEntries: Array<{ group: string; excess: number; actual: number; max: number }> = []
    for (const [group, budget] of Object.entries(volumeBudget)) {
        const actual = volumes[group] || 0
        if (actual > budget.max * 1.2) {
            overshootEntries.push({ group, excess: actual - budget.max, actual: Math.round(actual), max: budget.max })
        }
    }
    if (overshootEntries.length > 0) {
        const worst = overshootEntries.sort((a, b) => b.excess - a.excess)[0]
        insights.push({
            text: `${worst.group} com volume elevado (${worst.actual} sets/sem vs máximo de ${worst.max})`,
            priority: total >= 85 ? 5 : 3, // lower priority if program is already great
        })
    }

    // Insight from stimulus quality
    if (stimulus >= 0.95) {
        insights.push({
            text: 'excelente seleção de exercícios compostos de alta qualidade',
            priority: total >= 85 ? 2 : 4,
        })
    } else if (stimulus >= 0.85) {
        insights.push({
            text: 'bom nível de estímulo muscular',
            priority: total >= 85 ? 2 : 5,
        })
    } else if (stimulus < 0.75) {
        insights.push({
            text: `estímulo geral baixo (${Math.round(stimulus * 100)}%) — mais exercícios compostos podem ajudar`,
            priority: 2,
        })
    }

    // Insight from zero-coverage groups
    const zeroGroups = Object.entries(volumeBudget)
        .filter(([group]) => (volumes[group] || 0) === 0)
        .map(([group]) => group)
    if (zeroGroups.length > 0) {
        insights.push({
            text: `${zeroGroups.join(', ')} sem volume direto no programa`,
            priority: 1,
        })
    }

    // Insight from efficiency dimension
    const effPct = breakdown.efficiency / 15
    if (effPct < 0.5) {
        insights.push({
            text: 'duração das sessões pode ser melhor aproveitada',
            priority: 3,
        })
    }

    // ── 2. Main insight (mandatory — pick highest priority) ──
    insights.sort((a, b) => a.priority - b.priority)
    if (insights.length > 0) {
        parts.push(insights[0].text)
    }

    // ── 3. Suggestion OR secondary insight (optional, max 1) ──
    // Prefer a suggestion from trade-off report if available
    if (tradeoffs && tradeoffs.suggestions.length > 0) {
        const bestSuggestion = [...tradeoffs.suggestions].sort((a, b) => a.priority - b.priority)[0]
        parts.push(bestSuggestion.action)
    } else if (insights.length > 1) {
        parts.push(insights[1].text)
    }

    // Join with ". " — capitalize first letter of each sentence
    return parts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('. ')
        + '.'
}

// ============================================================================
// Helpers
// ============================================================================

function getExerciseItems(items: GeneratedWorkoutItem[]): GeneratedWorkoutItem[] {
    return items.filter(item => (item.item_type || 'exercise') === 'exercise')
}

function isProhibited(exercise: PrescriptionExerciseRef, constraints: PrescriptionConstraints): boolean {
    if (constraints.prohibited_exercise_ids.includes(exercise.id)) return true
    if (constraints.prohibited_muscle_groups.some(g => exercise.muscle_group_names.includes(g))) return true
    return false
}

/**
 * Checks if two exercises belong to compatible movement categories.
 * Prevents swapping a compound for an isolation or vice versa.
 */
function matchesMovementCategory(candidate: PrescriptionExerciseRef, current: PrescriptionExerciseRef): boolean {
    // Both compound or both isolation
    if (candidate.is_compound !== current.is_compound) return false
    // Same session position (first/middle/last)
    if (candidate.session_position !== current.session_position) return false
    return true
}

function estimateWorkoutDuration(workout: GeneratedWorkout): number {
    let totalMinutes = 0
    for (const item of workout.items) {
        const itemType = item.item_type || 'exercise'
        if (itemType === 'warmup') {
            totalMinutes += (item.item_config as any)?.duration_minutes ?? 5
            continue
        }
        if (itemType === 'cardio') {
            const cfg = item.item_config as any
            if (cfg?.mode === 'interval' && cfg?.intervals) {
                const { work_seconds = 30, rest_seconds: restSec = 15, rounds = 8 } = cfg.intervals
                totalMinutes += ((work_seconds * rounds) + (restSec * (rounds - 1))) / 60
            } else {
                totalMinutes += cfg?.duration_minutes ?? 15
            }
            continue
        }
        const reps = parseInt(item.reps || '10') || 10
        const repTime = ((item.sets ?? 0) * reps * AVG_REP_DURATION_SEC) / 60
        const restTime = ((item.sets ?? 0) * (item.rest_seconds ?? 60)) / 60
        totalMinutes += repTime + restTime + SETUP_TIME_MIN
    }
    return totalMinutes
}

function isPrimaryGroup(group: string): boolean {
    return PRIMARY_MUSCLE_GROUPS.includes(group)
}

function determineLimitationCause(
    group: string,
    frequency: number,
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
): 'frequency' | 'duration' | 'split' {
    // Count how many workouts include this group
    const groupOccurrences = constraints.split_detail.filter(
        d => d.muscle_groups.includes(group),
    ).length

    if (groupOccurrences <= 1 && frequency <= 4) return 'frequency'
    if (constraints.exercises_per_session <= 5) return 'duration'
    return 'split'
}

function buildLimitationDescription(
    group: string,
    actual: number,
    ideal: number,
    cause: 'frequency' | 'duration' | 'split',
    frequency: number,
    profile: StudentPrescriptionProfile,
): string {
    switch (cause) {
        case 'frequency':
            return `${group}: ${actual} sets/sem (ideal: ${ideal}) — limitado pela frequência de ${frequency}x/sem`
        case 'duration':
            return `${group}: ${actual} sets/sem (ideal: ${ideal}) — limitado pela duração de ${profile.session_duration_minutes}min`
        case 'split':
            return `${group}: ${actual} sets/sem (ideal: ${ideal}) — distribuição do split não permite mais`
    }
}

function computeAverageStimulusFactor(
    output: PrescriptionOutputSnapshot,
    exerciseMap: Map<string, PrescriptionExerciseRef>,
): number {
    let totalFactor = 0
    let count = 0
    for (const w of output.workouts) {
        for (const item of getExerciseItems(w.items)) {
            if (!item.exercise_id) continue
            const ref = exerciseMap.get(item.exercise_id)
            if (!ref) continue
            totalFactor += computeStimulusFactor(ref)
            count++
        }
    }
    return count > 0 ? totalFactor / count : 0.75
}

function formatSplitName(splitType: string): string {
    const names: Record<string, string> = {
        full_body: 'Full Body',
        upper_lower: 'Upper/Lower',
        ppl_plus: 'Push/Pull/Legs+',
        ppl_complete: 'Push/Pull/Legs',
    }
    return names[splitType] || splitType
}
