// Núcleo compartilhado dos builders de programa (criação e edição de
// atribuído). Tipos canônicos do modelo cliente + helpers per-set + mutações
// PURAS sobre Workout[] — sem React, sem Supabase, testável em isolamento.
//
// Persistência NÃO mora aqui: cada client mapeia o modelo para sua tabela
// (program_templates/workout_item_templates vs assigned_*). Ver
// specs/active/unificacao-builders/SPEC.md para as decisões de unificação.

import { arrayMove } from '@dnd-kit/sortable'
import type { Exercise } from '@/types/exercise'
import {
    collapseExpandedScheme,
    expandSchemeByRounds,
    summarizeSetScheme,
    summarizeWithRounds,
} from '@kinevo/shared/lib/prescription/set-scheme'
import { isCompoundMethod } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription'

export type BuilderViewMode = 'normal' | 'preview' | 'compare' | 'ai_prescribe'

export interface WorkoutItem {
    id: string
    item_type: 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio'
    order_index: number
    parent_item_id: string | null
    exercise_id: string | null
    substitute_exercise_ids: string[]
    exercise?: Exercise
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    exercise_function?: string | null
    item_config?: Record<string, any>
    children?: WorkoutItem[]
    /** Per-set prescription (Fase 2). When set, takes precedence over the
     * aggregates and the saved aggregates are derived via summarizeSetScheme.
     * For compound methods (drop-set, cluster) this is the per-round shape
     * collapsed from the materialized DB rows; the save flow expands it back
     * `rounds` times via `expandSchemeByRounds`. */
    set_scheme?: WorkoutSet[] | null
    /** Method/preset marker for the chip in the UI. */
    method_key?: MethodKey | null
    /** Rodadas (Fase 4.4). 1 para métodos lineares (default). 2..20 para
     *  compostos. Quando > 1, `set_scheme` descreve UMA rodada e é
     *  materializado N vezes no save. */
    rounds?: number | null
}

export interface Workout {
    id: string
    name: string
    order_index: number
    items: WorkoutItem[]
    frequency?: string[] // ['mon', 'tue', etc]
}

// Generate temp ID for new items
export const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

// item_config chega como Json (banco) ou Record (mapper de IA); o builder
// trabalha com objeto plano.
export function asItemConfig(v: unknown): Record<string, any> {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {}
}

/** Converte uma pref de séries (ex: "3", "3-4") em count inteiro. Faixa pega
 *  o limite inferior. Fallback 3 se inválido. */
export function parseSetsCount(setsPref: string): number {
    const match = setsPref.trim().match(/^(\d+)/)
    const n = match ? parseInt(match[1], 10) : 3
    return Number.isFinite(n) && n > 0 ? n : 3
}

/** Gera o nome de um workout novo respeitando a convenção do treinador.
 *  - 'letter': "Treino A", "Treino B", ...
 *  - 'free':   "Treino 1", "Treino 2", ... */
export function generateWorkoutName(index: number, convention: 'letter' | 'free'): string {
    if (convention === 'free') return `Treino ${index + 1}`
    return `Treino ${String.fromCharCode(65 + index)}`
}

/** Nome de uma cópia de workout: prefixo novo + sufixo descritivo do original
 *  ("Treino B - Peito" → prefixo "Treino C" vira "Treino C - Peito"). */
export function duplicateWorkoutName(sourceName: string, prefix: string): string {
    const baseName = sourceName.replace(/^(Treino [A-Z]|Treino \d+|Dia \d+)\s*[-–]\s*/, '')
    return `${prefix}${baseName ? ` - ${baseName}` : ''}`
}

// ── Per-set helpers (Fase 2 / 4.4) ──────────────────────────────────────────

/** Hydrate the materialized rows from the DB into the per-round shape the
 *  editor expects. Returns `{ scheme, rounds }`:
 *  - linear methods → returns the rows unchanged with rounds=1
 *  - compound methods → collapses N×M rows into M (one round) and rounds=N
 *  - empty / null → returns `{ scheme: null, rounds: 1 }` */
