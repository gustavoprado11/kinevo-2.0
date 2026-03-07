// ============================================================================
// Kinevo Prescription Engine — Constraints Engine
// ============================================================================
// Pre-computes structured constraints for a specific student/context before
// sending to the Claude agent. Replaces generic methodology text with concrete,
// individualized parameters.

import type {
    StudentPrescriptionProfile,
    PrescriptionAgentAnswer,
    MedicalRestriction,
    TrainingLevel,
    PrescriptionGoal,
} from '@kinevo/shared/types/prescription'

import type { EnrichedStudentContext } from './context-enricher'

import {
    VOLUME_RANGES,
    FREQUENCY_STRUCTURE,
    PRIMARY_MUSCLE_GROUPS,
    SMALL_MUSCLE_GROUPS,
    SECONDARY_VOLUME_FACTORS,
    SPLIT_TEMPLATES,
    REP_RANGES_BY_GOAL,
    REST_SECONDS,
} from './constants'

// ============================================================================
// Types
// ============================================================================

export interface PrescriptionConstraints {
    split_type: string
    split_detail: Array<{
        workout_name: string
        workout_focus: string
        muscle_groups: string[]
        scheduled_day: number
    }>
    volume_budget: Record<string, { min: number; max: number }>
    exercises_per_session: number
    session_duration_minutes: number
    clinical_conditions: string[]
    prohibited_exercise_ids: string[]
    prohibited_muscle_groups: string[]
    favorite_exercise_ids: string[]
    disliked_exercise_ids: string[]
    adherence_adjustment: 'normal' | 'reduced' | 'minimal'
    adherence_percentage: number
    rep_ranges: { compound: string; isolation: string }
    rest_seconds: { compound: number; isolation: number }
    /** Raw medical restrictions for condition-specific AI instructions */
    medical_restrictions: MedicalRestriction[]
    /** Muscle groups the trainer wants to emphasize (elevated volume min) */
    emphasized_groups: string[]
    /** Secondary groups deprioritized due to limited frequency */
    deprioritized_groups: string[]
}

// ============================================================================
// Emphasis Map — maps trainer answer options to muscle group names
// ============================================================================

export const EMPHASIS_MAP: Record<string, string[]> = {
    'Glúteo (mais volume)': ['Glúteo'],
    'Peito (mais volume)': ['Peito'],
    'Costas (mais volume)': ['Costas'],
    'Ombros (mais volume)': ['Ombros'],
    'Braços — Bíceps e Tríceps (mais volume)': ['Bíceps', 'Tríceps'],
    'Posterior de Coxa (mais volume)': ['Posterior de Coxa'],
    'Sem ênfase específica — distribuição equilibrada': [],
}

// ============================================================================
// Main builder
// ============================================================================

