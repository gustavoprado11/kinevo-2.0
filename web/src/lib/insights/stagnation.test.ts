import { describe, it, expect } from 'vitest'
import { evaluateStagnation, type WeeklyLift } from './stagnation'

// Helper: 4 semanas no mesmo topo, reps estáveis → estagnação clássica.
function weeks(maxWeight: number, repsPerWeek: number[]): WeeklyLift[] {
    return repsPerWeek.map((r, i) => ({
        weekStart: `2026-05-${String(4 + i * 7).padStart(2, '0')}`,
        maxWeight,
        bestRepsAtMax: r,
    }))
}

describe('evaluateStagnation', () => {
    it('marca estagnação: carga no topo por 4 semanas e reps estáveis', () => {
        const v = evaluateStagnation({ weeks: weeks(52, [13, 13, 13, 13]), totalSessions: 6 })
        expect(v).not.toBeNull()
        expect(v!.topWeight).toBe(52)
        expect(v!.weeksAtTop).toBe(4)
    })

    it('NÃO marca quando as reps progridem na mesma carga (Crucifixo 10→14)', () => {
        const v = evaluateStagnation({ weeks: weeks(35, [10, 11, 12, 14]), totalSessions: 8 })
        expect(v).toBeNull()
    })

    it('marca quando as reps caem ou ficam iguais (não houve progresso)', () => {
        expect(evaluateStagnation({ weeks: weeks(60, [10, 9, 9, 8]), totalSessions: 6 })).not.toBeNull()
        expect(evaluateStagnation({ weeks: weeks(60, [10, 12, 9, 10]), totalSessions: 6 })).not.toBeNull()
    })

    it('NÃO marca com menos de 4 semanas', () => {
        expect(evaluateStagnation({ weeks: weeks(50, [12, 12, 12]), totalSessions: 6 })).toBeNull()
    })

    it('NÃO marca com amostra pequena (menos de 4 sessões)', () => {
        expect(evaluateStagnation({ weeks: weeks(50, [12, 12, 12, 12]), totalSessions: 3 })).toBeNull()
    })

    it('NÃO marca acessório de carga baixa (< 10kg)', () => {
        expect(evaluateStagnation({ weeks: weeks(4, [12, 12, 12, 12]), totalSessions: 8 })).toBeNull()
    })

    it('exige semanas CONSECUTIVAS no topo (run < 4 não dispara)', () => {
        // topo=100 aparece em 3 das últimas, mas a mais recente quebra o run
        const w: WeeklyLift[] = [
            { weekStart: '2026-05-04', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-11', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-18', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-25', maxWeight: 90, bestRepsAtMax: 8 }, // quebra o run recente
        ]
        expect(evaluateStagnation({ weeks: w, totalSessions: 8 })).toBeNull()
    })

    it('conta o run consecutivo a partir da semana mais recente', () => {
        // wave: 80,100,100,100,100 → run recente = 4 no topo 100
        const w: WeeklyLift[] = [
            { weekStart: '2026-05-01', maxWeight: 80, bestRepsAtMax: 10 },
            { weekStart: '2026-05-08', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-15', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-22', maxWeight: 100, bestRepsAtMax: 8 },
            { weekStart: '2026-05-29', maxWeight: 100, bestRepsAtMax: 8 },
        ]
        const v = evaluateStagnation({ weeks: w, totalSessions: 8 })
        expect(v).not.toBeNull()
        expect(v!.weeksAtTop).toBe(4)
    })

    it('NÃO marca quando >= 70% das séries recentes estão no topo do range (ready_to_progress)', () => {
        const v = evaluateStagnation({
            weeks: weeks(50, [12, 12, 12, 12]),
            totalSessions: 6,
            recentRepsAtTop: [
                { repsCompleted: 12, maxPrescribed: 12 },
                { repsCompleted: 12, maxPrescribed: 12 },
                { repsCompleted: 12, maxPrescribed: 12 },
                { repsCompleted: 11, maxPrescribed: 12 },
            ],
        })
        expect(v).toBeNull()
    })

    it('marca mesmo com recentRepsAtTop se a maioria NÃO está no topo do range', () => {
        const v = evaluateStagnation({
            weeks: weeks(50, [9, 9, 9, 9]),
            totalSessions: 6,
            recentRepsAtTop: [
                { repsCompleted: 8, maxPrescribed: 12 },
                { repsCompleted: 9, maxPrescribed: 12 },
                { repsCompleted: 9, maxPrescribed: 12 },
            ],
        })
        expect(v).not.toBeNull()
    })
})
