import type { PastWorkoutDetail, PastWorkoutItem } from '@/app/students/[id]/actions/get-past-workouts'
import type { CompareWorkout, CompareWorkoutItem } from '@/actions/programs/get-program-for-compare'
import type { Workout, WorkoutItem } from '@/components/programs/program-builder-client'

/**
 * Converts a PastWorkoutDetail (flat DB structure with exercise_name text)
 * into a Workout structure compatible with WorkoutPanel's readonly mode.
 */
export function pastDetailToWorkout(detail: PastWorkoutDetail): Workout {
    const topLevel = detail.items.filter(i => !i.parent_item_id)
    const childrenMap = new Map<string, PastWorkoutItem[]>()

    for (const item of detail.items) {
        if (item.parent_item_id) {
            const siblings = childrenMap.get(item.parent_item_id) || []
            siblings.push(item)
            childrenMap.set(item.parent_item_id, siblings)
        }
    }

    const items: WorkoutItem[] = topLevel
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => toWorkoutItem(item, childrenMap))

    return {
        id: detail.workoutId,
        name: detail.workoutName,
        order_index: 0,
        items,
    }
}

/**
 * Converts a CompareWorkout (from full program load) into a Workout
 * compatible with WorkoutPanel's readonly mode. Includes warmup/cardio + item_config.
 */
export function compareWorkoutToWorkout(cw: CompareWorkout): Workout {
    const topLevel = cw.items.filter(i => !i.parent_item_id)
    const childrenMap = new Map<string, CompareWorkoutItem[]>()

    for (const item of cw.items) {
        if (item.parent_item_id) {
            const siblings = childrenMap.get(item.parent_item_id) || []
            siblings.push(item)
            childrenMap.set(item.parent_item_id, siblings)
        }
    }

    const items: WorkoutItem[] = topLevel
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => compareItemToWorkoutItem(item, childrenMap))

    return {
        id: cw.id,
        name: cw.name,
        order_index: cw.order_index,
        items,
    }
}

function toWorkoutItem(
    item: PastWorkoutItem,
    childrenMap: Map<string, PastWorkoutItem[]>,
): WorkoutItem {
    const children = childrenMap.get(item.id)
    const sortedChildren = children
        ? children.sort((a, b) => a.order_index - b.order_index).map(c => toWorkoutItem(c, childrenMap))
        : undefined

    return {
        id: item.id,
        item_type: item.item_type,
        order_index: item.order_index,
        parent_item_id: item.parent_item_id,
        exercise_id: null,
        substitute_exercise_ids: [],
        exercise: item.exercise_name
            ? { id: '', name: item.exercise_name, muscle_groups: [] } as any
            : undefined,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.rest_seconds,
        notes: item.notes,
        exercise_function: item.exercise_function,
        children: sortedChildren,
    }
}

function compareItemToWorkoutItem(
    item: CompareWorkoutItem,
    childrenMap: Map<string, CompareWorkoutItem[]>,
): WorkoutItem {
    const children = childrenMap.get(item.id)
    const sortedChildren = children
        ? children.sort((a, b) => a.order_index - b.order_index).map(c => compareItemToWorkoutItem(c, childrenMap))
        : undefined

    return {
        id: item.id,
        item_type: item.item_type,
        order_index: item.order_index,
        parent_item_id: item.parent_item_id,
        exercise_id: null,
        substitute_exercise_ids: [],
        exercise: item.exercise_name
            ? { id: '', name: item.exercise_name, muscle_groups: [] } as any
            : undefined,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.rest_seconds,
        notes: item.notes,
        exercise_function: item.exercise_function,
        item_config: item.item_config || undefined,
        children: sortedChildren,
    }
}