export function buildConstraints(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
    trainerAnswers: PrescriptionAgentAnswer[],
): PrescriptionConstraints {
    // 1. Adherence
    const adherencePercentage = computeAdherence(profile, enrichedContext)
    const adherenceAdjustment = classifyAdherence(adherencePercentage)

    // 2. Effective frequency (reduce if minimal adherence + high frequency)
    const rawFrequency = profile.available_days.length
    const effectiveFrequency = (adherenceAdjustment === 'minimal' && rawFrequency >= 5)
        ? 4
        : rawFrequency

    // 3. Split type
    const splitType = resolveSplitType(effectiveFrequency)

    // 4. Split detail
    const availableDays = adherenceAdjustment === 'minimal' && rawFrequency >= 5
        ? profile.available_days.slice(0, 4)
        : profile.available_days
    const splitDetail = buildSplitDetail(splitType, availableDays)

    // 5. Volume budget — pipeline order matters:
    //    base → frequency priority → emphasis → cap (LAST)
    let volumeBudget = buildVolumeBudget(profile.training_level)

    // 5.5 Deprioritize secondary groups based on frequency (BEFORE emphasis)
    const { budget: frequencyAdjustedBudget, deprioritized: deprioritizedGroups } =
        applyFrequencyPriority(volumeBudget, effectiveFrequency)
    volumeBudget = frequencyAdjustedBudget

    // 5.6 Parse emphasis from trainer answers and apply
    const emphasizedGroups = parseEmphasis(trainerAnswers)
    if (emphasizedGroups.length > 0) {
        volumeBudget = applyEmphasis(volumeBudget, emphasizedGroups, profile.training_level)
    }

    // 6. Exercises per session
    const exercisesPerSession = computeExercisesPerSession(
        profile.session_duration_minutes,
        adherenceAdjustment,
    )

    // 6.5 Cap volume budget to what's realistically achievable (LAST — overrides everything)
    volumeBudget = capVolumeBudget(volumeBudget, exercisesPerSession, effectiveFrequency)

    // 7. Clinical / prohibited
    const clinicalConditions: string[] = []
    const prohibitedExerciseIds: string[] = []
    const prohibitedMuscleGroups: string[] = []

    for (const restriction of profile.medical_restrictions) {
        clinicalConditions.push(restriction.description)
        prohibitedExerciseIds.push(...restriction.restricted_exercise_ids)
        prohibitedMuscleGroups.push(...restriction.restricted_muscle_groups)
    }

    // 8. Rep ranges / Rest
    const goal = profile.goal as PrescriptionGoal
    const repRanges = {
        compound: REP_RANGES_BY_GOAL[goal].compound,
        isolation: REP_RANGES_BY_GOAL[goal].isolation,
    }
    const restSeconds = {
        compound: REST_SECONDS.compound[goal],
        isolation: REST_SECONDS.isolation[goal],
    }

    return {
        split_type: splitType,
        split_detail: splitDetail,
        volume_budget: volumeBudget,
        exercises_per_session: exercisesPerSession,
        session_duration_minutes: profile.session_duration_minutes,
        clinical_conditions: clinicalConditions,
        prohibited_exercise_ids: [...new Set(prohibitedExerciseIds)],
        prohibited_muscle_groups: [...new Set(prohibitedMuscleGroups)],
        favorite_exercise_ids: profile.favorite_exercise_ids,
        disliked_exercise_ids: profile.disliked_exercise_ids,
        adherence_adjustment: adherenceAdjustment,
        adherence_percentage: adherencePercentage,
        rep_ranges: repRanges,
        rest_seconds: restSeconds,
        medical_restrictions: profile.medical_restrictions,
        emphasized_groups: emphasizedGroups,
        deprioritized_groups: deprioritizedGroups,
    }
}

// ============================================================================
// Helpers
// ============================================================================

function computeAdherence(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
): number {
    // Prefer profile.adherence_rate if available
    if (profile.adherence_rate != null && profile.adherence_rate > 0) {
        return profile.adherence_rate
    }
    // Fallback: compute from session patterns
    const { total_sessions_4w, completed_sessions_4w } = enrichedContext.session_patterns
    if (total_sessions_4w > 0) {
        return Math.round((completed_sessions_4w / total_sessions_4w) * 100)
    }
    // No data: assume normal
    return 100
}

function classifyAdherence(percentage: number): 'normal' | 'reduced' | 'minimal' {
    if (percentage > 80) return 'normal'
    if (percentage >= 50) return 'reduced'
    return 'minimal'
}

function resolveSplitType(frequency: number): string {
    const clamped = Math.max(2, Math.min(6, frequency))
    return FREQUENCY_STRUCTURE[clamped as keyof typeof FREQUENCY_STRUCTURE]
}

function buildSplitDetail(
    splitType: string,
    availableDays: number[],
): PrescriptionConstraints['split_detail'] {
    const template = SPLIT_TEMPLATES[splitType as keyof typeof SPLIT_TEMPLATES]
    if (!template) {
        // Fallback to full_body if unknown split
        return buildSplitDetail('full_body', availableDays)
    }

    return template.map((entry, i) => ({
        workout_name: entry.label,
        workout_focus: entry.groups.slice(0, 3).join(' + '),
        muscle_groups: [...entry.groups],
        scheduled_day: availableDays[i] ?? availableDays[availableDays.length - 1] ?? 1,
    }))
}

function buildVolumeBudget(
    level: TrainingLevel,
): Record<string, { min: number; max: number }> {
    const fullRange = VOLUME_RANGES[level]
    const budget: Record<string, { min: number; max: number }> = {}

    // Primary groups: full range
    for (const group of PRIMARY_MUSCLE_GROUPS) {
        budget[group] = { min: fullRange.min, max: fullRange.max }
    }

    // Small groups: differentiated factors per group
    for (const group of SMALL_MUSCLE_GROUPS) {
        const factor = SECONDARY_VOLUME_FACTORS[group] ?? 0.50
        budget[group] = {
            min: Math.round(fullRange.min * factor),
            max: Math.round(fullRange.max * factor),
        }
    }

    return budget
}

