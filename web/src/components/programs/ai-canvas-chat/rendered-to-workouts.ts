// Adaptadores entre o DTO do turno de IA (RenderedProgram) e o estado do
// builder (Workout[]). UI-only — reusa hydrateGeneratedWorkout (o mesmo
// conversor do stream de prescrição). NÃO toca lib/prescription/.

import type { GeneratedWorkout } from '@kinevo/shared/types/prescription'
import type { Exercise } from '@/types/exercise'
import type { Workout } from '../program-builder-client'
import { hydrateGeneratedWorkout } from '../helpers/hydrate-workout'
import type { CanvasExercise, RenderedProgram } from '@/lib/programs/ai-canvas/types'

const DAY_STR_TO_INT: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

/** Catálogo compacto (id+nome+grupo+equip) que a IA recebe pra buscar exercícios. */
export function compactCatalog(exercises: Exercise[]): CanvasExercise[] {
    return exercises.map(e => ({
        id: e.id,
        name: e.name,
        // TODOS os grupos (não só o primeiro): a IA precisa saber que "Levantamento
        // Terra" é posterior/glúteo, não costas, pra casar exercício↔sessão.
        muscle: (e.muscle_groups ?? []).map(g => g.name).filter(Boolean).join(', ') || null,
        equipment: e.equipment ?? null,
    }))
}

/** RenderedProgram (saída da IA) → Workout[] do builder, via hydrateGeneratedWorkout. */
export function renderedToWorkouts(program: RenderedProgram, exercises: Exercise[]): Workout[] {
    return (program.sessions ?? []).map((s, si) => {
        const gw: GeneratedWorkout = {
            name: s.name,
            order_index: si,
            scheduled_days: Array.isArray(s.scheduled_days) ? s.scheduled_days : [],
            items: (s.items ?? []).map((it, ii) => ({
                item_type: 'exercise',
                order_index: ii,
                exercise_id: it.exercise_id,
                substitute_exercise_ids: [],
                sets: it.sets ?? null,
                reps: it.reps ?? null,
                rest_seconds: it.rest_seconds ?? null,
                notes: it.notes ?? null,
            })),
        }
        return hydrateGeneratedWorkout(gw, exercises)
    })
}

/** Canvas atual (Workout[]) → RenderedProgram, pra mandar o estado pro turno da IA. */
export function workoutsToSnapshot(
    workouts: Workout[],
    name: string | null,
    durationWeeks: number | null,
): RenderedProgram {
    return {
        name: name ?? null,
        duration_weeks: durationWeeks ?? null,
        sessions: (workouts ?? []).map(w => ({
            name: w.name,
            scheduled_days: (w.frequency ?? [])
                .map(d => DAY_STR_TO_INT[d])
                .filter((d): d is number => d !== undefined),
            items: (w.items ?? [])
                .filter(it => it.item_type === 'exercise' && !!it.exercise_id)
                .map(it => ({
                    exercise_id: it.exercise_id as string,
                    sets: it.sets ?? null,
                    reps: it.reps ?? null,
                    rest_seconds: it.rest_seconds ?? null,
                    notes: it.notes ?? null,
                })),
        })),
    }
}