export function hydrateSetScheme(
    rows: WorkoutSet[] | null | undefined,
    roundsHint: number | null | undefined,
): { scheme: WorkoutSet[] | null; rounds: number } {
    if (!rows || rows.length === 0) return { scheme: null, rounds: 1 }
    const sorted = [...rows].sort((a, b) => a.set_number - b.set_number)
    const collapsed = collapseExpandedScheme(sorted, roundsHint ?? 1)
    return {
        scheme: collapsed.scheme.length > 0 ? collapsed.scheme : null,
        rounds: collapsed.rounds,
    }
}

/** Effective rounds for an item. Compound methods honor `item.rounds`; linear
 *  methods are forced to 1 — defesa em profundidade matching the mobile save
 *  flow. */
export function effectiveRoundsForItem(item: WorkoutItem): number {
    if (!item.set_scheme || item.set_scheme.length === 0) return 1
    if (!isCompoundMethod(item.method_key ?? null)) return 1
    const r = Number.isFinite(item.rounds as number) ? Math.floor(item.rounds as number) : 1
    return Math.max(1, Math.min(20, r))
}

/** Coerce the parent aggregates so they always mirror the canonical summary
 *  for the item's effective rounds. Linear / no-scheme paths keep the legacy
 *  behaviour byte-for-byte. */
export function aggregatesFromItem(item: WorkoutItem): {
    sets: number | null
    reps: string | null
    rest_seconds: number | null
} {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const rounds = effectiveRoundsForItem(item)
        const summary = rounds > 1
            ? summarizeWithRounds(item.set_scheme, rounds)
            : summarizeSetScheme(item.set_scheme)
        return {
            sets: summary.sets,
            reps: summary.reps,
            rest_seconds: summary.rest_seconds,
        }
    }
    return { sets: item.sets, reps: item.reps, rest_seconds: item.rest_seconds }
}

/** Effective method_key honouring the "supersets bloqueados em V1" rule:
 * children with parent_item_id !== null never persist a scheme. */
export function effectiveMethodKey(item: WorkoutItem): string | null {
    if (item.parent_item_id) return null
    return item.method_key ?? null
}

/** Linha materializada de set_scheme SEM a coluna FK — cada client anexa
 *  `workout_item_template_id` ou `assigned_workout_item_id` antes do insert.
 *  Os campos espelham WorkoutSet pra manter o contrato com as tabelas. */
export type SetSchemeRow = Pick<
    WorkoutSet,
    'set_type' | 'reps' | 'rest_seconds' | 'weight_target_kg' | 'weight_target_pct1rm' | 'rir' | 'tempo' | 'notes'
> & {
    set_number: number
    round_number: number | null
}

/** Materializa as linhas filhas de um item: métodos lineares escrevem o
 *  scheme como está; compostos expandem por `rounds` e marcam round_number. */
export function buildSetSchemeRows(
    scheme: WorkoutSet[] | null | undefined,
    rounds: number,
): SetSchemeRow[] {
    if (!scheme || scheme.length === 0) return []
    const safeRounds = Math.max(1, Math.min(20, Math.floor(rounds || 1)))
    const expanded = safeRounds > 1
        ? expandSchemeByRounds(scheme, safeRounds)
        : scheme
    const isCompound = safeRounds > 1
    return expanded.map((s, i) => ({
        set_number: i + 1,
        set_type: s.set_type,
        reps: s.reps,
        rest_seconds: s.rest_seconds,
        weight_target_kg: s.weight_target_kg,
        weight_target_pct1rm: s.weight_target_pct1rm,
        rir: s.rir,
        tempo: s.tempo,
        notes: s.notes,
        round_number: isCompound ? (s.round_number ?? null) : null,
    }))
}

// ── Fábricas de item ─────────────────────────────────────────────────────────
// As preferências de prescrição moram no ProgramBuilderClient; aqui entram já
// resolvidas como argumentos.

/** Seed de set_scheme "normal" usado quando a pref open_mode === 'set_editor'. */
export function buildSeedScheme(setsCount: number, reps: string, restSeconds: number): WorkoutSet[] {
    return Array.from({ length: setsCount }, (_, i): WorkoutSet => ({
        set_number: i + 1,
        set_type: 'normal',
        reps,
        rest_seconds: restSeconds,
        weight_target_kg: null,
        weight_target_pct1rm: null,
        rir: null,
        tempo: null,
        notes: null,
    }))
}

