// ============================================================================
// Kinevo Prescription Engine — Builder Mapper
// ============================================================================
// Converts the AI/heuristic output (PrescriptionOutputSnapshot) into the
// ProgramData shape expected by ProgramBuilderClient.
//
// This bridge lets AI-generated programs open directly in the existing builder
// so trainers can edit freely before publishing.

import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription'

// ============================================================================
// ProgramData — mirrors the interface in program-builder-client.tsx
// ============================================================================
// We re-declare it here to avoid making the builder export internal types.
// The shapes MUST stay in sync — any change in program-builder-client.tsx's
// ProgramData must be reflected here.

export interface BuilderProgramData {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    workout_templates?: Array<{
        id: string
        name: string
        order_index: number
        frequency?: string[]
        workout_item_templates?: Array<{
            id: string
            item_type: string
            order_index: number
            parent_item_id: string | null
            exercise_id: string | null
            substitute_exercise_ids?: string[] | null
            sets: number | null
            reps: string | null
            rest_seconds: number | null
            notes: string | null
        }>
    }>
}

// ============================================================================
// Day Mapping
// ============================================================================
// The AI output uses integer days (0=Sun..6=Sat, matching JS Date.getDay).
// The builder uses English lowercase day strings for the frequency field.
// This matches the dayMap in assign-program.ts (which does the reverse).

const DAY_INT_TO_STRING: Record<number, string> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
}

// ============================================================================
// Temp ID Generator
// ============================================================================
// ProgramBuilderClient uses `temp_*` prefix to distinguish new items (INSERT)
// from existing items (UPDATE) during save. Since AI-generated data is always
// new, every ID gets a temp prefix.

let _counter = 0
function tempId(): string {
    _counter++
    return `temp_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================================
// Main Mapper
// ============================================================================

/**
 * Converts a PrescriptionOutputSnapshot into the ProgramData format expected
 * by ProgramBuilderClient.
 *
 * The builder initializes its entire state from this shape:
 * - program.name → name input
 * - program.duration_weeks → duration input
 * - workout_templates → Workout[] tabs with items
 *
 * All IDs use `temp_*` prefix so the builder treats everything as new inserts.
 */
export function mapAiOutputToBuilderData(
    output: PrescriptionOutputSnapshot,
): BuilderProgramData {
    return {
        id: tempId(),
        name: output.program.name,
        description: output.program.description,
        duration_weeks: output.program.duration_weeks,
        workout_templates: output.workouts.map(workout => ({
            id: tempId(),
            name: workout.name,
            order_index: workout.order_index,
            frequency: workout.scheduled_days
                .map(d => DAY_INT_TO_STRING[d])
                .filter(Boolean),
            workout_item_templates: workout.items.map(item => ({
                id: tempId(),
                item_type: 'exercise' as const,
                order_index: item.order_index,
                parent_item_id: null,
                exercise_id: item.exercise_id,
                substitute_exercise_ids: item.substitute_exercise_ids.length > 0
                    ? item.substitute_exercise_ids
                    : null,
                sets: item.sets,
                reps: item.reps,
                rest_seconds: item.rest_seconds,
                notes: item.notes,
            })),
        })),
    }
}
