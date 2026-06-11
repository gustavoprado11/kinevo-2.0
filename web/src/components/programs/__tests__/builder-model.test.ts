import { describe, it, expect } from 'vitest'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'
import {
    type Workout,
    type WorkoutItem,
    addToExistingSupersetIn,
    aggregatesFromItem,
    appendItemsIn,
    buildSetSchemeRows,
    cleanupEmptyPlaceholdersIn,
    cloneItem,
    createSupersetWithNextIn,
    deleteItemIn,
    deleteWorkoutIn,
    dissolveSupersetIn,
    duplicateItemIn,
    duplicateWorkoutIn,
    duplicateWorkoutName,
    effectiveRoundsForItem,
    generateWorkoutName,
    hydrateSetScheme,
    makeCardioItem,
    makeExerciseItem,
    makeNoteItem,
    makeWarmupItem,
    moveItemIn,
    parseSetsCount,
    removeFromSupersetIn,
    reorderItemIn,
    reorderWorkoutsIn,
    updateItemIn,
} from '../builder-model'

// ── Fixtures ────────────────────────────────────────────────────────────────

let seq = 0
function exercise(id: string, overrides: Partial<WorkoutItem> = {}): WorkoutItem {
    seq++
    return {
        id,
        item_type: 'exercise',
        order_index: seq,
        parent_item_id: null,
        exercise_id: `ex-${id}`,
        substitute_exercise_ids: [],
        sets: 3,
        reps: '10-12',
        rest_seconds: 60,
        notes: null,
        children: [],
        ...overrides,
    }
}

function workout(id: string, items: WorkoutItem[]): Workout {
    return {
        id,
        name: `Treino ${id}`,
        order_index: 0,
        items: items.map((item, i) => ({ ...item, order_index: i })),
        frequency: [],
    }
}

function set(n: number, overrides: Partial<WorkoutSet> = {}): WorkoutSet {
    return {
        set_number: n,
        set_type: 'normal',
        reps: '10',
        rest_seconds: 60,
        weight_target_kg: null,
        weight_target_pct1rm: null,
        rir: null,
        tempo: null,
        notes: null,
        ...overrides,
    }
}

const ids = (w: Workout) => w.items.map(i => i.id)
const orderIndexes = (w: Workout) => w.items.map(i => i.order_index)

// ── Supersets ────────────────────────────────────────────────────────────────

describe('createSupersetWithNextIn', () => {
    it('agrupa o exercício com o seguinte, setando parent_item_id dos filhos', () => {
        const w = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [result] = createSupersetWithNextIn([w], 'w1', 'a')

        expect(result.items).toHaveLength(2)
        const superset = result.items[0]
        expect(superset.item_type).toBe('superset')
        expect(superset.children).toHaveLength(2)
        expect(superset.children![0].id).toBe('a')
        expect(superset.children![1].id).toBe('b')
        // Filhos apontam pro container — sem isso effectiveMethodKey e a
        // persistência de scheme em filhos não obedecem a regra V1.
        expect(superset.children![0].parent_item_id).toBe(superset.id)
        expect(superset.children![1].parent_item_id).toBe(superset.id)
        expect(orderIndexes(result)).toEqual([0, 1])
    })

    it('herda o rest do item atual no superset (fallback 60s)', () => {
        const w = workout('w1', [exercise('a', { rest_seconds: 90 }), exercise('b')])
        const [result] = createSupersetWithNextIn([w], 'w1', 'a')
        expect(result.items[0].rest_seconds).toBe(90)

        const w2 = workout('w2', [exercise('a', { rest_seconds: null }), exercise('b')])
        const [result2] = createSupersetWithNextIn([w2], 'w2', 'a')
        expect(result2.items[0].rest_seconds).toBe(60)
    })

    it('não agrupa quando o vizinho não é exercício ou é o último item', () => {
        const w = workout('w1', [exercise('a'), makeNoteItem('obs'), exercise('c')])
        expect(createSupersetWithNextIn([w], 'w1', 'a')[0]).toBe(w)
        expect(createSupersetWithNextIn([w], 'w1', 'c')[0]).toBe(w)
    })
})

