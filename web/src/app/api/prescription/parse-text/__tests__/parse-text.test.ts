import { describe, it, expect } from 'vitest'
import { extractJson, validateAndFixResponse } from '../route'
import type { ParseTextResponse } from '../types'

// ── extractJson ──

describe('extractJson', () => {
    it('extrai JSON de texto puro', () => {
        const input = '{"workouts": []}'
        const result = extractJson(input)
        expect(result).toEqual({ workouts: [] })
    })

    it('extrai JSON de markdown code block com tag json', () => {
        const input = '```json\n{"workouts": [{"name": "A", "exercises": []}]}\n```'
        const result = extractJson(input)
        expect(result).toEqual({ workouts: [{ name: 'A', exercises: [] }] })
    })

    it('extrai JSON de markdown code block sem tag', () => {
        const input = '```\n{"workouts": []}\n```'
        const result = extractJson(input)
        expect(result).toEqual({ workouts: [] })
    })

    it('extrai JSON embutido em texto com explicação', () => {
        const input = 'Aqui está o resultado:\n{"workouts": []} e mais texto depois'
        const result = extractJson(input)
        expect(result).toEqual({ workouts: [] })
    })

    it('retorna null para texto sem JSON válido', () => {
        expect(extractJson('isso não é JSON')).toBeNull()
        expect(extractJson('')).toBeNull()
        expect(extractJson('{invalid json}')).toBeNull()
    })

    it('preserva todos os campos do ParsedExercise', () => {
        const input = JSON.stringify({
            workouts: [{
                name: 'Treino A',
                exercises: [{
                    matched: true,
                    exercise_id: 'uuid-1',
                    catalog_name: 'Supino Reto com Barra',
                    original_text: 'supino reto',
                    sets: 4,
                    reps: '6-8',
                    rest_seconds: 120,
                    notes: 'até a falha',
                }],
            }],
        })
        const result = extractJson(input) as ParseTextResponse
        const ex = result.workouts[0].exercises[0]
        expect(ex.matched).toBe(true)
        expect(ex.exercise_id).toBe('uuid-1')
        expect(ex.catalog_name).toBe('Supino Reto com Barra')
        expect(ex.original_text).toBe('supino reto')
        expect(ex.sets).toBe(4)
        expect(ex.reps).toBe('6-8')
        expect(ex.rest_seconds).toBe(120)
        expect(ex.notes).toBe('até a falha')
    })
})

// ── validateAndFixResponse ──

describe('validateAndFixResponse', () => {
    const validIds = new Set(['ex-1', 'ex-2', 'ex-3'])

    it('retorna null se parsed não tem campo workouts', () => {
        expect(validateAndFixResponse({}, validIds)).toBeNull()
        expect(validateAndFixResponse({ data: [] }, validIds)).toBeNull()
        expect(validateAndFixResponse(null, validIds)).toBeNull()
    })

    it('retorna null se workouts não é array', () => {
        expect(validateAndFixResponse({ workouts: 'not array' }, validIds)).toBeNull()
    })

    it('preserva exercícios com exercise_id válido', () => {
        const input = {
            workouts: [{
                name: 'Treino A',
                exercises: [{
                    matched: true,
                    exercise_id: 'ex-1',
                    catalog_name: 'Supino',
                    original_text: 'supino',
                    sets: 3,
                    reps: '10',
                    rest_seconds: null,
                    notes: null,
                }],
            }],
        }
        const result = validateAndFixResponse(input, validIds)!
        expect(result.workouts[0].exercises[0].matched).toBe(true)
        expect(result.workouts[0].exercises[0].exercise_id).toBe('ex-1')
    })

    it('marca como unmatched exercícios com exercise_id inválido (hallucination)', () => {
        const input = {
            workouts: [{
                name: 'Treino A',
                exercises: [{
                    matched: true,
                    exercise_id: 'hallucinated-id',
                    catalog_name: 'Exercício Inventado',
                    original_text: 'exercício inventado',
                    sets: 3,
                    reps: '10',
                    rest_seconds: null,
                    notes: null,
                }],
            }],
        }
        const result = validateAndFixResponse(input, validIds)!
        const ex = result.workouts[0].exercises[0]
        expect(ex.matched).toBe(false)
        expect(ex.exercise_id).toBeNull()
        expect(ex.catalog_name).toBeNull()
    })

    it('preserva exercícios já marcados como unmatched', () => {
        const input = {
            workouts: [{
                name: 'Treino A',
                exercises: [{
                    matched: false,
                    exercise_id: null,
                    catalog_name: null,
                    original_text: 'exercício desconhecido',
                    sets: 3,
                    reps: '10',
                    rest_seconds: null,
                    notes: null,
                }],
            }],
        }
        const result = validateAndFixResponse(input, validIds)!
        expect(result.workouts[0].exercises[0].matched).toBe(false)
        expect(result.workouts[0].exercises[0].original_text).toBe('exercício desconhecido')
    })

    it('processa workout vazio (sem exercícios) sem erro', () => {
        const input = {
            workouts: [{ name: 'Treino A', exercises: [] }],
        }
        const result = validateAndFixResponse(input, validIds)!
        expect(result.workouts).toHaveLength(1)
        expect(result.workouts[0].exercises).toHaveLength(0)
    })

    it('processa múltiplos workouts com mix de válidos e inválidos', () => {
        const input = {
            workouts: [
                {
                    name: 'Treino A',
                    exercises: [
                        { matched: true, exercise_id: 'ex-1', catalog_name: 'Supino', original_text: 'supino', sets: 3, reps: '10', rest_seconds: null, notes: null },
                        { matched: true, exercise_id: 'fake-id', catalog_name: 'Fake', original_text: 'fake', sets: 3, reps: '10', rest_seconds: null, notes: null },
                    ],
                },
                {
                    name: 'Treino B',
                    exercises: [
                        { matched: true, exercise_id: 'ex-2', catalog_name: 'Puxada', original_text: 'puxada', sets: 3, reps: '12', rest_seconds: null, notes: null },
                    ],
                },
            ],
        }
        const result = validateAndFixResponse(input, validIds)!
        expect(result.workouts).toHaveLength(2)
        // First workout: ex-1 valid, fake-id corrected
        expect(result.workouts[0].exercises[0].matched).toBe(true)
        expect(result.workouts[0].exercises[1].matched).toBe(false)
        // Second workout: ex-2 valid
        expect(result.workouts[1].exercises[0].matched).toBe(true)
    })
})
