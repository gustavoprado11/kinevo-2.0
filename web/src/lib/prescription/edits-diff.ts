// ============================================================================
// Kinevo Prescription Engine — Trainer Edits Diff
// ============================================================================
// Computes a structured diff between the original AI output_snapshot and the
// final approved program (assigned_workouts + assigned_workout_items).

import type {
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    TrainerEditsDiff,
    TrainerEditItem,
    TrainerEditItemSnapshot,
    VolumeChange,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Convert assigned rows → GeneratedWorkout[] for comparison
// ============================================================================

interface AssignedWorkoutRow {
    id: string
    name: string
    order_index: number
    scheduled_days: number[]
}

interface AssignedWorkoutItemRow {
    id: string
    assigned_workout_id: string
    exercise_id: string
    exercise_name: string
    exercise_muscle_group: string
    exercise_equipment: string | null
    sets: number
    reps: string
    rest_seconds: number
    notes: string | null
    order_index: number
    item_type: string | null
}

export function convertAssignedToGeneratedWorkouts(
    workoutRows: AssignedWorkoutRow[],
    itemRows: AssignedWorkoutItemRow[],
): GeneratedWorkout[] {
    const itemsByWorkout = new Map<string, AssignedWorkoutItemRow[]>()
    for (const item of itemRows) {
        const list = itemsByWorkout.get(item.assigned_workout_id) || []
        list.push(item)
        itemsByWorkout.set(item.assigned_workout_id, list)
    }

    return workoutRows.map(w => ({
        name: w.name,
        order_index: w.order_index,
        scheduled_days: w.scheduled_days || [],
        items: (itemsByWorkout.get(w.id) || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map((item, idx) => ({
                exercise_id: item.exercise_id,
                exercise_name: item.exercise_name,
                exercise_muscle_group: item.exercise_muscle_group,
                exercise_equipment: item.exercise_equipment,
                sets: item.sets,
                reps: item.reps,
                rest_seconds: item.rest_seconds,
                notes: item.notes,
                substitute_exercise_ids: [],
                order_index: item.order_index ?? idx,
            })),
    }))
}

// ============================================================================
// Compute Edits Diff
// ============================================================================

export function computeEditsDiff(
    originalSnapshot: PrescriptionOutputSnapshot,
    finalWorkouts: GeneratedWorkout[],
): TrainerEditsDiff {
    const itemEdits: TrainerEditItem[] = []

    const originalWorkouts = originalSnapshot.workouts

    // Match workouts by order_index
    const maxWorkouts = Math.max(originalWorkouts.length, finalWorkouts.length)

    for (let wi = 0; wi < maxWorkouts; wi++) {
        const origWorkout = originalWorkouts.find(w => w.order_index === wi)
        const finalWorkout = finalWorkouts.find(w => w.order_index === wi)

        if (!origWorkout && finalWorkout) {
            // Entire workout added — mark all items as added
            for (const item of finalWorkout.items) {
                itemEdits.push({
                    workout_order_index: wi,
                    workout_name: finalWorkout.name,
                    item_order_index: item.order_index,
                    edit_type: 'added',
                    final: toSnapshot(item),
                })
            }
            continue
        }

        if (origWorkout && !finalWorkout) {
            // Entire workout removed — mark all items as removed
            for (const item of origWorkout.items) {
                itemEdits.push({
                    workout_order_index: wi,
                    workout_name: origWorkout.name,
                    item_order_index: item.order_index,
                    edit_type: 'removed',
                    original: toSnapshot(item),
                })
            }
            continue
        }

        if (origWorkout && finalWorkout) {
            const edits = diffWorkoutItems(origWorkout, finalWorkout, wi)
            itemEdits.push(...edits)
        }
    }

    // Compute volume changes
    const originalVolume = computeSimpleVolume(originalWorkouts)
    const finalVolume = computeSimpleVolume(finalWorkouts)
    const volumeChanges = computeVolumeChanges(originalVolume, finalVolume)

    return {
        total_edits: itemEdits.length,
        item_edits: itemEdits,
        volume_changes: volumeChanges,
        computed_at: new Date().toISOString(),
    }
}

// ============================================================================
// 5-Pass Item Matching
// ============================================================================

function diffWorkoutItems(
    origWorkout: GeneratedWorkout,
    finalWorkout: GeneratedWorkout,
    workoutIdx: number,
): TrainerEditItem[] {
    const edits: TrainerEditItem[] = []
    const workoutName = finalWorkout.name || origWorkout.name

    const origItems = [...origWorkout.items].sort((a, b) => a.order_index - b.order_index)
    const finalItems = [...finalWorkout.items].sort((a, b) => a.order_index - b.order_index)

    const matchedOriginal = new Set<number>()  // indices into origItems
    const matchedFinal = new Set<number>()     // indices into finalItems

    // Build lookup: exercise_id → indices in final
    const finalByExerciseId = new Map<string, number[]>()
    for (let fi = 0; fi < finalItems.length; fi++) {
        const id = finalItems[fi].exercise_id
        const list = finalByExerciseId.get(id) || []
        list.push(fi)
        finalByExerciseId.set(id, list)
    }

    // Pass 1: Same position + same exercise_id → check for sets/reps/rest changes
    for (let i = 0; i < Math.min(origItems.length, finalItems.length); i++) {
        if (origItems[i].exercise_id === finalItems[i].exercise_id) {
            matchedOriginal.add(i)
            matchedFinal.add(i)

            const orig = origItems[i]
            const final_ = finalItems[i]

            if (orig.sets !== final_.sets) {
                edits.push({
                    workout_order_index: workoutIdx,
                    workout_name: workoutName,
                    item_order_index: i,
                    edit_type: 'sets_changed',
                    original: toSnapshot(orig),
                    final: toSnapshot(final_),
                })
            } else if (orig.reps !== final_.reps) {
                edits.push({
                    workout_order_index: workoutIdx,
                    workout_name: workoutName,
                    item_order_index: i,
                    edit_type: 'reps_changed',
                    original: toSnapshot(orig),
                    final: toSnapshot(final_),
                })
            } else if (orig.rest_seconds !== final_.rest_seconds) {
                edits.push({
                    workout_order_index: workoutIdx,
                    workout_name: workoutName,
                    item_order_index: i,
                    edit_type: 'rest_changed',
                    original: toSnapshot(orig),
                    final: toSnapshot(final_),
                })
            }
            // If everything matches → no edit (trainer kept it as-is)
        }
    }

    // Pass 2 (reorder detection): For unmatched items at same position with different
    // exercise_id, check if the original's exercise_id exists elsewhere in final.
    // If so, it's a reorder (not a replacement) — skip both and let Pass 5 handle the new item.
    for (let i = 0; i < Math.min(origItems.length, finalItems.length); i++) {
        if (matchedOriginal.has(i) || matchedFinal.has(i)) continue

        const origExId = origItems[i].exercise_id
        const finalCandidates = finalByExerciseId.get(origExId) || []
        const unmatchedCandidate = finalCandidates.find(fi => !matchedFinal.has(fi) && fi !== i)

        if (unmatchedCandidate !== undefined) {
            // The original exercise was moved to a different position — it's a reorder.
            // Match the original with the moved position in final.
            matchedOriginal.add(i)
            matchedFinal.add(unmatchedCandidate)
            // No edit generated for the reorder itself — the new item at position i
            // will be captured as 'added' in Pass 5.
        }
    }

    // Pass 3: Same position + different exercise_id (not found elsewhere) → replaced
    for (let i = 0; i < Math.min(origItems.length, finalItems.length); i++) {
        if (matchedOriginal.has(i) || matchedFinal.has(i)) continue

        matchedOriginal.add(i)
        matchedFinal.add(i)

        edits.push({
            workout_order_index: workoutIdx,
            workout_name: workoutName,
            item_order_index: i,
            edit_type: 'replaced',
            original: toSnapshot(origItems[i]),
            final: toSnapshot(finalItems[i]),
        })
    }

    // Pass 4: Remaining unmatched originals → removed
    for (let i = 0; i < origItems.length; i++) {
        if (matchedOriginal.has(i)) continue
        edits.push({
            workout_order_index: workoutIdx,
            workout_name: workoutName,
            item_order_index: origItems[i].order_index,
            edit_type: 'removed',
            original: toSnapshot(origItems[i]),
        })
    }

    // Pass 5: Remaining unmatched finals → added
    for (let i = 0; i < finalItems.length; i++) {
        if (matchedFinal.has(i)) continue
        edits.push({
            workout_order_index: workoutIdx,
            workout_name: workoutName,
            item_order_index: finalItems[i].order_index,
            edit_type: 'added',
            final: toSnapshot(finalItems[i]),
        })
    }

    return edits
}

// ============================================================================
// Volume Helpers
// ============================================================================

/** Simple volume computation: direct sets per muscle group (no secondary activation) */
function computeSimpleVolume(workouts: GeneratedWorkout[]): Record<string, number> {
    const volume: Record<string, number> = {}
    for (const workout of workouts) {
        const freq = Math.max(1, workout.scheduled_days.length)
        for (const item of workout.items) {
            const group = item.exercise_muscle_group
            if (!group) continue
            volume[group] = (volume[group] || 0) + item.sets * freq
        }
    }
    return volume
}

function computeVolumeChanges(
    original: Record<string, number>,
    final: Record<string, number>,
): VolumeChange[] {
    const allGroups = new Set([...Object.keys(original), ...Object.keys(final)])
    const changes: VolumeChange[] = []

    for (const group of allGroups) {
        const origSets = original[group] || 0
        const finalSets = final[group] || 0
        const delta = finalSets - origSets
        if (delta !== 0) {
            changes.push({
                muscle_group: group,
                original_sets: origSets,
                final_sets: finalSets,
                delta,
            })
        }
    }

    return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

// ============================================================================
// Snapshot Helper
// ============================================================================

function toSnapshot(item: GeneratedWorkoutItem): TrainerEditItemSnapshot {
    return {
        exercise_id: item.exercise_id,
        exercise_name: item.exercise_name,
        exercise_muscle_group: item.exercise_muscle_group,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.rest_seconds,
    }
}