function computeExercisesPerSession(
    durationMinutes: number,
    adherence: 'normal' | 'reduced' | 'minimal',
): number {
    let base = Math.floor(durationMinutes / 10)

    if (adherence === 'reduced') {
        base -= 1
    } else if (adherence === 'minimal') {
        base -= 1
        base = Math.min(base, 5)
    }

    // Clamp to reasonable range
    return Math.max(3, Math.min(base, 10))
}

// ============================================================================
// Frequency-based group priority
// ============================================================================

/** Groups to cut entirely from budget at each frequency threshold */
const FREQUENCY_CUTS: Record<number, { remove: string[]; minimize: string[] }> = {
    6: { remove: [], minimize: [] },
    5: { remove: ['Antebraço', 'Oblíquos'], minimize: ['Abdominais', 'Adutores'] },
    4: { remove: ['Antebraço', 'Oblíquos'], minimize: ['Panturrilha', 'Abdominais'] },
    3: { remove: ['Antebraço', 'Oblíquos', 'Panturrilha', 'Abdominais', 'Adutores', 'Trapézio'], minimize: [] },
    2: { remove: ['Antebraço', 'Oblíquos', 'Panturrilha', 'Abdominais', 'Adutores', 'Trapézio', 'Bíceps', 'Tríceps'], minimize: [] },
}

const MINIMIZED_SETS = 3

/**
 * Adjusts secondary group budgets based on training frequency.
 * Lower frequency → fewer secondary groups get dedicated budget.
 * Returns the adjusted budget and list of deprioritized groups.
 */
function applyFrequencyPriority(
    volumeBudget: Record<string, { min: number; max: number }>,
    frequency: number,
): { budget: Record<string, { min: number; max: number }>; deprioritized: string[] } {
    const clamped = Math.max(2, Math.min(6, frequency))
    const cuts = FREQUENCY_CUTS[clamped] || FREQUENCY_CUTS[6]
    const deprioritized: string[] = []
    const adjusted = { ...volumeBudget }

    for (const group of cuts.remove) {
        if (adjusted[group]) {
            delete adjusted[group]
            deprioritized.push(group)
        }
    }

    for (const group of cuts.minimize) {
        if (adjusted[group]) {
            adjusted[group] = { min: MINIMIZED_SETS, max: MINIMIZED_SETS }
            deprioritized.push(group)
        }
    }

    return { budget: adjusted, deprioritized }
}

/**
 * Caps volume budget to what's realistically achievable given session capacity.
 * If total budget minimums exceed available weekly sets by >30%, scales down
 * proportionally. Ensures primary groups never drop below 6 séries/semana.
 */
function capVolumeBudget(
    volumeBudget: Record<string, { min: number; max: number }>,
    exercisesPerSession: number,
    frequency: number,
): Record<string, { min: number; max: number }> {
    const AVG_SETS_PER_EXERCISE = 3.5
    const totalWeeklySets = exercisesPerSession * AVG_SETS_PER_EXERCISE * frequency

    const totalBudgetMin = Object.values(volumeBudget).reduce((sum, r) => sum + r.min, 0)

    // Only cap if budget is unrealistically high (>130% of capacity)
    if (totalBudgetMin <= totalWeeklySets * 1.3) {
        return volumeBudget
    }

    const scaleFactor = (totalWeeklySets * 1.1) / totalBudgetMin
    const PRIMARY_FLOOR = 6

    const capped: Record<string, { min: number; max: number }> = {}
    for (const [group, range] of Object.entries(volumeBudget)) {
        const newMin = Math.round(range.min * scaleFactor)
        const newMax = Math.round(range.max * scaleFactor)

        if (PRIMARY_MUSCLE_GROUPS.includes(group)) {
            capped[group] = {
                min: Math.max(newMin, PRIMARY_FLOOR),
                max: Math.max(newMax, PRIMARY_FLOOR),
            }
        } else {
            capped[group] = {
                min: Math.max(newMin, 3),
                max: Math.max(newMax, 3),
            }
        }
    }

    const cappedBudgetMin = Object.values(capped).reduce((sum, r) => sum + r.min, 0)
    console.log(
        `[ConstraintsEngine] Volume budget capped: ` +
        `BEFORE=${totalBudgetMin} sets → AFTER=${cappedBudgetMin} sets. ` +
        `Capacity=${Math.round(totalWeeklySets)} (${exercisesPerSession}ex × ${AVG_SETS_PER_EXERCISE}sets × ${frequency}d). ` +
        `Scale factor: ${scaleFactor.toFixed(2)}`,
    )
    for (const [group, range] of Object.entries(capped)) {
        const before = volumeBudget[group]
        if (before && (before.min !== range.min || before.max !== range.max)) {
            console.log(`  ${group}: ${before.min}-${before.max} → ${range.min}-${range.max}`)
        }
    }

    return capped
}

