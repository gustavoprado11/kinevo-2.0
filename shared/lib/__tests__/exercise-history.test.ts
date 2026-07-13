import { describe, it, expect } from 'vitest'
import {
    groupExerciseHistory,
    summarizeExerciseHistory,
    type ExerciseHistoryRow,
} from '../exercise-history'

// O RPC devolve uma linha por série, já ordenado (sessão mais recente primeiro,
// séries em ordem). `weight` vem como string — é numeric no Postgres.
function row(
    sessionId: string,
    setNumber: number,
    weight: string,
    reps: number,
    over: Partial<ExerciseHistoryRow> = {},
): ExerciseHistoryRow {
    return {
        session_id: sessionId,
        completed_at: '2026-07-09T10:00:00Z',
        workout_name: 'Treino A',
        set_number: setNumber,
        weight,
        reps,
        ...over,
    }
}

describe('groupExerciseHistory', () => {
    it('agrupa por sessão preservando a ordem do banco (mais recente primeiro)', () => {
        const sessions = groupExerciseHistory([
            row('s1', 1, '45.00', 10, { completed_at: '2026-07-09T10:00:00Z' }),
            row('s1', 2, '45.00', 9),
            row('s2', 1, '40.00', 10, { completed_at: '2026-07-03T10:00:00Z', workout_name: 'Treino C' }),
        ])

        expect(sessions.map((s) => s.sessionId)).toEqual(['s1', 's2'])
        expect(sessions[0].sets).toHaveLength(2)
        expect(sessions[1].workoutName).toBe('Treino C')
    })

    it('converte a carga numeric (string) em número', () => {
        const [session] = groupExerciseHistory([row('s1', 1, '42.50', 8)])
        expect(session.sets[0].weight).toBe(42.5)
    })

    it('ordena as séries por número mesmo se vierem fora de ordem', () => {
        const [session] = groupExerciseHistory([
            row('s1', 3, '35.00', 10),
            row('s1', 1, '40.00', 10),
            row('s1', 2, '40.00', 9),
        ])
        expect(session.sets.map((s) => s.setNumber)).toEqual([1, 2, 3])
    })

    it('melhor série da sessão: mais pesada vence; empate na carga, mais reps', () => {
        const [session] = groupExerciseHistory([
            row('s1', 1, '40.00', 8),
            row('s1', 2, '40.00', 10),
            row('s1', 3, '35.00', 12),
        ])
        expect(session.topSet).toMatchObject({ weight: 40, reps: 10 })
    })

    it('volume é a tonelagem da sessão', () => {
        const [session] = groupExerciseHistory([
            row('s1', 1, '40.00', 10), // 400
            row('s1', 2, '35.00', 10), // 350
        ])
        expect(session.volume).toBe(750)
    })

    it('peso ou reps nulos não quebram (série registrada vazia)', () => {
        const [session] = groupExerciseHistory([
            { session_id: 's1', completed_at: null, workout_name: null, set_number: 1, weight: null, reps: null },
        ])
        expect(session.sets[0]).toMatchObject({ weight: 0, reps: 0 })
        expect(session.volume).toBe(0)
    })
})

describe('summarizeExerciseHistory', () => {
    const historico = () =>
        groupExerciseHistory([
            // última sessão: melhor série 45×10
            row('s1', 1, '45.00', 10, { completed_at: '2026-07-09T10:00:00Z' }),
            row('s1', 2, '45.00', 9),
            // penúltima: 40×10 — a subida de carga é +5 kg
            row('s2', 1, '40.00', 10, { completed_at: '2026-07-03T10:00:00Z' }),
            // mais antiga, mas com a MAIOR carga já feita: 50×10
            row('s3', 1, '50.00', 10, { completed_at: '2026-06-11T10:00:00Z' }),
        ])

    it('melhor carga vem do histórico inteiro, não só da última sessão', () => {
        const { best } = summarizeExerciseHistory(historico())
        expect(best?.set).toMatchObject({ weight: 50, reps: 10 })
        expect(best?.sessionId).toBe('s3')
    })

    it('última execução é a sessão mais recente', () => {
        const { last } = summarizeExerciseHistory(historico())
        expect(last?.sessionId).toBe('s1')
        expect(last?.topSet).toMatchObject({ weight: 45, reps: 10 })
    })

    it('variação compara a melhor série das duas últimas sessões', () => {
        expect(summarizeExerciseHistory(historico()).deltaKg).toBe(5)
    })

    it('com uma única sessão não há variação a mostrar', () => {
        const { deltaKg, best, last } = summarizeExerciseHistory(
            groupExerciseHistory([row('s1', 1, '40.00', 10)]),
        )
        expect(deltaKg).toBeNull()
        expect(best?.set.weight).toBe(40)
        expect(last?.sessionId).toBe('s1')
    })

    it('sem histórico devolve tudo vazio', () => {
        const summary = summarizeExerciseHistory([])
        expect(summary).toMatchObject({ sessions: [], best: null, last: null, deltaKg: null })
    })
})
