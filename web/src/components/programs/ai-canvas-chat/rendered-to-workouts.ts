// Adaptadores entre o DTO do turno de IA (RenderedProgram) e o estado do
// builder (Workout[]). UI-only. Constrói os itens com os MESMOS construtores do
// builder (makeExerciseItem + applyPreset/SYSTEM_PRESETS), então métodos e
// supersets saem byte-a-byte iguais ao que a UI do builder produz — zero
// divergência no caminho de save. NÃO toca lib/prescription/ (motor protegido).

import type { Exercise } from '@/types/exercise'
import { makeExerciseItem, tempId, type Workout, type WorkoutItem } from '../builder-model'
import { applyPreset } from '@kinevo/shared/lib/prescription/set-scheme'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import type { MethodKey } from '@kinevo/shared/types/prescription'
import type { CanvasExercise, CanvasItemDTO, RenderedProgram } from '@/lib/programs/ai-canvas/types'

const DAY_STR_TO_INT: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const DAY_INT_TO_STRING: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }

/** Métodos de série que a IA pode prescrever (presets do sistema; sem standard/custom). */
const CANVAS_METHODS = new Set<MethodKey>(['pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster'])

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

/** Constrói um item de exercício, aplicando o método (set_scheme canônico do
 *  preset) quando pedido — mesmo caminho do chip de método do builder. */
function buildExerciseItem(it: CanvasItemDTO, exercise: Exercise): WorkoutItem {
    const method = it.method && CANVAS_METHODS.has(it.method) ? it.method : null
    // Método → set_scheme do preset + rounds (compostos drop_set/cluster = 3; lineares = 1).
    const setScheme = method ? applyPreset(method) : undefined
    const rounds = method
        ? SYSTEM_PRESETS[method as Exclude<MethodKey, 'standard' | 'custom'>]?.defaultRounds ?? 1
        : 1
    const item = makeExerciseItem(exercise, {
        setsCount: it.sets ?? 3,
        reps: it.reps ?? '',
        restSeconds: it.rest_seconds ?? 60,
        notes: it.notes ?? null,
        setScheme,
        methodKey: method,
        rounds,
    })
    // Preserva a nullability dos agregados. Para método, o save deriva sets/reps
    // do scheme (aggregatesFromItem); para séries retas, valem como prescrição.
    item.sets = it.sets ?? null
    item.reps = it.reps ?? null
    item.rest_seconds = it.rest_seconds ?? null
    return item
}

/** Agrupa itens CONSECUTIVOS com a mesma superset_group num superset (≥2 itens).
 *  Espelha createSupersetWithNextIn: container 'superset' + filhos com
 *  parent_item_id, rest herdado, e SEM método/scheme (regra V1 — supersets não
 *  persistem scheme nos filhos; o save os ignora via effectiveMethodKey). */
function groupSupersets(built: Array<{ item: WorkoutItem; group: string | null }>): WorkoutItem[] {
    const result: WorkoutItem[] = []
    let i = 0
    while (i < built.length) {
        const cur = built[i]
        if (cur.group) {
            let j = i + 1
            while (j < built.length && built[j].group === cur.group) j++
            const run = built.slice(i, j)
            if (run.length >= 2) {
                const supersetId = tempId()
                result.push({
                    id: supersetId,
                    item_type: 'superset',
                    order_index: 0,
                    parent_item_id: null,
                    exercise_id: null,
                    substitute_exercise_ids: [],
                    sets: null,
                    reps: null,
                    rest_seconds: run[0].item.rest_seconds || 60,
                    notes: null,
                    children: run.map((r, ci) => ({
                        ...r.item,
                        parent_item_id: supersetId,
                        order_index: ci,
                        method_key: null,
                        set_scheme: null,
                        rounds: 1,
                    })),
                })
                i = j
                continue
            }
        }
        result.push(cur.item)
        i++
    }
    return result.map((it, idx) => ({ ...it, order_index: idx }))
}

/** RenderedProgram (saída da IA) → Workout[] do builder, com métodos + supersets. */
export function renderedToWorkouts(program: RenderedProgram, exercises: Exercise[]): Workout[] {
    const byId = new Map(exercises.map(e => [e.id, e]))
    return (program.sessions ?? []).map((s, si) => {
        const built = (s.items ?? [])
            .map(it => {
                const exercise = byId.get(it.exercise_id)
                if (!exercise) return null // id fora do catálogo — ignora (render_program já filtra)
                return { item: buildExerciseItem(it, exercise), group: it.superset_group?.trim() || null }
            })
            .filter((x): x is { item: WorkoutItem; group: string | null } => x !== null)
        return {
            id: tempId(),
            name: s.name,
            order_index: si,
            items: groupSupersets(built),
            frequency: (s.scheduled_days ?? []).map(d => DAY_INT_TO_STRING[d]).filter(Boolean),
        }
    })
}

/** Canvas atual (Workout[]) → RenderedProgram, pra mandar o estado pro turno da
 *  IA. Achata supersets (filhos viram itens com superset_group) e preserva o
 *  método de cada exercício, pra IA não perder isso entre turnos. */
export function workoutsToSnapshot(
    workouts: Workout[],
    name: string | null,
    durationWeeks: number | null,
): RenderedProgram {
    return {
        name: name ?? null,
        duration_weeks: durationWeeks ?? null,
        sessions: (workouts ?? []).map(w => {
            const items: CanvasItemDTO[] = []
            for (const it of (w.items ?? [])) {
                if (it.item_type === 'superset' && it.children?.length) {
                    const tag = `S${(it.order_index ?? 0) + 1}`
                    for (const c of it.children) {
                        if (!c.exercise_id) continue
                        items.push({
                            exercise_id: c.exercise_id,
                            sets: c.sets ?? null,
                            reps: c.reps ?? null,
                            rest_seconds: c.rest_seconds ?? it.rest_seconds ?? null,
                            notes: c.notes ?? null,
                            superset_group: tag,
                        })
                    }
                } else if (it.item_type === 'exercise' && it.exercise_id) {
                    items.push({
                        exercise_id: it.exercise_id,
                        sets: it.sets ?? null,
                        reps: it.reps ?? null,
                        rest_seconds: it.rest_seconds ?? null,
                        notes: it.notes ?? null,
                        method: it.method_key ?? null,
                    })
                }
                // warmup/cardio/note: omitidos do snapshot (a IA foca nos exercícios).
            }
            return {
                name: w.name,
                scheduled_days: (w.frequency ?? [])
                    .map(d => DAY_STR_TO_INT[d])
                    .filter((d): d is number => d !== undefined),
                items,
            }
        }),
    }
}
