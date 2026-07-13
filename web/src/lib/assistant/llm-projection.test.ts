// Projeção lossless (P7): só o semanticamente VAZIO sai; 0/false/ids ficam.

import { describe, it, expect } from 'vitest'
import { stripEmptyDeep, projectMcpResultForLlm } from './llm-projection'

describe('stripEmptyDeep', () => {
    it('remove null/undefined/vazio em qualquer profundidade', () => {
        const input = {
            id: 'abc',
            notes: null,
            equipment: '',
            substitute_exercise_ids: [],
            item_config: {},
            children: [{ id: 'c1', parent_item_id: null }, {}],
        }
        expect(stripEmptyDeep(input)).toEqual({
            id: 'abc',
            children: [{ id: 'c1' }],
        })
    })

    it('preserva 0, false e strings reais', () => {
        expect(stripEmptyDeep({ rest_seconds: 0, active: false, reps: '8-12' })).toEqual({
            rest_seconds: 0,
            active: false,
            reps: '8-12',
        })
    })

    it('reduz payload real de programa sem perder nenhum campo com valor', () => {
        const program = {
            program: {
                id: 'p1',
                name: 'Treino V',
                started_at: null,
                workouts: [
                    {
                        id: 'w1',
                        name: 'A',
                        items: [
                            { id: 'i1', exercise_id: 'e1', sets: 3, reps: '8', notes: null, method_key: null, substitute_exercise_ids: [] },
                            { id: 'i2', exercise_id: 'e2', sets: 4, reps: '10', rest_seconds: 0, notes: '', method_key: null, substitute_exercise_ids: [] },
                        ],
                    },
                ],
            },
        }
        const out = stripEmptyDeep(program) as typeof program
        const s = JSON.stringify(out)
        expect(s.length).toBeLessThan(JSON.stringify(program).length * 0.8)
        expect(out.program.workouts[0].items[1]).toEqual({ id: 'i2', exercise_id: 'e2', sets: 4, reps: '10', rest_seconds: 0 })
    })
})

describe('projectMcpResultForLlm', () => {
    it('reescreve o envelope de sucesso com o payload enxuto', () => {
        const env = { content: [{ type: 'text', text: JSON.stringify({ a: 1, b: null, c: [] }) }] }
        const out = projectMcpResultForLlm(env) as typeof env
        expect(JSON.parse(out.content[0].text)).toEqual({ a: 1 })
    })

    it('erro MCP e formatos estranhos passam intocados', () => {
        const err = { isError: true, content: [{ text: '{"error":"x","hint":null}' }] }
        expect(projectMcpResultForLlm(err)).toBe(err)
        expect(projectMcpResultForLlm('raw')).toBe('raw')
        const notJson = { content: [{ type: 'text', text: 'não é json' }] }
        expect(projectMcpResultForLlm(notJson)).toBe(notJson)
    })
})