describe('addToExistingSupersetIn', () => {
    it('move o exercício pra dentro do superset com parent e order corretos', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [withSuperset] = createSupersetWithNextIn([base], 'w1', 'a')
        const supersetId = withSuperset.items[0].id

        const [result] = addToExistingSupersetIn([withSuperset], 'w1', 'c', supersetId)
        expect(result.items).toHaveLength(1)
        const superset = result.items[0]
        expect(superset.children!.map(c => c.id)).toEqual(['a', 'b', 'c'])
        expect(superset.children![2].parent_item_id).toBe(supersetId)
        expect(superset.children!.map(c => c.order_index)).toEqual([0, 1, 2])
    })

    it('ignora itens que não são exercício', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), makeNoteItem('x')])
        const [withSuperset] = createSupersetWithNextIn([base], 'w1', 'a')
        const noteId = withSuperset.items[1].id
        const [result] = addToExistingSupersetIn([withSuperset], 'w1', noteId, withSuperset.items[0].id)
        expect(result).toBe(withSuperset)
    })
})

describe('removeFromSupersetIn', () => {
    it('com 3+ filhos remove o filho e o coloca logo após o superset', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')
        const [s2] = addToExistingSupersetIn([s1], 'w1', 'c', s1.items[0].id)

        const [result] = removeFromSupersetIn([s2], 'w1', s2.items[0].id, 'a')
        expect(result.items).toHaveLength(2)
        expect(result.items[0].item_type).toBe('superset')
        expect(result.items[0].children!.map(c => c.id)).toEqual(['b', 'c'])
        expect(result.items[1].id).toBe('a')
        expect(result.items[1].parent_item_id).toBeNull()
        expect(orderIndexes(result)).toEqual([0, 1])
    })

    it('auto-dissolve com 2 filhos: removido + sobrevivente promovidos a root', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')

        const [result] = removeFromSupersetIn([s1], 'w1', s1.items[0].id, 'a')
        expect(ids(result)).toEqual(['a', 'b', 'c'])
        expect(result.items.every(i => i.parent_item_id === null)).toBe(true)
        expect(orderIndexes(result)).toEqual([0, 1, 2])
    })
})

describe('dissolveSupersetIn', () => {
    it('promove todos os filhos pra posição do superset', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'b')

        const [result] = dissolveSupersetIn([s1], 'w1', s1.items[1].id)
        expect(ids(result)).toEqual(['a', 'b', 'c'])
        expect(result.items.every(i => i.parent_item_id === null)).toBe(true)
    })
})

// ── Itens ────────────────────────────────────────────────────────────────────

describe('moveItemIn', () => {
    it('move item top-level e reindexa', () => {
        const w = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [result] = moveItemIn([w], 'w1', 'c', 'up')
        expect(ids(result)).toEqual(['a', 'c', 'b'])
        expect(orderIndexes(result)).toEqual([0, 1, 2])
    })

    it('move filho DENTRO do superset (caso que era no-op no builder antigo)', () => {
        const base = workout('w1', [exercise('a'), exercise('b')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')

        const [result] = moveItemIn([s1], 'w1', 'b', 'up')
        const superset = result.items[0]
        expect(superset.children!.map(c => c.id)).toEqual(['b', 'a'])
        expect(superset.children!.map(c => c.order_index)).toEqual([0, 1])
    })

    it('é no-op nas bordas', () => {
        const w = workout('w1', [exercise('a'), exercise('b')])
        expect(ids(moveItemIn([w], 'w1', 'a', 'up')[0])).toEqual(['a', 'b'])
        expect(ids(moveItemIn([w], 'w1', 'b', 'down')[0])).toEqual(['a', 'b'])
    })
})

describe('duplicateItemIn / cloneItem', () => {
    it('insere a cópia logo após o original com IDs novos e filhos reparentados', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')
        const supersetId = s1.items[0].id

        const [result] = duplicateItemIn([s1], 'w1', supersetId)
        expect(result.items).toHaveLength(3)
        const copy = result.items[1]
        expect(copy.item_type).toBe('superset')
        expect(copy.id).not.toBe(supersetId)
        expect(copy.children!.every(c => c.parent_item_id === copy.id)).toBe(true)
        expect(copy.children!.map(c => c.id)).not.toEqual(s1.items[0].children!.map(c => c.id))
    })

    it('clona set_scheme e item_config sem compartilhar referência', () => {
        const original = exercise('a', {
            set_scheme: [set(1), set(2)],
            item_config: { mode: 'continuous' },
            substitute_exercise_ids: ['sub-1'],
        })
        const copy = cloneItem(original)
        expect(copy.set_scheme).toEqual(original.set_scheme)
        expect(copy.set_scheme![0]).not.toBe(original.set_scheme![0])
        expect(copy.item_config).not.toBe(original.item_config)
        expect(copy.substitute_exercise_ids).not.toBe(original.substitute_exercise_ids)
    })
})

describe('deleteItemIn', () => {
    it('remove item root e reindexa', () => {
        const w = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [result] = deleteItemIn([w], 'w1', 'b')
        expect(ids(result)).toEqual(['a', 'c'])
        expect(orderIndexes(result)).toEqual([0, 1])
    })

    it('remove filho de superset e reindexa os irmãos', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')
        const [s2] = addToExistingSupersetIn([s1], 'w1', 'c', s1.items[0].id)

        const [result] = deleteItemIn([s2], 'w1', 'b')
        const superset = result.items[0]
        expect(superset.children!.map(c => c.id)).toEqual(['a', 'c'])
        expect(superset.children!.map(c => c.order_index)).toEqual([0, 1])
    })
})

