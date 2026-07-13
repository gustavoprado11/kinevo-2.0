// Mineração: o que os programas do treinador respondem sozinhos (para a
// entrevista não perguntar o óbvio) e, principalmente, o que ela NÃO pode inventar.

import { describe, it, expect } from 'vitest'
import { mineStyle, MIN_PROGRAMS_TO_MINE, type MinedProgram, type MinedItem } from './style-miner'

function item(over: Partial<MinedItem> = {}): MinedItem {
    return {
        exercise_function: 'main',
        sets: 3,
        reps: '8-12',
        rest_seconds: 120,
        method_key: null,
        exercise_name: 'Supino reto',
        muscle_group: 'Peito',
        in_superset: false,
        ...over,
    }
}

/** Programa PPL 5x/semana, sempre com os mesmos números — estilo bem definido. */
function pplProgram(id: string, over: { method?: string; superset?: boolean } = {}): MinedProgram {
    return {
        id,
        workouts: [
            {
                name: 'Treino A',
                scheduled_days: [1, 4],
                items: [
                    item({ exercise_name: 'Supino reto', muscle_group: 'Peito', reps: '6-8', rest_seconds: 150 }),
                    item({
                        exercise_name: 'Desenvolvimento',
                        muscle_group: 'Ombros',
                        reps: '6-8',
                        rest_seconds: 150,
                        method_key: over.method ?? null,
                    }),
                    item({
                        exercise_function: 'accessory',
                        exercise_name: 'Tríceps corda',
                        muscle_group: 'Tríceps',
                        reps: '10-15',
                        rest_seconds: 45,
                        in_superset: over.superset ?? false,
                    }),
                ],
            },
            {
                name: 'Treino B',
                scheduled_days: [2, 5],
                items: [
                    item({ exercise_name: 'Remada curvada', muscle_group: 'Costas', reps: '6-8', rest_seconds: 150 }),
                    item({
                        exercise_function: 'accessory',
                        exercise_name: 'Rosca direta',
                        muscle_group: 'Bíceps',
                        reps: '10-15',
                        rest_seconds: 45,
                    }),
                ],
            },
            {
                name: 'Treino C',
                scheduled_days: [6],
                items: [
                    item({ exercise_name: 'Agachamento livre', muscle_group: 'Quadríceps', reps: '6-8', rest_seconds: 150 }),
                    item({
                        exercise_function: 'accessory',
                        exercise_name: 'Mesa flexora',
                        muscle_group: 'Posterior',
                        reps: '10-15',
                        rest_seconds: 45,
                    }),
                ],
            },
        ],
    }
}

const cinco = () => Array.from({ length: 5 }, (_, i) => pplProgram(`p${i}`))

describe('piso de dados', () => {
    it('abaixo de 5 programas não minera nada (estatística de 2 programas é ruído)', () => {
        const result = mineStyle([pplProgram('p1'), pplProgram('p2')])
        expect(result.style).toEqual({})
        expect(result.minedSlots).toEqual([])
        expect(result.programsAnalyzed).toBe(2)
    })

    it('o piso é 5', () => {
        expect(MIN_PROGRAMS_TO_MINE).toBe(5)
        expect(mineStyle(cinco()).minedSlots.length).toBeGreaterThan(0)
    })
})

