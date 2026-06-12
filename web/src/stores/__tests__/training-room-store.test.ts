// Testes do store da Sala de Treino — foco na revalidação de snapshot
// (refreshSessionData) e no GC de sessões nunca iniciadas, raiz do bug de
// divergência treinador×aluno reportado em jun/2026 (snapshot eterno no
// localStorage + edições do programa nunca chegando à sala).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
    useTrainingRoomStore,
    type ExerciseData,
    type SessionSetupData,
} from '../training-room-store'

function makeExercise(id: string, over: Partial<ExerciseData> = {}): ExerciseData {
    return {
        id,
        item_type: 'exercise',
        planned_exercise_id: `ex-${id}`,
        exercise_id: `ex-${id}`,
        name: `Exercício ${id}`,
        sets: 3,
        reps: '8-12',
        rest_seconds: 60,
        substitute_exercise_ids: [],
        swap_source: 'none',
        setsData: Array.from({ length: over.sets ?? 3 }, () => ({ weight: '', reps: '', completed: false })),
        order_index: 0,
        setScheme: [],
        ...over,
    }
}

function makeSetup(over: Partial<SessionSetupData> = {}): SessionSetupData {
    return {
        studentName: 'Leo',
        studentAvatarUrl: null,
        assignedWorkoutId: 'workout-1',
        assignedProgramId: 'prog-1',
        trainerId: 'trainer-1',
        workoutName: 'Treino A',
        exercises: [makeExercise('item-1')],
        workoutNotes: [],
        ...over,
    }
}

function reset() {
    useTrainingRoomStore.setState({ sessions: {}, activeStudentId: null })
}

