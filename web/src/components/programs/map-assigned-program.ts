/**
 * Mapeia a árvore de um programa ATRIBUÍDO (assigned_workouts +
 * assigned_workout_items + assigned_workout_item_sets) para o Workout[] nativo
 * do builder — extraído do modo de edição para ser reusado pelo fluxo
 * "começar do programa atual" (cópia sem perdas: métodos/set schemes,
 * supersets, cardio/fases, agenda, notas e função do exercício).
 *
 * `regenerateIds: true` (cópia) troca todos os ids por temp ids do builder —
 * a cópia vira um programa NOVO; `false` (edição) preserva os ids do banco.
 */
import type { Exercise } from '@/types/exercise'
// Valores vêm do núcleo PURO (server-safe); os tipos de builder-model entram
// como type-only (apagados no build — não arrastam o @dnd-kit pro RSC).
import { hydrateSetScheme, tempId } from './builder-pure'
import type { Workout, WorkoutItem } from './builder-model'

export interface AssignedItemRow {
    id: string
    item_type: string
    order_index: number
    parent_item_id: string | null
    exercise_id: string | null
    exercise_name?: string | null
    exercise_muscle_group?: string | null
    exercise_equipment?: string | null
    substitute_exercise_ids?: string[] | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    item_config?: unknown
    method_key?: string | null
    rounds?: number | null
    exercise_function?: string | null
    assigned_workout_item_sets?: unknown[]
}

export interface AssignedWorkoutRow {
    id: string
    name: string
    order_index: number
    scheduled_days: number[] | null
    workout_type?: string | null
    assigned_workout_items: AssignedItemRow[] | null
}

export interface AssignedProgramTree {
    assigned_workouts: AssignedWorkoutRow[] | null
}

const DAY_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

export function mapAssignedProgramToWorkouts(
    program: AssignedProgramTree,
    exercises: Exercise[],
    opts: { regenerateIds?: boolean } = {},
): Workout[] {
    const regen = opts.regenerateIds ?? false

    // Estúdios: programa prescrito por OUTRO coach pode referenciar exercícios
    // custom dele (owner = colega), fora da biblioteca do ator. O fallback
    // sintetiza o exercício a partir dos campos denormalizados da própria
    // linha — exibe certo e round-tripa name/muscle_group/equipment no save.
    const denormExercise = (row: AssignedItemRow): Exercise | undefined => {
        if (!row.exercise_id || !row.exercise_name) return undefined
        return {
            id: row.exercise_id,
            name: row.exercise_name,
            muscle_groups: row.exercise_muscle_group ? [{ id: row.exercise_id, name: row.exercise_muscle_group }] : [],
            equipment: row.exercise_equipment ?? null,
            owner_id: null,
            original_system_id: null,
            video_url: null,
            thumbnail_url: null,
            instructions: null,
            is_archived: false,
            created_at: '1970-01-01T00:00:00.000Z',
            updated_at: '1970-01-01T00:00:00.000Z',
        } as unknown as Exercise
    }
    const resolveExercise = (row: AssignedItemRow) =>
        exercises.find(e => e.id === row.exercise_id) ?? denormExercise(row)

    return (program.assigned_workouts ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(wt => {
            const items = wt.assigned_workout_items || []
            const parentItems = items
                .filter(i => !i.parent_item_id)
                .sort((a, b) => a.order_index - b.order_index)
                .map(item => {
                    // Hidrata set_scheme/rounds das linhas materializadas;
                    // programas sem elas abrem em modo simples.
                    const parentHydrated = hydrateSetScheme(
                        item.assigned_workout_item_sets as never,
                        item.rounds ?? 1,
                    )
                    const parentId = regen ? tempId() : item.id
                    return {
                        id: parentId,
                        item_type: item.item_type as WorkoutItem['item_type'],
                        order_index: item.order_index,
                        parent_item_id: null,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        exercise: resolveExercise(item),
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                        item_config: (item.item_config as Record<string, unknown>) || {},
                        exercise_function: (item.exercise_function as WorkoutItem['exercise_function']) ?? null,
                        set_scheme: parentHydrated.scheme,
                        method_key: (item.method_key as WorkoutItem['method_key']) ?? null,
                        rounds: parentHydrated.rounds,
                        children: items
                            .filter(child => child.parent_item_id === item.id)
                            .sort((a, b) => a.order_index - b.order_index)
                            .map(child => {
                                const childHydrated = hydrateSetScheme(
                                    child.assigned_workout_item_sets as never,
                                    child.rounds ?? 1,
                                )
                                return {
                                    id: regen ? tempId() : child.id,
                                    item_type: child.item_type as WorkoutItem['item_type'],
                                    order_index: child.order_index,
                                    parent_item_id: parentId,
                                    exercise_id: child.exercise_id,
                                    substitute_exercise_ids: child.substitute_exercise_ids || [],
                                    exercise: resolveExercise(child),
                                    sets: child.sets,
                                    reps: child.reps,
                                    rest_seconds: child.rest_seconds,
                                    notes: child.notes,
                                    exercise_function: (child.exercise_function as WorkoutItem['exercise_function']) ?? null,
                                    set_scheme: childHydrated.scheme,
                                    method_key: (child.method_key as WorkoutItem['method_key']) ?? null,
                                    rounds: childHydrated.rounds,
                                }
                            })
                    }
                })

            const frequency = (wt.scheduled_days || []).map(d => DAY_MAP[d])

            return {
                id: regen ? tempId() : wt.id,
                name: wt.name,
                order_index: wt.order_index,
                frequency,
                workout_type: wt.workout_type === 'cardio' ? 'cardio' as const : 'strength' as const,
                items: parentItems,
            }
        })
}
