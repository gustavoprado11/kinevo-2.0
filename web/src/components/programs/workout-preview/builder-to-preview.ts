/**
 * Transforms builder WorkoutItem[] into the same RenderItem[] structure
 * used by the mobile workout execution screen (lines 511-655 of [id].tsx).
 *
 * Fase 4.5e: passa a refletir `set_scheme` / `method_key` / `rounds` para
 * que a preview do celular (mock) seja uma reprodução fiel do que o aluno
 * verá. Programas sem set_scheme continuam renderizando como antes.
 */

import type { MethodKey, SetType, WorkoutSet } from '@kinevo/shared/types/prescription'
import { expandSchemeByRounds } from '@kinevo/shared/lib/prescription/set-scheme'
import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import type { WorkoutItem } from '../program-builder-client'
import { FUNCTION_LABELS } from './preview-design-tokens'

// ── Preview data types (mirror mobile's RenderItem union) ───────────────────

export interface PreviewSetData {
    weight: string
    reps: string
    completed: boolean
}

/** Per-phase prescription info passed to PreviewSetRow. NULL when item has no
 *  set_scheme (legacy programs). When present, mirrors the mobile execution
 *  exactly (same shape as `SetPrescription` from mobile/lib/hydrateWorkoutSets). */
export interface PreviewPhase {
    setNumber: number
    setType: SetType
    repsTarget: string
    restSeconds: number
    weightTargetKg: number | null
    weightTargetPct1rm: number | null
    /** Reps in reserve target (Fase 4.5f). 0 is valid (= "to failure"). */
    rir: number | null
    /** Tempo string, e.g. "3-1-1-0" (Fase 4.5f). */
    tempo: string | null
    /** 1-based round index for compound methods; null for linear. */
    roundNumber: number | null
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
    /** Method declared by the trainer (drop_set, pyramid_down, ...). NULL or
     *  'standard' hides the method chip. */
    methodKey: MethodKey | null
    /** Rounds for compound methods. Always 1 for linear / legacy. */
    rounds: number
    /** Materialized phases (rounds × per-round). Empty when item has no
     *  set_scheme — preview falls back to legacy aggregate rendering. */
    phases: PreviewPhase[]
}

export interface PreviewWarmupCardio {
    id: string
    itemType: 'warmup' | 'cardio'
    name: string
    config: Record<string, any>
}

export type PreviewRenderItem =
    | { type: 'exercise'; exercise: PreviewExercise; orderIndex: number }
    | { type: 'superset'; exercises: PreviewExercise[]; supersetRestSeconds: number; orderIndex: number }
    | { type: 'note'; text: string; orderIndex: number }
    | { type: 'section_header'; label: string; orderIndex: number }
    | { type: 'warmup_cardio'; item: PreviewWarmupCardio; orderIndex: number }

// ── Transform function ──────────────────────────────────────────────────────

export function builderItemsToPreview(items: WorkoutItem[]): PreviewRenderItem[] {
    const renderItems: PreviewRenderItem[] = []

    // Sort items by order_index first
    const sorted = [...items].sort((a, b) => a.order_index - b.order_index)

    for (const item of sorted) {
        if (item.item_type === 'note' && !item.parent_item_id) {
            renderItems.push({
                type: 'note',
                text: item.notes || 'Nota do treino',
                orderIndex: item.order_index,
            })
        } else if (item.item_type === 'exercise' && !item.parent_item_id) {
            renderItems.push({
                type: 'exercise',
                exercise: toPreviewExercise(item),
                orderIndex: item.order_index,
            })
        } else if ((item.item_type === 'warmup' || item.item_type === 'cardio') && !item.parent_item_id) {
            renderItems.push({
                type: 'warmup_cardio',
                item: {
                    id: item.id,
                    itemType: item.item_type,
                    name: item.item_type === 'warmup' ? 'Aquecimento' : 'Aeróbio',
                    config: item.item_config || {},
                },
                orderIndex: item.order_index,
            })
        } else if (item.item_type === 'superset') {
            const children = (item.children || []).sort((a, b) => a.order_index - b.order_index)
            if (children.length === 0) continue

            const supersetExercises = children
                .filter(c => c.item_type === 'exercise')
                .map((child, idx, arr) => toPreviewExercise(child, `Exercício ${idx + 1} de ${arr.length}`))

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

    renderItems.sort((a, b) => a.orderIndex - b.orderIndex)

    // Insert section headers when exercise_function changes
    const hasAnyFunction = sorted.some(i =>
        (i.item_type === 'exercise' || i.item_type === 'superset') && i.exercise_function
    )

    if (!hasAnyFunction) return renderItems

    const finalItems: PreviewRenderItem[] = []
    let lastFunction: string | null = null

    const functionByOrder = new Map<number, string | null>()
    for (const item of sorted) {
        if (item.item_type === 'exercise' && !item.parent_item_id) {
            functionByOrder.set(item.order_index, item.exercise_function || null)
        } else if (item.item_type === 'superset') {
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

/** Effective rounds for an item, mirroring the mobile/web save flow:
 *  compound methods honor `rounds` (clamped 1..20); linear / no-scheme always
 *  collapse to 1 round. */
function effectiveRoundsForItem(item: WorkoutItem): number {
    if (!item.set_scheme || item.set_scheme.length === 0) return 1
    if (!isCompoundMethod(item.method_key ?? null)) return 1
    const r = Number.isFinite(item.rounds as number) ? Math.floor(item.rounds as number) : 1
    return Math.max(1, Math.min(20, r))
}

function toPhase(s: WorkoutSet, roundForLinear: number | null): PreviewPhase {
    return {
        setNumber: s.set_number,
        setType: s.set_type,
        repsTarget: s.reps,
        restSeconds: s.rest_seconds,
        weightTargetKg: s.weight_target_kg,
        weightTargetPct1rm: s.weight_target_pct1rm,
        rir: s.rir,
        tempo: s.tempo,
        roundNumber: s.round_number ?? roundForLinear,
    }
}

function toPreviewExercise(item: WorkoutItem, supersetBadge?: string): PreviewExercise {
    const methodKey = (item.method_key as MethodKey | null) ?? null
    const rounds = effectiveRoundsForItem(item)
    const hasScheme = Array.isArray(item.set_scheme) && item.set_scheme.length > 0

    // Materialize the scheme: builder draft holds a per-round shape (one
    // round); preview expands to N rounds × M phases so the mock shows what
    // the student will see post-save (parity with the assigned-program save
    // materialization in useProgramBuilder.saveAsTemplate).
    const phases: PreviewPhase[] = hasScheme
        ? (rounds > 1
            ? expandSchemeByRounds(item.set_scheme!, rounds).map((s) => toPhase(s, null))
            : item.set_scheme!.map((s) => toPhase(s, null)))
        : []

    // Fallback aggregates for legacy programs (no set_scheme).
    const fallbackSets = item.sets || 3
    const totalPhases = phases.length || fallbackSets
    const setsDisplay = phases.length || fallbackSets
    const repsDisplay = item.reps || '12'
    const restDisplay = item.rest_seconds || 60

    return {
        id: item.id,
        name: item.exercise?.name || 'Exercício',
        sets: setsDisplay,
        reps: repsDisplay,
        restSeconds: restDisplay,
        notes: item.notes || null,
        setsData: Array.from({ length: totalPhases }, () => ({
            weight: '',
            reps: '',
            completed: false,
        })),
        supersetBadge,
        methodKey,
        rounds,
        phases,
    }
}
