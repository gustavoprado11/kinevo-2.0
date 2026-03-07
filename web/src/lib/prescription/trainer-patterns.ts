// ============================================================================
// Kinevo Prescription Engine — Trainer Pattern Analysis
// ============================================================================
// Analyzes accumulated trainer edits diffs to detect recurring patterns.
// Patterns are injected into the AI prompt to personalize future prescriptions.

import type {
    TrainerEditsDiff,
    TrainerPattern,
    TrainerPatterns,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Config
// ============================================================================

/** Minimum approved prescriptions before patterns are computed */
const MIN_PRESCRIPTIONS = 10

/** Minimum frequency (0-1) for a pattern to be significant */
const MIN_FREQUENCY = 0.5

/** Maximum patterns to store */
const MAX_PATTERNS = 5

/** Minimum absolute occurrences for exercise_preference patterns */
const MIN_EXERCISE_OCCURRENCES = 3

/** How many recent diffs to analyze */
const ANALYSIS_WINDOW = 30

// ============================================================================
// Pure Analysis (no DB)
// ============================================================================

export function analyzeTrainerPatterns(diffs: TrainerEditsDiff[]): TrainerPattern[] {
    if (diffs.length < MIN_PRESCRIPTIONS) return []

    const patterns: TrainerPattern[] = []
    const totalPrescriptions = diffs.length

    // 1. Volume adjustment patterns
    patterns.push(...detectVolumePatterns(diffs, totalPrescriptions))

    // 2. Exercise preference patterns (A→B swaps)
    patterns.push(...detectExercisePreferences(diffs, totalPrescriptions))

    // 3. Exercise removal patterns
    patterns.push(...detectExerciseRemovals(diffs, totalPrescriptions))

    // 4. Group deprioritized patterns
    patterns.push(...detectGroupDeprioritized(diffs, totalPrescriptions))

    // Sort by frequency (strongest patterns first) and cap
    return patterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, MAX_PATTERNS)
}

// ============================================================================
// Pattern Detectors
// ============================================================================

function detectVolumePatterns(diffs: TrainerEditsDiff[], total: number): TrainerPattern[] {
    // Count how many times each muscle group's volume was increased/decreased
    const groupDeltas = new Map<string, { increases: number; decreases: number; totalDelta: number }>()

    for (const diff of diffs) {
        for (const vc of diff.volume_changes) {
            const entry = groupDeltas.get(vc.muscle_group) || { increases: 0, decreases: 0, totalDelta: 0 }
            if (vc.delta > 0) entry.increases++
            else if (vc.delta < 0) entry.decreases++
            entry.totalDelta += vc.delta
            groupDeltas.set(vc.muscle_group, entry)
        }
    }

    const patterns: TrainerPattern[] = []

    for (const [group, data] of groupDeltas) {
        const increaseFreq = data.increases / total
        const decreaseFreq = data.decreases / total

        if (increaseFreq >= MIN_FREQUENCY) {
            const avgDelta = Math.round(data.totalDelta / data.increases)
            patterns.push({
                pattern_type: 'volume_adjustment',
                occurrences: data.increases,
                total_prescriptions: total,
                frequency: Math.round(increaseFreq * 100) / 100,
                description: `Treinador aumenta volume de ${group} (média +${avgDelta}s) em ${Math.round(increaseFreq * 100)}% das prescrições`,
                context: { muscle_group: group, avg_volume_delta: avgDelta },
            })
        }

        if (decreaseFreq >= MIN_FREQUENCY) {
            const avgDelta = Math.round(data.totalDelta / data.decreases)
            patterns.push({
                pattern_type: 'volume_adjustment',
                occurrences: data.decreases,
                total_prescriptions: total,
                frequency: Math.round(decreaseFreq * 100) / 100,
                description: `Treinador reduz volume de ${group} (média ${avgDelta}s) em ${Math.round(decreaseFreq * 100)}% das prescrições`,
                context: { muscle_group: group, avg_volume_delta: avgDelta },
            })
        }
    }

    return patterns
}

function detectExercisePreferences(diffs: TrainerEditsDiff[], total: number): TrainerPattern[] {
    // Track A→B replacements: how many times exercise A was replaced by B
    const swaps = new Map<string, {
        fromId: string; fromName: string; toId: string; toName: string; count: number
    }>()
    const exerciseAppearances = new Map<string, number>() // How many prescriptions exercise A appeared in

    for (const diff of diffs) {
        const seenExercises = new Set<string>()
        for (const edit of diff.item_edits) {
            if (edit.edit_type === 'replaced' && edit.original && edit.final) {
                const key = `${edit.original.exercise_id}→${edit.final.exercise_id}`
                const existing = swaps.get(key) || {
                    fromId: edit.original.exercise_id,
                    fromName: edit.original.exercise_name,
                    toId: edit.final.exercise_id,
                    toName: edit.final.exercise_name,
                    count: 0,
                }
                existing.count++
                swaps.set(key, existing)
                seenExercises.add(edit.original.exercise_id)
            }
            // Also count appearances from items that weren't replaced
            if (edit.original) {
                seenExercises.add(edit.original.exercise_id)
            }
        }
        for (const exId of seenExercises) {
            exerciseAppearances.set(exId, (exerciseAppearances.get(exId) || 0) + 1)
        }
    }

    const patterns: TrainerPattern[] = []

    for (const [, swap] of swaps) {
        const appearances = exerciseAppearances.get(swap.fromId) || 0
        // Require both percentage threshold AND minimum absolute occurrences
        if (appearances < MIN_EXERCISE_OCCURRENCES) continue
        const freq = swap.count / appearances
        if (freq < MIN_FREQUENCY) continue

        patterns.push({
            pattern_type: 'exercise_preference',
            occurrences: swap.count,
            total_prescriptions: total,
            frequency: Math.round(freq * 100) / 100,
            description: `Treinador substitui "${swap.fromName}" por "${swap.toName}" em ${Math.round(freq * 100)}% das vezes (${swap.count}/${appearances})`,
            context: {
                from_exercise_id: swap.fromId,
                from_exercise_name: swap.fromName,
                to_exercise_id: swap.toId,
                to_exercise_name: swap.toName,
            },
        })
    }

    return patterns
}

