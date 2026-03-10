/**
 * Transforms builder WorkoutItem[] into the same RenderItem[] structure
 * used by the mobile workout execution screen (lines 511-655 of [id].tsx).
 */

import type { WorkoutItem } from '../program-builder-client'
import { FUNCTION_LABELS } from './preview-design-tokens'

// ── Preview data types (mirror mobile's RenderItem union) ───────────────────

export interface PreviewSetData {
    weight: string
    reps: string
    completed: boolean
}

export interface PreviewExercise {
    id: string
    name: string
    sets: number
    reps: string
    restSeconds: number
    notes: string | null
    setsData: PreviewSetData[]
    supersetBadge?: string
}

export type PreviewRenderItem =
    | { type: 'exercise'; exercise: PreviewExercise; orderIndex: number }
    | { type: 'superset'; exercises: PreviewExercise[]; supersetRestSeconds: number; orderIndex: number }
    | { type: 'note'; text: string; orderIndex: number }
    | { type: 'section_header'; label: string; orderIndex: number }

// ── Transform function ──────────────────────────────────────────────────────

export function builderItemsToPreview(items: WorkoutItem[]): PreviewRenderItem[] {
    const renderItems: PreviewRenderItem[] = []

    // Sort items by order_index first
    const sorted = [...items].sort((a, b) => a.order_index - b.order_index)

    for (const item of sorted) {
        if (item.item_type === 'note' && !item.parent_item_id) {
            // Standalone workout note
            renderItems.push({
                type: 'note',
                text: item.notes || 'Nota do treino',
                orderIndex: item.order_index,
            })
        } else if (item.item_type === 'exercise' && !item.parent_item_id) {
            // Standalone exercise
            const sets = item.sets || 3
            renderItems.push({
                type: 'exercise',
                exercise: toPreviewExercise(item, sets),
                orderIndex: item.order_index,
            })
        } else if (item.item_type === 'superset') {
            // Superset parent — children are in item.children[]
            const children = (item.children || []).sort((a, b) => a.order_index - b.order_index)
            if (children.length === 0) continue

            const supersetExercises = children
                .filter(c => c.item_type === 'exercise')
                .map((child, idx, arr) => {
                    const sets = child.sets || 3
                    return toPreviewExercise(child, sets, `Exercício ${idx + 1} de ${arr.length}`)
                })

            if (supersetExercises.length > 0) {
                renderItems.push({
                    type: 'superset',
                    exercises: supersetExercises,
                    supersetRestSeconds: item.rest_seconds || 60,
                    orderIndex: item.order_index,
                })
            }
        }
    }

    // Sort by orderIndex
    renderItems.sort((a, b) => a.orderIndex - b.orderIndex)

    // Insert section headers when exercise_function changes
    const hasAnyFunction = sorted.some(i =>
        (i.item_type === 'exercise' || i.item_type === 'superset') && i.exercise_function
    )

    if (!hasAnyFunction) return renderItems

    const finalItems: PreviewRenderItem[] = []
    let lastFunction: string | null = null

    // Build a map from item order_index to its exercise_function
    const functionByOrder = new Map<number, string | null>()
    for (const item of sorted) {
        if (item.item_type === 'exercise' && !item.parent_item_id) {
            functionByOrder.set(item.order_index, item.exercise_function || null)
        } else if (item.item_type === 'superset') {
            // Use first child's function
            const firstChild = (item.children || []).find(c => c.item_type === 'exercise')
            functionByOrder.set(item.order_index, firstChild?.exercise_function || item.exercise_function || null)
        }
    }

    for (const item of renderItems) {
        if (item.type === 'note') {
            finalItems.push(item)
            continue
        }

        const fn = functionByOrder.get(item.orderIndex) ?? null
        if (fn && fn !== lastFunction) {
            finalItems.push({
                type: 'section_header',
                label: FUNCTION_LABELS[fn] || fn.toUpperCase(),
                orderIndex: item.orderIndex - 0.1,
            })
            lastFunction = fn
        }

        finalItems.push(item)
    }

    return finalItems
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toPreviewExercise(item: WorkoutItem, sets: number, supersetBadge?: string): PreviewExercise {
    return {
        id: item.id,
        name: item.exercise?.name || 'Exercício',
        sets,
        reps: item.reps || '12',
        restSeconds: item.rest_seconds || 60,
        notes: item.notes || null,
        setsData: Array.from({ length: sets }, () => ({
            weight: '',
            reps: '',
            completed: false,
        })),
        supersetBadge,
    }
}