export interface MakeExerciseItemOptions {
    setsCount: number
    reps: string
    restSeconds: number
    notes?: string | null
    /** Quando presente (mesmo null), vence o seed. */
    setScheme?: WorkoutSet[] | null
    /** Seed automático de scheme normal (pref open_mode === 'set_editor'). */
    seedSetEditor?: boolean
    methodKey?: MethodKey | null
    rounds?: number | null
}

export function makeExerciseItem(exercise: Exercise, opts: MakeExerciseItemOptions): WorkoutItem {
    const seedScheme: WorkoutSet[] | null =
        opts.setScheme !== undefined
            ? opts.setScheme
            : opts.seedSetEditor
                ? buildSeedScheme(opts.setsCount, opts.reps, opts.restSeconds)
                : null
    return {
        id: tempId(),
        item_type: 'exercise',
        order_index: 0, // recalculado no append
        parent_item_id: null,
        exercise_id: exercise.id,
        substitute_exercise_ids: [],
        exercise,
        sets: opts.setsCount,
        reps: opts.reps,
        rest_seconds: opts.restSeconds,
        notes: opts.notes ?? null,
        set_scheme: seedScheme,
        method_key: opts.methodKey ?? null,
        rounds: opts.rounds ?? 1,
        children: [],
    }
}

export function makeNoteItem(notes: string): WorkoutItem {
    return {
        id: tempId(),
        item_type: 'note',
        order_index: 0,
        parent_item_id: null,
        exercise_id: null,
        substitute_exercise_ids: [],
        sets: null,
        reps: null,
        rest_seconds: null,
        notes,
        children: [],
    }
}

export function makeWarmupItem(description?: string | null): WorkoutItem {
    return {
        id: tempId(),
        item_type: 'warmup',
        order_index: 0,
        parent_item_id: null,
        exercise_id: null,
        substitute_exercise_ids: [],
        sets: null,
        reps: null,
        rest_seconds: null,
        notes: null,
        item_config: description
            ? { warmup_type: 'free', description }
            : { warmup_type: 'free' },
        children: [],
    }
}

export function makeCardioItem(technicalNotes?: string | null): WorkoutItem {
    return {
        id: tempId(),
        item_type: 'cardio',
        order_index: 0,
        parent_item_id: null,
        exercise_id: null,
        substitute_exercise_ids: [],
        sets: null,
        reps: null,
        rest_seconds: null,
        notes: null,
        // v1 limitation: aerobic_template popula item_config.notes (campo
        // exposto pelo TechnicalNote do CardioItemCard). Ver
        // PRD_preferencias_prescricao_LIMITACOES_V1.md.
        item_config: technicalNotes
            ? { mode: 'continuous', objective: 'time', notes: technicalNotes }
            : { mode: 'continuous', objective: 'time' },
        children: [],
    }
}

export function makeWorkout(name: string, orderIndex: number, frequency: string[] = []): Workout {
    return { id: tempId(), name, order_index: orderIndex, items: [], frequency }
}

// ── Mutações puras ───────────────────────────────────────────────────────────

const reindexItems = (items: WorkoutItem[]): WorkoutItem[] =>
    items.map((item, i) => ({ ...item, order_index: i }))

const reindexWorkouts = (workouts: Workout[]): Workout[] =>
    workouts.map((w, i) => ({ ...w, order_index: i }))

const mapWorkout = (
    workouts: Workout[],
    workoutId: string,
    fn: (w: Workout) => Workout,
): Workout[] => workouts.map(w => (w.id === workoutId ? fn(w) : w))

/** Clona um item gerando IDs novos pra ele e pros filhos (parent_item_id dos
 *  filhos re-apontado pro novo pai). set_scheme, item_config e substitutos
 *  são copiados — nada de referência compartilhada entre original e cópia. */
