import type { PastWorkoutDetail, PastWorkoutItem } from '@/app/students/[id]/actions/get-past-workouts'
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