beforeEach(() => {
    reset()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('addStudent', () => {
    it('registra addedAt (base do GC para sessões nunca iniciadas)', () => {
        useTrainingRoomStore.getState().addStudent('s1', makeSetup())
        const session = useTrainingRoomStore.getState().sessions['s1']
        expect(session.status).toBe('ready')
        expect(session.startedAt).toBeNull()
        expect(typeof session.addedAt).toBe('number')
    })
})

describe('refreshSessionData', () => {
    it("sessão 'ready' substitui a prescrição inteira (snapshot velho morre)", () => {
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup())

        store.refreshSessionData('s1', {
            workoutName: 'Treino A v2',
            exercises: [
                makeExercise('item-1', { reps: '10', rest_seconds: 30 }),
                makeExercise('item-warmup', { item_type: 'warmup', name: 'Esteira', sets: 0, setsData: [] }),
            ],
            workoutNotes: [{ id: 'n1', notes: 'foco na cadência', order_index: 0 }],
        })

        const session = useTrainingRoomStore.getState().sessions['s1']
        expect(session.workoutName).toBe('Treino A v2')
        expect(session.exercises).toHaveLength(2)
        expect(session.exercises[0].reps).toBe('10')
        expect(session.exercises[0].rest_seconds).toBe(30)
        // S2 do relato: aquecimento adicionado pelo editor agora aparece na sala
        expect(session.exercises[1].item_type).toBe('warmup')
        expect(session.workoutNotes).toHaveLength(1)
    })

    it('em andamento: prescrição nova vence, progresso é preservado por item', () => {
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup())
        store.startWorkout('s1')
        store.updateSet('s1', 0, 0, 'weight', '50')
        store.toggleSetComplete('s1', 0, 0)

        store.refreshSessionData('s1', {
            workoutName: 'Treino A',
            exercises: [makeExercise('item-1', { reps: '6-8', rest_seconds: 90 })],
            workoutNotes: [],
        })

        const ex = useTrainingRoomStore.getState().sessions['s1'].exercises[0]
        expect(ex.reps).toBe('6-8') // prescrição nova
        expect(ex.rest_seconds).toBe(90)
        expect(ex.setsData[0]).toMatchObject({ weight: '50', completed: true }) // progresso vivo
    })

    it('redimensiona o progresso quando o nº de séries muda (mantém N primeiras, completa vazias)', () => {
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup())
        store.startWorkout('s1')
        store.updateSet('s1', 0, 0, 'weight', '50')
        store.toggleSetComplete('s1', 0, 0)

        store.refreshSessionData('s1', {
            workoutName: 'Treino A',
            exercises: [makeExercise('item-1', { sets: 5 })],
            workoutNotes: [],
        })

        const sets = useTrainingRoomStore.getState().sessions['s1'].exercises[0].setsData
        expect(sets).toHaveLength(5)
        expect(sets[0]).toMatchObject({ weight: '50', completed: true })
        expect(sets[4]).toMatchObject({ weight: '', completed: false })
    })

    it('troca feita ao vivo na sala sobrevive ao refresh', () => {
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup())
        store.startWorkout('s1')
        store.swapExercise('s1', 0, { id: 'ex-substituto', name: 'Crucifixo', source: 'manual' }, '40kg')

        store.refreshSessionData('s1', {
            workoutName: 'Treino A',
            exercises: [makeExercise('item-1', { rest_seconds: 45 })],
            workoutNotes: [],
        })

        const ex = useTrainingRoomStore.getState().sessions['s1'].exercises[0]
        expect(ex.exercise_id).toBe('ex-substituto')
        expect(ex.name).toBe('Crucifixo')
        expect(ex.swap_source).toBe('manual')
        expect(ex.rest_seconds).toBe(45) // prescrição nova ainda entra
    })

    it('item removido do programa some, exceto se já tem série concluída na sala', () => {
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup({
            exercises: [makeExercise('item-1'), makeExercise('item-2')],
        }))
        store.startWorkout('s1')
        store.toggleSetComplete('s1', 1, 0) // concluiu série do item-2

        store.refreshSessionData('s1', {
            workoutName: 'Treino A',
            exercises: [makeExercise('item-1')], // editor removeu item-2
            workoutNotes: [],
        })

        const ids = useTrainingRoomStore.getState().sessions['s1'].exercises.map((e) => e.id)
        expect(ids).toEqual(['item-1', 'item-2']) // item-2 fica (trabalho registrado)

        // …mas um item removido SEM progresso some de verdade
        store.refreshSessionData('s1', {
            workoutName: 'Treino A',
            exercises: [makeExercise('item-1'), makeExercise('item-3')],
            workoutNotes: [],
        })
        const ids2 = useTrainingRoomStore.getState().sessions['s1'].exercises.map((e) => e.id)
        expect(ids2).toContain('item-3')
    })

    it('é no-op para aluno que não está na sala', () => {
        useTrainingRoomStore.getState().refreshSessionData('fantasma', {
            workoutName: 'X', exercises: [], workoutNotes: [],
        })
        expect(useTrainingRoomStore.getState().sessions).toEqual({})
    })
})

describe('clearExpiredSessions', () => {
    it("expira sessões 'ready' velhas pelo addedAt (antes nunca expiravam)", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-10T08:00:00Z'))
        useTrainingRoomStore.getState().addStudent('s1', makeSetup())

        vi.setSystemTime(new Date('2026-06-11T09:00:00Z')) // 25h depois
        useTrainingRoomStore.getState().addStudent('s2', makeSetup({ studentName: 'Novo' }))
        useTrainingRoomStore.getState().clearExpiredSessions()

        const sessions = useTrainingRoomStore.getState().sessions
        expect(sessions['s1']).toBeUndefined()
        expect(sessions['s2']).toBeDefined()
    })

    it('mantém sessão iniciada há menos de 24h', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-11T08:00:00Z'))
        const store = useTrainingRoomStore.getState()
        store.addStudent('s1', makeSetup())
        store.startWorkout('s1')

        vi.setSystemTime(new Date('2026-06-11T20:00:00Z')) // 12h
        store.clearExpiredSessions()
        expect(useTrainingRoomStore.getState().sessions['s1']).toBeDefined()
    })
})