export function cloneItem(item: WorkoutItem): WorkoutItem {
    const newItemId = tempId()
    return {
        ...item,
        id: newItemId,
        item_config: item.item_config ? { ...item.item_config } : item.item_config,
        set_scheme: item.set_scheme ? item.set_scheme.map(s => ({ ...s })) : item.set_scheme,
        substitute_exercise_ids: [...(item.substitute_exercise_ids ?? [])],
        children: item.children
            ? item.children.map(child => ({
                ...child,
                id: tempId(),
                parent_item_id: newItemId,
                item_config: child.item_config ? { ...child.item_config } : child.item_config,
                set_scheme: child.set_scheme ? child.set_scheme.map(s => ({ ...s })) : child.set_scheme,
                substitute_exercise_ids: [...(child.substitute_exercise_ids ?? [])],
            }))
            : item.children,
    }
}

// — Workout-level —

export function updateWorkoutNameIn(workouts: Workout[], workoutId: string, name: string): Workout[] {
    return mapWorkout(workouts, workoutId, w => ({ ...w, name }))
}

export function updateWorkoutFrequencyIn(workouts: Workout[], workoutId: string, days: string[]): Workout[] {
    return mapWorkout(workouts, workoutId, w => ({ ...w, frequency: days }))
}

export function deleteWorkoutIn(workouts: Workout[], workoutId: string): Workout[] {
    return reindexWorkouts(workouts.filter(w => w.id !== workoutId))
}

export function duplicateWorkoutIn(workouts: Workout[], workoutId: string, copyName: string): Workout[] {
    const source = workouts.find(w => w.id === workoutId)
    if (!source) return workouts
    const copy: Workout = {
        id: tempId(),
        name: copyName,
        order_index: workouts.length,
        items: source.items.map(cloneItem),
        frequency: [],
    }
    return [...workouts, copy]
}

export function reorderWorkoutsIn(workouts: Workout[], activeId: string, overId: string): Workout[] {
    const oldIndex = workouts.findIndex(w => w.id === activeId)
    const newIndex = workouts.findIndex(w => w.id === overId)
    if (oldIndex === -1 || newIndex === -1) return workouts
    return reindexWorkouts(arrayMove(workouts, oldIndex, newIndex))
}

/** Remove workouts vazios pelos IDs informados, com reindex. Usado pelo
 *  AiPrescribePanel pra limpar placeholders órfãos. Retorna a MESMA referência
 *  se nada mudou (evita render desnecessário). */
export function cleanupEmptyPlaceholdersIn(workouts: Workout[], workoutIds: string[]): Workout[] {
    if (workoutIds.length === 0) return workouts
    const idSet = new Set(workoutIds)
    const filtered = workouts.filter(w => !idSet.has(w.id) || w.items.length > 0)
    if (filtered.length === workouts.length) return workouts
    return reindexWorkouts(filtered)
}

// — Item-level —

/** Acrescenta itens ao fim do workout. A factory recebe o workout atual para
 *  decisões dependentes de conteúdo (ex.: heurística auto-warmup do builder). */
export function appendItemsIn(
    workouts: Workout[],
    workoutId: string,
    makeItems: (w: Workout) => WorkoutItem[],
): Workout[] {
    return mapWorkout(workouts, workoutId, w => ({
        ...w,
        items: reindexItems([...w.items, ...makeItems(w)]),
    }))
}

export function updateItemIn(
    workouts: Workout[],
    workoutId: string,
    itemId: string,
    updates: Partial<WorkoutItem>,
): Workout[] {
    return mapWorkout(workouts, workoutId, w => ({
        ...w,
        items: w.items.map(item => {
            if (item.id === itemId) return { ...item, ...updates }
            if (item.children?.some(c => c.id === itemId)) {
                const newChildren = item.children.map(c => (c.id === itemId ? { ...c, ...updates } : c))
                // Superset: re-deriva o descanso do pai a partir do último filho
                // (consumido pelo timer do mobile e pelo label do training-room).
                if (item.item_type === 'superset') {
                    return { ...item, children: newChildren, rest_seconds: supersetRestFromChildren(newChildren) }
                }
                return { ...item, children: newChildren }
            }
            return item
        }),
    }))
}

