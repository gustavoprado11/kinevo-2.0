// ============================================================================
// Kinevo Prescription Engine — Snapshot from Draft
// ============================================================================
// Inverse of builder-mapper. Takes a mobile program-builder draft (or any
// structurally compatible ProgramDraftLike) and serializes it as a
// PrescriptionOutputSnapshot for /api/programs/assign with isEdited=true.
//
// Pure function. No I/O, no DB, no catalog access. Side-effect free.
//
// Supersets policy: PrescriptionOutputSnapshot.workouts[].items is flat —
// it has no parent_item_id. Drafts containing supersets (any item with
// parent_item_id != null) cannot be losslessly serialized, so we throw
// SupersetInSnapshotError and let the caller decide (the mobile builder
// shows an Alert with three options: convert to sequential, save as
// template, or cancel).

import type {
    GeneratedWorkout,
    GeneratedWorkoutItem,
    PrescriptionOutputSnapshot,
    PrescriptionReasoning,
    ProgramDraftLike,
} from '../../types/prescription'

const DAY_STRING_TO_INT: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
}

export class SupersetInSnapshotError extends Error {
    constructor(
        message = 'Drafts com supersets não podem ser serializados como PrescriptionOutputSnapshot.',
    ) {
        super(message)
        this.name = 'SupersetInSnapshotError'
    }
}

const EMPTY_REASONING: PrescriptionReasoning = {
    structure_rationale: '',
    volume_rationale: '',
    workout_notes: [],
    attention_flags: [],
    confidence_score: 0,
}

export interface BuildSnapshotFromDraftOptions {
    /**
     * If provided, this `reasoning` block is injected into the produced snapshot
     * instead of the empty default. Pass the original generation's `reasoning`
     * here when serializing an edited draft so the assign endpoint receives
     * the same justification that the LLM emitted.
     */
    preserveReasoning?: PrescriptionReasoning
}

/**
 * Serializes a ProgramDraftLike as a PrescriptionOutputSnapshot.
 *
 * - Preserves name, duration_weeks, and per-exercise sets/reps/rest_seconds/notes/exercise_id.
 * - Workout `frequency` (day strings) is converted back to integer `scheduled_days`.
 * - Workouts without `frequency` get `scheduled_days: []` (never null).
 * - Throws `SupersetInSnapshotError` if any item has `parent_item_id != null`.
 * - If `options.preserveReasoning` is set, reuses it instead of the empty default.
 */
export function buildSnapshotFromDraft(
    draft: ProgramDraftLike,
    options?: BuildSnapshotFromDraftOptions,
): PrescriptionOutputSnapshot {
    const workouts: GeneratedWorkout[] = draft.workouts.map((w) => {
        const items: GeneratedWorkoutItem[] = w.items.map((item) => {
            if (item.parent_item_id !== null) {
                throw new SupersetInSnapshotError()
            }
            // Belt-and-suspenders: a 'superset' parent (parent_item_id null
            // but item_type === 'superset') would also break the flat shape.
            if (item.item_type === 'superset') {
                throw new SupersetInSnapshotError()
            }

            const generatedItem: GeneratedWorkoutItem = {
                item_type: 'exercise',
                order_index: item.order_index,
                exercise_id: item.exercise_id || null,
                exercise_name: item.exercise_name || null,
                exercise_muscle_group:
                    item.exercise_muscle_groups.length > 0
                        ? item.exercise_muscle_groups.join(', ')
                        : null,
                exercise_equipment: item.exercise_equipment ?? null,
                sets: item.sets,
                reps: item.reps,
                rest_seconds: item.rest_seconds,
                notes: item.notes,
                exercise_function:
                    (item.exercise_function as GeneratedWorkoutItem['exercise_function']) ?? null,
                substitute_exercise_ids: item.substitute_exercise_ids,
                item_config: item.item_config,
            }
            return generatedItem
        })

        const scheduledDays = (w.frequency || [])
            .map((d) => DAY_STRING_TO_INT[d.toLowerCase()])
            .filter((n): n is number => typeof n === 'number')

        return {
            name: w.name,
            order_index: w.order_index,
            scheduled_days: scheduledDays,
            items,
        }
    })

    return {
        program: {
            name: draft.name,
            description: draft.description ?? '',
            duration_weeks: draft.duration_weeks ?? 0,
        },
        workouts,
        reasoning: options?.preserveReasoning ?? EMPTY_REASONING,
    }
}