describe('updateItemIn', () => {
    it('atualiza item root e filho de superset', () => {
        const base = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [s1] = createSupersetWithNextIn([base], 'w1', 'a')

        const [r1] = updateItemIn([s1], 'w1', 'c', { reps: '8' })
        expect(r1.items[1].reps).toBe('8')

        const [r2] = updateItemIn([s1], 'w1', 'b', { reps: '15' })
        expect(r2.items[0].children![1].reps).toBe('15')
    })
})

describe('reorderItemIn / appendItemsIn', () => {
    it('reordena via drag-and-drop com reindex', () => {
        const w = workout('w1', [exercise('a'), exercise('b'), exercise('c')])
        const [result] = reorderItemIn([w], 'w1', 'a', 'c')
        expect(ids(result)).toEqual(['b', 'c', 'a'])
        expect(orderIndexes(result)).toEqual([0, 1, 2])
    })

    it('appendItemsIn entrega o workout atual à factory e reindexa', () => {
        const w = workout('w1', [exercise('a')])
        const [result] = appendItemsIn([w], 'w1', (current) => {
            expect(current.items).toHaveLength(1)
            return [makeWarmupItem(), makeNoteItem('x')]
        })
        expect(result.items).toHaveLength(3)
        expect(orderIndexes(result)).toEqual([0, 1, 2])
    })
})

// ── Workouts ─────────────────────────────────────────────────────────────────

describe('workout-level', () => {
    it('deleteWorkoutIn reindexa order_index', () => {
        const a = { ...workout('a', []), order_index: 0 }
        const b = { ...workout('b', []), order_index: 1 }
        const c = { ...workout('c', []), order_index: 2 }
        const result = deleteWorkoutIn([a, b, c], 'b')
        expect(result.map(w => w.id)).toEqual(['a', 'c'])
        expect(result.map(w => w.order_index)).toEqual([0, 1])
    })

    it('reorderWorkoutsIn move e reindexa', () => {
        const list = [workout('a', []), workout('b', []), workout('c', [])]
        const result = reorderWorkoutsIn(list, 'c', 'a')
        expect(result.map(w => w.id)).toEqual(['c', 'a', 'b'])
        expect(result.map(w => w.order_index)).toEqual([0, 1, 2])
    })

    it('duplicateWorkoutIn clona itens profundamente e zera frequency', () => {
        const src = workout('w1', [exercise('a', { item_config: { k: 1 } })])
        src.frequency = ['mon']
        const result = duplicateWorkoutIn([src], 'w1', 'Treino B - Peito')
        expect(result).toHaveLength(2)
        const copy = result[1]
        expect(copy.name).toBe('Treino B - Peito')
        expect(copy.frequency).toEqual([])
        expect(copy.items[0].id).not.toBe('a')
        expect(copy.items[0].item_config).not.toBe(src.items[0].item_config)
    })

    it('duplicateWorkoutName preserva o sufixo descritivo', () => {
        expect(duplicateWorkoutName('Treino A - Peito', 'Treino C')).toBe('Treino C - Peito')
        expect(duplicateWorkoutName('Treino 2 - Costas', 'Treino 3')).toBe('Treino 3 - Costas')
        expect(duplicateWorkoutName('Dia 1 - Pernas', 'Treino B')).toBe('Treino B - Pernas')
        expect(duplicateWorkoutName('Peito e ombro', 'Treino B')).toBe('Treino B - Peito e ombro')
    })

    it('cleanupEmptyPlaceholdersIn remove só vazios e devolve a mesma ref sem mudança', () => {
        const empty = workout('a', [])
        const full = workout('b', [exercise('x')])
        const result = cleanupEmptyPlaceholdersIn([empty, full], ['a', 'b'])
        expect(result.map(w => w.id)).toEqual(['b'])
        expect(result[0].order_index).toBe(0)

        const untouched = cleanupEmptyPlaceholdersIn([full], ['nope'])
        expect(untouched).toEqual([full])
        const same = cleanupEmptyPlaceholdersIn([full], [])
        expect(same[0]).toBe(full)
    })

    it('generateWorkoutName respeita a convenção', () => {
        expect(generateWorkoutName(0, 'letter')).toBe('Treino A')
        expect(generateWorkoutName(2, 'letter')).toBe('Treino C')
        expect(generateWorkoutName(0, 'free')).toBe('Treino 1')
    })
})

