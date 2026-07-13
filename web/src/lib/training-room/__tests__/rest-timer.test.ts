// Regras do timer de descanso da Sala de Treino. O ponto sensível é o descanso
// por série: 0 numa linha de assigned_workout_item_sets é "sem descanso por
// design" (drop-set, cluster) e NUNCA pode cair no padrão do treinador.

import { describe, it, expect } from 'vitest'
import { resolveRestSeconds, displayRestSeconds } from '../rest-timer'
import type { ExerciseData } from '@/stores/training-room-store'
import type { SetPrescription } from '@kinevo/shared/lib/hydrate-workout-sets'

const PREFS = { restTimerAuto: true, defaultRestSeconds: 90 }

type RestTimerExercise = Pick<ExerciseData, 'setsData' | 'setScheme' | 'rest_seconds'>

function makeExercise(over: Partial<RestTimerExercise> = {}): RestTimerExercise {
    return {
        rest_seconds: 60,
        setsData: [
            { weight: '', reps: '', completed: false },
            { weight: '', reps: '', completed: false },
            { weight: '', reps: '', completed: false },
        ],
        setScheme: [],
        ...over,
    }
}

function makeSetScheme(restPerSet: number[]): SetPrescription[] {
    return restPerSet.map((rest, i) => ({
        set_number: i + 1,
        set_type: 'normal',
        reps_target: '10',
        rest_seconds: rest,
        weight_target_kg: null,
        weight_target_pct1rm: null,
        rir: null,
        tempo: null,
        notes: null,
        round_number: null,
    }))
}

describe('resolveRestSeconds', () => {
    it('usa o descanso do exercício ao concluir uma série', () => {
        expect(resolveRestSeconds(makeExercise(), 0, PREFS)).toBe(60)
    })

    it('não dispara quando o treinador desligou o timer automático', () => {
        const prefs = { ...PREFS, restTimerAuto: false }
        expect(resolveRestSeconds(makeExercise(), 0, prefs)).toBeNull()
    })

    it('não dispara ao DESmarcar uma série já concluída', () => {
        const exercise = makeExercise({
            setsData: [
                { weight: '80', reps: '10', completed: true },
                { weight: '', reps: '', completed: false },
                { weight: '', reps: '', completed: false },
            ],
        })
        expect(resolveRestSeconds(exercise, 0, PREFS)).toBeNull()
    })

    it('não dispara na última série pendente do exercício', () => {
        const exercise = makeExercise({
            setsData: [
                { weight: '80', reps: '10', completed: true },
                { weight: '80', reps: '10', completed: true },
                { weight: '80', reps: '10', completed: false },
            ],
        })
        expect(resolveRestSeconds(exercise, 2, PREFS)).toBeNull()
    })

    it('dispara em série do meio mesmo com séries anteriores já concluídas', () => {
        const exercise = makeExercise({
            setsData: [
                { weight: '80', reps: '10', completed: true },
                { weight: '80', reps: '10', completed: false },
                { weight: '80', reps: '10', completed: false },
            ],
        })
        expect(resolveRestSeconds(exercise, 1, PREFS)).toBe(60)
    })

    it('descanso por série vence o agregado do exercício', () => {
        const exercise = makeExercise({ rest_seconds: 60, setScheme: makeSetScheme([120, 45, 30]) })
        expect(resolveRestSeconds(exercise, 0, PREFS)).toBe(120)
        expect(resolveRestSeconds(exercise, 1, PREFS)).toBe(45)
    })

    it('descanso 0 por série significa "sem descanso" — não cai no padrão', () => {
        const exercise = makeExercise({ rest_seconds: 0, setScheme: makeSetScheme([0, 0, 90]) })
        expect(resolveRestSeconds(exercise, 0, PREFS)).toBeNull()
        expect(resolveRestSeconds(exercise, 1, PREFS)).toBeNull()
    })

    it('exercício sem descanso prescrito usa a duração padrão do treinador', () => {
        const exercise = makeExercise({ rest_seconds: 0 })
        expect(resolveRestSeconds(exercise, 0, PREFS)).toBe(90)
    })

    it('exercício inexistente não quebra', () => {
        expect(resolveRestSeconds(undefined, 0, PREFS)).toBeNull()
        expect(resolveRestSeconds(makeExercise(), 99, PREFS)).toBeNull()
    })
})

describe('displayRestSeconds', () => {
    it('mostra o descanso prescrito quando existe', () => {
        expect(displayRestSeconds(45, { defaultRestSeconds: 90 })).toBe(45)
    })

    it('mostra a duração padrão quando o exercício não tem descanso', () => {
        expect(displayRestSeconds(0, { defaultRestSeconds: 90 })).toBe(90)
    })
})
