import { describe, expect, it } from 'vitest'
import {
    generateCalendarDays,
    getScheduledWorkoutsForDate,
    type ScheduledWorkoutRef,
    type SessionRef,
} from '../schedule-projection'

// Dual-day força+aeróbio: dois treinos agendados no MESMO dia. Antes do status
// 'partial', qualquer sessão concluída marcava o dia como 'done' e o treino
// que faltou sumia da cobrança do calendário.

const FORCA: ScheduledWorkoutRef = {
    id: 'w-forca',
    name: 'Upper A',
    scheduled_days: [2], // terça
    workout_type: 'strength',
}
const CARDIO: ScheduledWorkoutRef = {
    id: 'w-cardio',
    name: 'Corrida Fácil',
    scheduled_days: [2], // terça — mesmo dia
    workout_type: 'cardio',
}
const SOLO: ScheduledWorkoutRef = {
    id: 'w-solo',
    name: 'Lower A',
    scheduled_days: [4], // quinta
}

// Terça-feira passada fixa (2026-07-14 é terça) num programa iniciado antes.
const PROGRAM_START = '2026-07-06T00:00:00.000Z'
const TUESDAY = new Date(2026, 6, 14)

function session(workoutId: string, n: number): SessionRef {
    return {
        id: `s-${workoutId}-${n}`,
        assigned_workout_id: workoutId,
        started_at: new Date(2026, 6, 14, 8 + n).toISOString(),
        completed_at: new Date(2026, 6, 14, 9 + n).toISOString(),
        status: 'completed',
    }
}

function dayFor(sessions: SessionRef[], workouts = [FORCA, CARDIO, SOLO]) {
    const days = generateCalendarDays(TUESDAY, TUESDAY, workouts, sessions, PROGRAM_START, 8)
    return days[0]
}

describe('generateCalendarDays — status partial (dual-day)', () => {
    it('2 agendados + 1 concluído → partial (o segundo treino segue cobrado)', () => {
        const day = dayFor([session('w-forca', 1)])
        expect(day.scheduledWorkouts).toHaveLength(2)
        expect(day.status).toBe('partial')
    })

    it('2 agendados + os 2 concluídos → done', () => {
        const day = dayFor([session('w-forca', 1), session('w-cardio', 2)])
        expect(day.status).toBe('done')
    })

    it('2 agendados + 2 sessões do MESMO treino → done (aluno trocou o treino, contagem cobre)', () => {
        const day = dayFor([session('w-forca', 1), session('w-forca', 2)])
        expect(day.status).toBe('done')
    })

    it('1 agendado + 1 concluído → done (comportamento antigo preservado)', () => {
        const days = generateCalendarDays(
            new Date(2026, 6, 16), // quinta
            new Date(2026, 6, 16),
            [FORCA, CARDIO, SOLO],
            [{
                id: 's-solo',
                assigned_workout_id: 'w-solo',
                started_at: new Date(2026, 6, 16, 8).toISOString(),
                completed_at: new Date(2026, 6, 16, 9).toISOString(),
                status: 'completed',
            }],
            PROGRAM_START,
            8,
        )
        expect(days[0].scheduledWorkouts).toHaveLength(1)
        expect(days[0].status).toBe('done')
    })

    it('sessão em dia SEM agendados → done (treino extra não vira partial)', () => {
        const days = generateCalendarDays(
            new Date(2026, 6, 15), // quarta — nada agendado
            new Date(2026, 6, 15),
            [FORCA, CARDIO, SOLO],
            [{
                id: 's-extra',
                assigned_workout_id: 'w-forca',
                started_at: new Date(2026, 6, 15, 8).toISOString(),
                completed_at: new Date(2026, 6, 15, 9).toISOString(),
                status: 'completed',
            }],
            PROGRAM_START,
            8,
        )
        expect(days[0].status).toBe('done')
    })
})

describe('getScheduledWorkoutsForDate — workout_type na projeção', () => {
    it('propaga o tipo (antes descartava — cardio ficava indistinguível)', () => {
        const scheduled = getScheduledWorkoutsForDate(TUESDAY, [FORCA, CARDIO, SOLO], PROGRAM_START, 8)
        expect(scheduled).toEqual([
            { id: 'w-forca', name: 'Upper A', workout_type: 'strength' },
            { id: 'w-cardio', name: 'Corrida Fácil', workout_type: 'cardio' },
        ])
    })

    it('sem workout_type no ref → normaliza pra strength', () => {
        const thursday = new Date(2026, 6, 16)
        const scheduled = getScheduledWorkoutsForDate(thursday, [SOLO], PROGRAM_START, 8)
        expect(scheduled[0].workout_type).toBe('strength')
    })
})
