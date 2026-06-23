import { describe, it, expect } from 'vitest'
import { renderedToWorkouts } from '../rendered-to-workouts'
import type { Exercise } from '@/types/exercise'
import type { RenderedProgram } from '@/lib/programs/ai-canvas/types'
import { DROP_SET_DEFAULT } from '@kinevo/shared/lib/prescription/set-scheme-presets'

// O adapter só lê exercise.id e guarda o ref; minimal cast basta pro contrato.
const ex = (id: string): Exercise => ({ id, name: id } as Exercise)
const exercises = [ex('ex1'), ex('ex2'), ex('ex3'), ex('ex4')]

describe('renderedToWorkouts — métodos + supersets', () => {
    it('item simples vira exercício sem set_scheme e mapeia o dia', () => {
        const prog: RenderedProgram = {
            sessions: [{ name: 'Treino A', scheduled_days: [1], items: [{ exercise_id: 'ex1', sets: 3, reps: '10' }] }],
        }
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items).toHaveLength(1)
        expect(w.items[0].item_type).toBe('exercise')
        expect(w.items[0].exercise_id).toBe('ex1')
        expect(w.items[0].set_scheme).toBeNull()
        expect(w.items[0].method_key).toBeNull()
        expect(w.frequency).toEqual(['mon'])
    })

    it('method=drop_set aplica o preset canônico + rounds=3 (composto)', () => {
        const prog: RenderedProgram = {
            sessions: [{ name: 'A', scheduled_days: [], items: [{ exercise_id: 'ex1', sets: 3, reps: '10', method: 'drop_set' }] }],
        }
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items[0].method_key).toBe('drop_set')
        expect(w.items[0].rounds).toBe(3)
        expect(w.items[0].set_scheme).toEqual(DROP_SET_DEFAULT)
    })

    it('method desconhecido é ignorado (séries retas)', () => {
        const prog = {
            sessions: [{ name: 'A', scheduled_days: [], items: [{ exercise_id: 'ex1', sets: 3, reps: '10', method: 'bogus' }] }],
        } as unknown as RenderedProgram
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items[0].method_key).toBeNull()
        expect(w.items[0].set_scheme).toBeNull()
    })

    it('superset_group consecutivo agrupa em superset; filhos sem método/scheme', () => {
        const prog: RenderedProgram = {
            sessions: [{
                name: 'A', scheduled_days: [], items: [
                    { exercise_id: 'ex1', sets: 3, reps: '10', superset_group: 'A1', method: 'drop_set' },
                    { exercise_id: 'ex2', sets: 3, reps: '10', superset_group: 'A1' },
                    { exercise_id: 'ex3', sets: 3, reps: '12' },
                ],
            }],
        }
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items).toHaveLength(2) // [superset, ex3]
        const ss = w.items[0]
        expect(ss.item_type).toBe('superset')
        expect(ss.exercise_id).toBeNull()
        expect(ss.children).toHaveLength(2)
        expect(ss.children![0].parent_item_id).toBe(ss.id)
        expect(ss.children![0].exercise_id).toBe('ex1')
        // regra V1: superset não persiste método/scheme nos filhos
        expect(ss.children![0].method_key).toBeNull()
        expect(ss.children![0].set_scheme).toBeNull()
        expect(ss.children![1].exercise_id).toBe('ex2')
        expect(w.items[1].exercise_id).toBe('ex3')
    })

    it('tag de superset com um único item não vira superset', () => {
        const prog: RenderedProgram = {
            sessions: [{
                name: 'A', scheduled_days: [], items: [
                    { exercise_id: 'ex1', superset_group: 'A1' },
                    { exercise_id: 'ex2', superset_group: 'B1' },
                ],
            }],
        }
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items).toHaveLength(2)
        expect(w.items.every(i => i.item_type === 'exercise')).toBe(true)
    })

    it('id fora do catálogo é descartado', () => {
        const prog: RenderedProgram = {
            sessions: [{ name: 'A', scheduled_days: [], items: [{ exercise_id: 'ex1' }, { exercise_id: 'naoexiste' }] }],
        }
        const [w] = renderedToWorkouts(prog, exercises)
        expect(w.items).toHaveLength(1)
        expect(w.items[0].exercise_id).toBe('ex1')
    })
})