export function deleteItemIn(workouts: Workout[], workoutId: string, itemId: string): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const isRoot = w.items.some(i => i.id === itemId)
        if (isRoot) {
            return { ...w, items: reindexItems(w.items.filter(i => i.id !== itemId)) }
        }
        return {
            ...w,
            items: w.items.map(item => ({
                ...item,
                children: item.children
                    ?.filter(c => c.id !== itemId)
                    .map((c, i) => ({ ...c, order_index: i })),
            })),
        }
    })
}

/** Duplica um item top-level e o insere logo após o original. */
export function duplicateItemIn(workouts: Workout[], workoutId: string, itemId: string): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const index = w.items.findIndex(i => i.id === itemId)
        if (index === -1) return w
        const newItems = [...w.items]
        newItems.splice(index + 1, 0, cloneItem(w.items[index]))
        return { ...w, items: reindexItems(newItems) }
    })
}

/** Move um item top-level OU um filho dentro do seu superset. */
export function moveItemIn(
    workouts: Workout[],
    workoutId: string,
    itemId: string,
    direction: 'up' | 'down',
): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const itemIndex = w.items.findIndex(i => i.id === itemId)
        if (itemIndex !== -1) {
            const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1
            if (targetIndex < 0 || targetIndex >= w.items.length) return w
            const newItems = [...w.items]
            ;[newItems[itemIndex], newItems[targetIndex]] = [newItems[targetIndex], newItems[itemIndex]]
            return { ...w, items: reindexItems(newItems) }
        }
        // Filho de superset: move dentro do pai.
        return {
            ...w,
            items: w.items.map(item => {
                if (!item.children) return item
                const childIndex = item.children.findIndex(c => c.id === itemId)
                if (childIndex === -1) return item
                const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1
                if (targetIndex < 0 || targetIndex >= item.children.length) return item
                const newChildren = [...item.children]
                ;[newChildren[childIndex], newChildren[targetIndex]] = [newChildren[targetIndex], newChildren[childIndex]]
                return { ...item, children: newChildren.map((c, i) => ({ ...c, order_index: i })) }
            }),
        }
    })
}

export function reorderItemIn(
    workouts: Workout[],
    workoutId: string,
    activeId: string,
    overId: string,
): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const oldIndex = w.items.findIndex(i => i.id === activeId)
        const newIndex = w.items.findIndex(i => i.id === overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return w
        return { ...w, items: reindexItems(arrayMove(w.items, oldIndex, newIndex)) }
    })
}

// — Supersets —

/** Normaliza um exercício ao virar FILHO de superset (V1: filho não carrega
 *  prescrição avançada). Colapsa o set_scheme nos agregados — o que o aluno
 *  executaria — e limpa scheme/method/rounds. Sem isso, o scheme antigo ficava
 *  no draft (e as linhas materializadas ficavam órfãs no banco, com precedência
 *  na hidratação do aluno — "prescrição fantasma", achado A1 da auditoria). */
function toSimpleChild(item: WorkoutItem, supersetId: string, orderIndex: number): WorkoutItem {
    const aggs = aggregatesFromItem(item)
    return {
        ...item,
        parent_item_id: supersetId,
        order_index: orderIndex,
        sets: aggs.sets,
        reps: aggs.reps,
        rest_seconds: aggs.rest_seconds,
        set_scheme: null,
        method_key: null,
        rounds: 1,
    }
}

/** Descanso "agregado" do superset = descanso do ÚLTIMO filho (o tempo após
 *  completar a rodada). Cada filho guarda seu próprio descanso; este derivado
 *  existe só pros consumidores que leem o descanso no item-pai (timer do mobile
 *  e label do training-room). Preserva 0 ("sem descanso"); null = não definido. */
function supersetRestFromChildren(children: WorkoutItem[]): number | null {
    if (children.length === 0) return null
    return children[children.length - 1].rest_seconds ?? null
}

/** Agrupa um exercício com o seguinte num superset novo. Cada filho mantém seu
 *  descanso individual; o descanso do superset-pai (lido por mobile/training-room)
 *  é derivado do último filho via supersetRestFromChildren. */