function detectExerciseRemovals(diffs: TrainerEditsDiff[], total: number): TrainerPattern[] {
    // Track removals by muscle group
    const groupRemovals = new Map<string, number>()

    for (const diff of diffs) {
        const removedGroups = new Set<string>()
        for (const edit of diff.item_edits) {
            if (edit.edit_type === 'removed' && edit.original) {
                removedGroups.add(edit.original.exercise_muscle_group)
            }
        }
        for (const group of removedGroups) {
            groupRemovals.set(group, (groupRemovals.get(group) || 0) + 1)
        }
    }

    const patterns: TrainerPattern[] = []

    for (const [group, count] of groupRemovals) {
        const freq = count / total
        if (freq < MIN_FREQUENCY) continue

        patterns.push({
            pattern_type: 'exercise_removal',
            occurrences: count,
            total_prescriptions: total,
            frequency: Math.round(freq * 100) / 100,
            description: `Treinador remove exercícios de ${group} em ${Math.round(freq * 100)}% das prescrições`,
            context: { muscle_group: group },
        })
    }

    return patterns
}

function detectGroupDeprioritized(diffs: TrainerEditsDiff[], total: number): TrainerPattern[] {
    // A group is deprioritized if ALL its exercises are removed in >50% of prescriptions
    const groupFullRemovals = new Map<string, number>()

    for (const diff of diffs) {
        // Find groups where every exercise was removed (no remaining exercises for that group)
        const removedByGroup = new Map<string, number>()
        const keptByGroup = new Map<string, number>()

        for (const edit of diff.item_edits) {
            if (edit.edit_type === 'removed' && edit.original) {
                removedByGroup.set(
                    edit.original.exercise_muscle_group,
                    (removedByGroup.get(edit.original.exercise_muscle_group) || 0) + 1,
                )
            }
            // Items that weren't removed or were replaced mean the group is still present
            if (edit.edit_type !== 'removed' && edit.final) {
                keptByGroup.set(
                    edit.final.exercise_muscle_group,
                    (keptByGroup.get(edit.final.exercise_muscle_group) || 0) + 1,
                )
            }
        }

        for (const [group, removedCount] of removedByGroup) {
            if (removedCount > 0 && !keptByGroup.has(group)) {
                groupFullRemovals.set(group, (groupFullRemovals.get(group) || 0) + 1)
            }
        }
    }

    const patterns: TrainerPattern[] = []

    for (const [group, count] of groupFullRemovals) {
        const freq = count / total
        if (freq < MIN_FREQUENCY) continue

        patterns.push({
            pattern_type: 'group_deprioritized',
            occurrences: count,
            total_prescriptions: total,
            frequency: Math.round(freq * 100) / 100,
            description: `Treinador remove TODOS os exercícios de ${group} em ${Math.round(freq * 100)}% das prescrições`,
            context: { muscle_group: group },
        })
    }

    return patterns
}

// ============================================================================
// DB Integration
// ============================================================================

/**
 * Fetches recent approved diffs, analyzes patterns, and saves to trainers table.
 * Designed to be called fire-and-forget after approval.
 */
export async function refreshTrainerPatterns(
    supabase: any,
    trainerId: string,
): Promise<void> {
    // Fetch last N approved generations with diffs
    const { data: rows, error } = await supabase
        .from('prescription_generations')
        .select('trainer_edits_diff')
        .eq('trainer_id', trainerId)
        .eq('status', 'approved')
        .not('trainer_edits_diff', 'is', null)
        .order('approved_at', { ascending: false })
        .limit(ANALYSIS_WINDOW)

    if (error || !rows) {
        console.error('[refreshTrainerPatterns] Failed to fetch diffs:', error)
        return
    }

    const diffs: TrainerEditsDiff[] = rows
        .map((r: any) => r.trainer_edits_diff)
        .filter(Boolean)

    if (diffs.length < MIN_PRESCRIPTIONS) {
        console.log(`[refreshTrainerPatterns] Only ${diffs.length} diffs, need ${MIN_PRESCRIPTIONS}. Skipping.`)
        return
    }

    const patterns = analyzeTrainerPatterns(diffs)

    const trainerPatterns: TrainerPatterns = {
        patterns,
        analyzed_prescriptions: diffs.length,
        last_analyzed_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
        .from('trainers')
        .update({ prescription_patterns: trainerPatterns })
        .eq('id', trainerId)

    if (updateError) {
        console.error('[refreshTrainerPatterns] Failed to save patterns:', updateError)
        return
    }

    console.log(`[refreshTrainerPatterns] Saved ${patterns.length} patterns from ${diffs.length} diffs for trainer ${trainerId}`)
}