// ── Per-set / fábricas ───────────────────────────────────────────────────────

describe('per-set helpers', () => {
    it('parseSetsCount pega o limite inferior de faixas e tem fallback 3', () => {
        expect(parseSetsCount('3')).toBe(3)
        expect(parseSetsCount('3-4')).toBe(3)
        expect(parseSetsCount('abc')).toBe(3)
    })

    it('hydrateSetScheme vazio → { scheme: null, rounds: 1 }', () => {
        expect(hydrateSetScheme(null, null)).toEqual({ scheme: null, rounds: 1 })
        expect(hydrateSetScheme([], 5)).toEqual({ scheme: null, rounds: 1 })
    })

    it('effectiveRoundsForItem força 1 para métodos lineares e clampa compostos', () => {
        const linear = exercise('a', { set_scheme: [set(1)], method_key: null, rounds: 4 })
        expect(effectiveRoundsForItem(linear)).toBe(1)

        const compound = exercise('b', { set_scheme: [set(1)], method_key: 'drop_set', rounds: 4 })
        expect(effectiveRoundsForItem(compound)).toBe(4)

        const overflow = exercise('c', { set_scheme: [set(1)], method_key: 'cluster', rounds: 99 })
        expect(effectiveRoundsForItem(overflow)).toBe(20)
    })

    it('aggregatesFromItem deriva do scheme quando presente, senão mantém legado', () => {
        const noScheme = exercise('a', { sets: 5, reps: '5', rest_seconds: 120 })
        expect(aggregatesFromItem(noScheme)).toEqual({ sets: 5, reps: '5', rest_seconds: 120 })

        const withScheme = exercise('b', { set_scheme: [set(1), set(2), set(3)] })
        expect(aggregatesFromItem(withScheme).sets).toBe(3)
    })

    it('buildSetSchemeRows: linear materializa como está, composto expande por rounds', () => {
        const scheme = [set(1), set(2)]
        const linear = buildSetSchemeRows(scheme, 1)
        expect(linear).toHaveLength(2)
        expect(linear.map(r => r.set_number)).toEqual([1, 2])
        expect(linear.every(r => r.round_number === null)).toBe(true)

        const compound = buildSetSchemeRows(scheme, 3)
        expect(compound).toHaveLength(6)
        expect(compound.map(r => r.set_number)).toEqual([1, 2, 3, 4, 5, 6])
        expect(compound.every(r => r.round_number !== null)).toBe(true)

        expect(buildSetSchemeRows(null, 3)).toEqual([])
    })

    it('makeExerciseItem seeda scheme só no modo set_editor (e o override vence)', () => {
        const ex = { id: 'ex-1', name: 'Supino' } as never
        const plain = makeExerciseItem(ex, { setsCount: 3, reps: '10', restSeconds: 60 })
        expect(plain.set_scheme).toBeNull()
        expect(plain.sets).toBe(3)

        const seeded = makeExerciseItem(ex, { setsCount: 4, reps: '8', restSeconds: 90, seedSetEditor: true })
        expect(seeded.set_scheme).toHaveLength(4)
        expect(seeded.set_scheme![0]).toMatchObject({ set_number: 1, set_type: 'normal', reps: '8', rest_seconds: 90 })

        const overridden = makeExerciseItem(ex, { setsCount: 3, reps: '10', restSeconds: 60, seedSetEditor: true, setScheme: null })
        expect(overridden.set_scheme).toBeNull()
    })

    it('fábricas de quick blocks montam item_config esperado', () => {
        expect(makeWarmupItem().item_config).toEqual({ warmup_type: 'free' })
        expect(makeWarmupItem('mobilidade').item_config).toEqual({ warmup_type: 'free', description: 'mobilidade' })
        expect(makeCardioItem().item_config).toEqual({ mode: 'continuous', objective: 'time' })
        expect(makeCardioItem('zona 2').item_config).toEqual({ mode: 'continuous', objective: 'time', notes: 'zona 2' })
        expect(makeNoteItem('atenção').notes).toBe('atenção')
    })
})
