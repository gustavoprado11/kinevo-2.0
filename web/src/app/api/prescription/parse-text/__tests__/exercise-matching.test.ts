import { describe, it, expect } from 'vitest'
import { extractJson, validateAndFixResponse } from '../route'
import type { ParseTextResponse } from '../types'

// ── Exercise catalog formatting ──

describe('Exercise matching logic', () => {
    const catalog = [
        { id: 'aaa-111', name: 'Supino Inclinado com Halteres' },
        { id: 'bbb-222', name: 'Puxada Aberta Barra reta' },
        { id: 'ccc-333', name: 'Remada Unilateral Halteres - Pegada Neutra (Serrote)' },
        { id: 'ddd-444', name: 'Elevação de Quadril com Barra' },
        { id: 'eee-555', name: 'Cadeira Extensora' },
    ]

    it('formato do catálogo para o prompt está correto', () => {
        const formatted = catalog.map(e => `${e.id}|${e.name}`).join('\n')
        expect(formatted).toContain('aaa-111|Supino Inclinado com Halteres')
        expect(formatted).toContain('bbb-222|Puxada Aberta Barra reta')
        expect(formatted.split('\n')).toHaveLength(5)
        // Each line must have exactly one pipe separator
        for (const line of formatted.split('\n')) {
            expect(line.split('|')).toHaveLength(2)
        }
    })

    it('response do LLM é parseável pelo tipo ParseTextResponse', () => {
        const llmResponse = JSON.stringify({
            workouts: [{
                name: 'Treino A',
                exercises: [
                    {
                        matched: true,
                        exercise_id: 'aaa-111',
                        catalog_name: 'Supino Inclinado com Halteres',
                        original_text: 'supino inclinado halter',
                        sets: 3,
                        reps: '8-10',
                        rest_seconds: 90,
                        notes: null,
                    },
                    {
                        matched: false,
                        exercise_id: null,
                        catalog_name: null,
                        original_text: 'exercício desconhecido',
                        sets: 3,
                        reps: '10',
                        rest_seconds: null,
                        notes: null,
                    },
                ],
            }],
        })

        const parsed = extractJson(llmResponse) as ParseTextResponse
        expect(parsed.workouts).toBeDefined()
        expect(parsed.workouts).toHaveLength(1)
        expect(parsed.workouts[0].exercises).toHaveLength(2)

        const matched = parsed.workouts[0].exercises[0]
        expect(matched.matched).toBe(true)
        expect(matched.exercise_id).toBe('aaa-111')
        expect(matched.sets).toBe(3)
        expect(matched.reps).toBe('8-10')

        const unmatched = parsed.workouts[0].exercises[1]
        expect(unmatched.matched).toBe(false)
        expect(unmatched.exercise_id).toBeNull()
    })

    it('exercise_ids válidos são preservados, inválidos marcados como unmatched', () => {
        const idSet = new Set(catalog.map(e => e.id))

        const input = {
            workouts: [{
                name: 'Treino A',
                exercises: [
                    { matched: true, exercise_id: 'aaa-111', catalog_name: 'Supino', original_text: 'supino', sets: 3, reps: '10', rest_seconds: null, notes: null },
                    { matched: true, exercise_id: 'zzz-999', catalog_name: 'Inventado', original_text: 'inventado', sets: 3, reps: '10', rest_seconds: null, notes: null },
                    { matched: true, exercise_id: 'eee-555', catalog_name: 'Extensora', original_text: 'extensora', sets: 3, reps: '15', rest_seconds: null, notes: null },
                ],
            }],
        }

        const result = validateAndFixResponse(input, idSet)!
        const exercises = result.workouts[0].exercises

        // aaa-111 exists in catalog — stays matched
        expect(exercises[0].matched).toBe(true)
        expect(exercises[0].exercise_id).toBe('aaa-111')

        // zzz-999 does NOT exist — corrected to unmatched
        expect(exercises[1].matched).toBe(false)
        expect(exercises[1].exercise_id).toBeNull()
        expect(exercises[1].catalog_name).toBeNull()
        // original_text preserved
        expect(exercises[1].original_text).toBe('inventado')

        // eee-555 exists — stays matched
        expect(exercises[2].matched).toBe(true)
        expect(exercises[2].exercise_id).toBe('eee-555')
    })

    it('response com múltiplos treinos é parseada corretamente', () => {
        const llmResponse = JSON.stringify({
            workouts: [
                { name: 'Treino A', exercises: [{ matched: true, exercise_id: 'aaa-111', catalog_name: 'Supino', original_text: 'supino', sets: 4, reps: '8', rest_seconds: 120, notes: 'drop set' }] },
                { name: 'Treino B', exercises: [{ matched: true, exercise_id: 'bbb-222', catalog_name: 'Puxada', original_text: 'puxada', sets: 3, reps: '10-12', rest_seconds: 60, notes: null }] },
            ],
        })

        const parsed = extractJson(llmResponse) as ParseTextResponse
        expect(parsed.workouts).toHaveLength(2)
        expect(parsed.workouts[0].name).toBe('Treino A')
        expect(parsed.workouts[1].name).toBe('Treino B')
        expect(parsed.workouts[0].exercises[0].notes).toBe('drop set')
        expect(parsed.workouts[1].exercises[0].rest_seconds).toBe(60)
    })
})
