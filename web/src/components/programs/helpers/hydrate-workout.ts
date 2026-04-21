// Presentation-layer helper: convert a `GeneratedWorkout` (LLM output shape)
// into a `Workout` (builder internal state shape). This is UI-only. It must
// NOT touch the prescription pipeline in `lib/prescription/*`.
//
// Kept in sync with:
// - `mapAiOutputToBuilderData` in lib/prescription/builder-mapper.ts
//   (which maps snapshot → BuilderProgramData.workout_templates)
// - `initializeWorkouts` in program-builder-client.tsx
//   (which maps workout_templates → Workout[])
//
// We short-circuit both by mapping GeneratedWorkout → Workout directly so the
// streaming hook can produce Workout[] without going through the SSR/props
// path. If the intermediate shapes drift, update all three in lockstep.

import type { GeneratedWorkout } from '@kinevo/shared/types/prescription'
import type { Exercise } from '@/types/exercise'
import type { Workout, WorkoutItem } from '../program-builder-client'

const DAY_INT_TO_STRING: Record<number, string> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
}

let _counter = 0
function tempId(): string {
    _counter++
    return `temp_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Hydrate a single GeneratedWorkout into the shape the builder's Workout
 * state expects. `exercises` is the library used to attach `exercise` refs
 * to items that have an exercise_id.
 *
 * All IDs are `temp_*` so the builder treats everything as new inserts on
 * save (mirrors `mapAiOutputToBuilderData`).
 */
export function hydrateGeneratedWorkout(
    gw: GeneratedWorkout,
    exercises: Exercise[],
): Workout {
    const items: WorkoutItem[] = (gw.items ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => ({
            id: tempId(),
            item_type: (item.item_type || 'exercise') as WorkoutItem['item_type'],
            order_index: item.order_index,
            parent_item_id: null,
            exercise_id: item.exercise_id ?? null,
            substitute_exercise_ids: item.substitute_exercise_ids ?? [],
            exercise: item.exercise_id
                ? exercises.find(e => e.id === item.exercise_id)
                : undefined,
            sets: item.sets ?? null,
            reps: item.reps ?? null,
            rest_seconds: item.rest_seconds ?? null,
            notes: item.notes ?? null,
            exercise_function: item.exercise_function ?? null,
            item_config: (item.item_config ?? {}) as Record<string, unknown>,
        }))

    return {
        id: tempId(),
        name: gw.name,
        order_index: gw.order_index,
        items,
        frequency: (gw.scheduled_days ?? [])
            .map(d => DAY_INT_TO_STRING[d])
            .filter(Boolean),
    }
}
