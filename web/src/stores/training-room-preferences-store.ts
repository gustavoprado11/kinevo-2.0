/**
 * Preferências da Sala de Treino do treinador (web).
 *
 * São preferências de ESTILO DE TRABALHO do treinador, globais e por dispositivo
 * (não um atributo do aluno — a Sala roda vários alunos ao mesmo tempo). Ficam
 * separadas do `training-room-store`, que guarda estado efêmero de sessão.
 * Espelha o `trainingRoomPreferencesStore` do mobile (MMKV lá, localStorage aqui);
 * as preferências NÃO sincronizam entre os dois — cada dispositivo tem as suas.
 *
 * - restTimerAuto: inicia o timer de descanso ao concluir cada série (default true;
 *   preserva o comportamento atual). Treinadores que lançam cargas/reps de um
 *   exercício de uma vez só desligam para não ver o overlay a cada série.
 * - defaultRestSeconds: descanso usado quando o exercício não tem descanso prescrito.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MIN_REST_SECONDS = 15
export const MAX_REST_SECONDS = 300
export const REST_STEP_SECONDS = 15
export const DEFAULT_REST_SECONDS = 60

export interface TrainingRoomPreferences {
    restTimerAuto: boolean
    defaultRestSeconds: number
}

interface TrainingRoomPreferencesState extends TrainingRoomPreferences {
    setRestTimerAuto: (enabled: boolean) => void
    setDefaultRestSeconds: (seconds: number) => void
}

export const useTrainingRoomPreferencesStore = create<TrainingRoomPreferencesState>()(
    persist(
        (set) => ({
            restTimerAuto: true,
            defaultRestSeconds: DEFAULT_REST_SECONDS,

            setRestTimerAuto: (enabled) => set({ restTimerAuto: enabled }),

            setDefaultRestSeconds: (seconds) =>
                set({
                    defaultRestSeconds: Math.max(
                        MIN_REST_SECONDS,
                        Math.min(MAX_REST_SECONDS, seconds),
                    ),
                }),
        }),
        {
            name: 'kinevo-training-room-prefs',
            partialize: (state) => ({
                restTimerAuto: state.restTimerAuto,
                defaultRestSeconds: state.defaultRestSeconds,
            }),
        },
    ),
)