export function createSupersetWithNextIn(workouts: Workout[], workoutId: string, itemId: string): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const index = w.items.findIndex(i => i.id === itemId)
        if (index === -1 || index >= w.items.length - 1) return w

        const currentItem = w.items[index]
        const nextItem = w.items[index + 1]
        if (currentItem.item_type !== 'exercise' || nextItem.item_type !== 'exercise') return w

        const supersetId = tempId()
        const children: WorkoutItem[] = [
            toSimpleChild(currentItem, supersetId, 0),
            toSimpleChild(nextItem, supersetId, 1),
        ]
        const superset: WorkoutItem = {
            id: supersetId,
            item_type: 'superset',
            order_index: index,
            parent_item_id: null,
            exercise_id: null,
            substitute_exercise_ids: [],
            sets: null,
            reps: null,
            rest_seconds: supersetRestFromChildren(children),
            notes: null,
            children,
        }

        const newItems = [...w.items]
        newItems.splice(index, 2, superset)
        return { ...w, items: reindexItems(newItems) }
    })
}

export function addToExistingSupersetIn(
    workouts: Workout[],
    workoutId: string,
    itemId: string,
    supersetId: string,
): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const item = w.items.find(i => i.id === itemId)
        const superset = w.items.find(i => i.id === supersetId)
        if (!item || !superset || superset.item_type !== 'superset') return w
        if (item.item_type !== 'exercise') return w

        const newChildren = [
            ...(superset.children || []),
            toSimpleChild(item, supersetId, superset.children?.length || 0),
        ].map((c, i) => ({ ...c, order_index: i }))

        return {
            ...w,
            items: reindexItems(
                w.items
                    .filter(i => i.id !== itemId)
                    .map(i =>
                        i.id === supersetId
                            ? { ...i, children: newChildren, rest_seconds: supersetRestFromChildren(newChildren) }
                            : i,
                    ),
            ),
        }
    })
}

/** Remove um filho do superset. Auto-dissolução: superset com 0 ou 1 filho
 *  não faz sentido como agrupamento — some o container e promove o(s)
 *  sobrevivente(s) pra root, preservando a posição. */
export function removeFromSupersetIn(
    workouts: Workout[],
    workoutId: string,
    supersetId: string,
    itemId: string,
): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const supersetIndex = w.items.findIndex(i => i.id === supersetId)
        if (supersetIndex === -1) return w

        const superset = w.items[supersetIndex]
        if (!superset.children) return w

        const child = superset.children.find(c => c.id === itemId)
        if (!child) return w

        const newChildren = superset.children.filter(c => c.id !== itemId)
        const removedChild: WorkoutItem = { ...child, parent_item_id: null }
        const newItems = [...w.items]

        if (newChildren.length <= 1) {
            newItems.splice(supersetIndex, 1)
            const itemsToInsert: WorkoutItem[] = [removedChild]
            if (newChildren.length === 1) {
                itemsToInsert.push({ ...newChildren[0], parent_item_id: null })
            }
            newItems.splice(supersetIndex, 0, ...itemsToInsert)
            return { ...w, items: reindexItems(newItems) }
        }

        const reindexedChildren = newChildren.map((c, i) => ({ ...c, order_index: i }))
        const updatedSuperset = {
            ...superset,
            children: reindexedChildren,
            rest_seconds: supersetRestFromChildren(reindexedChildren),
        }
        newItems.splice(supersetIndex, 1, updatedSuperset)
        newItems.splice(supersetIndex + 1, 0, removedChild)
        return { ...w, items: reindexItems(newItems) }
    })
}

/** Extrai todos os filhos do superset como itens top-level, na posição dele. */
export function dissolveSupersetIn(workouts: Workout[], workoutId: string, supersetId: string): Workout[] {
    return mapWorkout(workouts, workoutId, w => {
        const index = w.items.findIndex(i => i.id === supersetId)
        if (index === -1) return w

        const superset = w.items[index]
        if (!superset.children || superset.children.length === 0) return w

        const children = superset.children.map(c => ({ ...c, parent_item_id: null }))
        const newItems = [...w.items]
        newItems.splice(index, 1, ...children)
        return { ...w, items: reindexItems(newItems) }
    })
}
