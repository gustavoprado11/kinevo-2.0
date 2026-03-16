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
 * When exercises are provided, muscle_groups are resolved by name for VolumeSummary.
 */
export function compareWorkoutToWorkout(cw: CompareWorkout, exercises?: { name: string; muscle_groups?: any[] }[]): Workout {
    const topLevel = cw.items.filter(i => !i.parent_item_id)
    const childrenMap = new Map<string, CompareWorkoutItem[]>()

    for (const item of cw.items) {
        if (item.parent_item_id) {
            const siblings = childrenMap.get(item.parent_item_id) || []
            siblings.push(item)
            childrenMap.set(item.parent_item_id, siblings)
        }
    }

    // Build a lookup map for exercise name → muscle_groups
    const exerciseLookup = new Map<string, any[]>()
    if (exercises) {
        for (const ex of exercises) {
            if (ex.name && ex.muscle_groups) {
                exerciseLookup.set(ex.name.toLowerCase(), ex.muscle_groups)
            }
        }
    }

    const items: WorkoutItem[] = topLevel
        .sort((a, b) => a.order_index - b.order_index)
        .map(item => compareItemToWorkoutItem(item, childrenMap, exerciseLookup))

    const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
    const frequency = (cw.scheduled_days || []).map(d => dayMap[d])

    return {
        id: cw.id,
        name: cw.name,
        order_index: cw.order_index,
        frequency,
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
    exerciseLookup: Map<string, any[]>,
): WorkoutItem {
    const children = childrenMap.get(item.id)
    const sortedChildren = children
        ? children.sort((a, b) => a.order_index - b.order_index).map(c => compareItemToWorkoutItem(c, childrenMap, exerciseLookup))
        : undefined

    const muscleGroups = item.exercise_name
        ? exerciseLookup.get(item.exercise_name.toLowerCase()) || []
        : []

    return {
        id: item.id,
        item_type: item.item_type,
        order_index: item.order_index,
        parent_item_id: item.parent_item_id,
        exercise_id: null,
        substitute_exercise_ids: [],
        exercise: item.exercise_name
            ? { id: '', name: item.exercise_name, muscle_groups: muscleGroups } as any
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