/**
 * Parses the muscle_emphasis answer from trainer answers into group names.
 */
function parseEmphasis(answers: PrescriptionAgentAnswer[]): string[] {
    const emphasisAnswer = answers.find(a => a.question_id === 'muscle_emphasis')
    if (!emphasisAnswer) return []

    const groups: string[] = []
    // Answer may contain multiple selections separated by commas or newlines
    const selections = emphasisAnswer.answer.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    for (const selection of selections) {
        const mapped = EMPHASIS_MAP[selection]
        if (mapped) {
            groups.push(...mapped)
        }
    }
    return [...new Set(groups)]
}

/**
 * Adjusts volume budget to elevate min for emphasized groups.
 * Emphasized groups get min = 80% of max (AI will tend toward top of range).
 * CRITICAL: Non-emphasized PRIMARY groups never fall below VOLUME_RANGES[level].min.
 */
function applyEmphasis(
    volumeBudget: Record<string, { min: number; max: number }>,
    emphasizedGroups: string[],
    level: TrainingLevel,
): Record<string, { min: number; max: number }> {
    const baseRange = VOLUME_RANGES[level]
    const adjusted = { ...volumeBudget }
    for (const [group, range] of Object.entries(adjusted)) {
        if (emphasizedGroups.includes(group)) {
            // Elevate min to 80% of max for emphasized groups
            adjusted[group] = {
                min: Math.round(range.max * 0.80),
                max: range.max,
            }
        } else if (PRIMARY_MUSCLE_GROUPS.includes(group)) {
            // Floor guarantee: primary groups without emphasis keep at least baseRange.min
            adjusted[group] = {
                min: Math.max(range.min, baseRange.min),
                max: range.max,
            }
        }
    }
    return adjusted
}

// ============================================================================
// Trade-off detection (for question engine)
// ============================================================================

export interface VolumeTradeoffInfo {
    needsTradeoff: boolean
    scaleFactor: number
    exercisesPerSession: number
    frequency: number
    totalWeeklySets: number
    totalBudgetMin: number
    level: TrainingLevel
    studentName?: string
}

/**
 * Pre-computes whether the volume budget will need capping.
 * Called during analysis phase (before questions) so the question engine
 * can present a trade-off question to the trainer.
 */
export function detectVolumeTradeoff(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
): VolumeTradeoffInfo {
    const adherencePercentage = computeAdherence(profile, enrichedContext)
    const adherenceAdjustment = classifyAdherence(adherencePercentage)

    const rawFrequency = profile.available_days.length
    const effectiveFrequency = (adherenceAdjustment === 'minimal' && rawFrequency >= 5)
        ? 4 : rawFrequency

    // Replicate the budget pipeline without emphasis (we don't have answers yet)
    let volumeBudget = buildVolumeBudget(profile.training_level)
    const { budget } = applyFrequencyPriority(volumeBudget, effectiveFrequency)
    volumeBudget = budget

    const exercisesPerSession = computeExercisesPerSession(
        profile.session_duration_minutes,
        adherenceAdjustment,
    )

    const AVG_SETS = 3.5
    const totalWeeklySets = exercisesPerSession * AVG_SETS * effectiveFrequency
    const totalBudgetMin = Object.values(volumeBudget).reduce((sum, r) => sum + r.min, 0)

    const scaleFactor = totalBudgetMin > totalWeeklySets * 1.3
        ? (totalWeeklySets * 1.1) / totalBudgetMin
        : 1.0

    return {
        needsTradeoff: scaleFactor < 0.85,
        scaleFactor,
        exercisesPerSession,
        frequency: effectiveFrequency,
        totalWeeklySets: Math.round(totalWeeklySets),
        totalBudgetMin,
        level: profile.training_level,
    }
}