describe('mineStyle — o que os programas respondem', () => {
    it('deduz o split por frequência e a convenção de nomes', () => {
        const { style, minedSlots } = mineStyle(cinco())
        // 5 dias agendados na semana → PPL (push, pull e lower presentes)
        expect(style.splits_by_frequency).toEqual({ '5': 'PPL (push/pull/legs)' })
        expect(style.session_naming).toBe('Letras (Treino A/B/C)')
        expect(minedSlots).toContain('split')
    })

    it('separa reps/descanso de composto e de acessório', () => {
        const { style, minedSlots } = mineStyle(cinco())
        expect(style.reps_compound).toBe('6–8')
        expect(style.reps_accessory).toBe('10–15')
        expect(style.rest_compound_seconds).toEqual({ min: 150, max: 150 })
        expect(style.rest_accessory_seconds).toEqual({ min: 45, max: 45 })
        expect(minedSlots).toContain('reps')
        expect(minedSlots).toContain('rest')
    })

    it('conta o volume semanal multiplicando as séries pelos dias agendados', () => {
        const { style } = mineStyle(cinco())
        // Peito: 3 séries × 2 dias (seg/qui) = 6/semana — é o grupo mais volumoso.
        expect(style.weekly_sets_emphasized).toEqual({ min: 6, max: 6 })
        expect(style.weekly_sets_principal).not.toBeNull()
    })

    it('só considera método presente em 2+ programas, e só do catálogo', () => {
        const programs = [
            pplProgram('p1', { method: 'drop_set' }),
            pplProgram('p2', { method: 'drop_set' }),
            pplProgram('p3', { method: 'metodo_inventado' }),
            pplProgram('p4', { method: 'cluster' }), // só 1 programa → não conta
            pplProgram('p5'),
        ]
        const { style, minedSlots } = mineStyle(programs)
        expect(style.methods_used).toEqual(['drop_set'])
        expect(minedSlots).toContain('methods')
    })

    it('classifica o uso de superset pela fatia de programas que o usam', () => {
        const raro = mineStyle(cinco())
        expect(raro.style.superset_usage).toBe('raro')

        const frequente = mineStyle([
            pplProgram('p1', { superset: true }),
            pplProgram('p2', { superset: true }),
            pplProgram('p3', { superset: true }),
            pplProgram('p4'),
            pplProgram('p5'),
        ])
        expect(frequente.style.superset_usage).toBe('frequente')
    })

    it('favoritos são os exercícios que se repetem entre programas, por grupo', () => {
        const { style } = mineStyle(cinco())
        const peito = style.favorite_exercises?.find((f) => f.group === 'Peito')
        expect(peito?.names).toContain('Supino reto')
    })

    it('nunca minera progressão, aquecimento ou observações (nenhum programa diz isso)', () => {
        const { style, minedSlots } = mineStyle(cinco())
        expect(style.progression).toBeUndefined()
        expect(style.warmup).toBeUndefined()
        expect(minedSlots).not.toContain('progression')
        expect(minedSlots).not.toContain('warmup')
        expect(minedSlots).not.toContain('notes')
    })
})

describe('mineStyle — dados imperfeitos', () => {
    it('classifica composto pelo nome quando falta exercise_function', () => {
        const programs = Array.from({ length: 5 }, (_, i) => ({
            id: `p${i}`,
            workouts: [
                {
                    name: 'Full body',
                    scheduled_days: [1, 3, 5],
                    items: [
                        item({ exercise_function: null, exercise_name: 'Agachamento livre', muscle_group: 'Quadríceps', reps: '5', rest_seconds: 180 }),
                        item({ exercise_function: null, exercise_name: 'Cadeira extensora', muscle_group: 'Quadríceps', reps: '12-15', rest_seconds: 60 }),
                    ],
                },
            ],
        }))
        const { style } = mineStyle(programs)
        expect(style.reps_compound).toBe('5')
        expect(style.reps_accessory).toBe('12–15')
    })

    it('itens sem grupo muscular não quebram o volume nem os favoritos', () => {
        const programs = Array.from({ length: 5 }, (_, i) => ({
            id: `p${i}`,
            workouts: [
                {
                    name: 'Treino A',
                    scheduled_days: [1],
                    items: [item({ muscle_group: null }), item({ muscle_group: null, exercise_name: null })],
                },
            ],
        }))
        const { style } = mineStyle(programs)
        expect(style.weekly_sets_emphasized ?? null).toBeNull()
        expect(style.favorite_exercises ?? []).toEqual([])
    })
})
