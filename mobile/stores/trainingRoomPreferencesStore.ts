/**
 * trainingRoomPreferencesStore — preferências da Sala de Treino do treinador.
 *
 * São preferências de ESTILO DE TRABALHO do treinador, globais e por dispositivo
 * (não um atributo do aluno — a Sala roda vários alunos ao mesmo tempo). Ficam
 * separadas do `training-room-store` (que guarda estado efêmero de sessão e é
 * mantido em paridade com a web). Espelha themePreferenceStore/workoutViewModeStore.
 *
 * - restTimerAuto: inicia o timer de descanso ao concluir cada série (default true;
 *   preserva o comportamento atual). Treinadores que lançam cargas/reps de uma vez
 *   desligam para não ver o overlay a cada série.
 * - defaultRestSeconds: descanso usado quando o exercício não tem descanso prescrito
 *   (substitui o antigo fallback fixo de 60s). Default 60.
 *
 * Persiste via MMKV (in-memory fallback em Expo Go).
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-training-room-prefs' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => {
            mmkv.remove(name);
        },
    };
} catch {
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => {
            memoryStore.set(name, value);
        },
        removeItem: (name: string) => {
            memoryStore.delete(name);
        },
    };
}

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 300;
export const REST_STEP_SECONDS = 15;
export const DEFAULT_REST_SECONDS = 60;

interface TrainingRoomPreferencesState {
    restTimerAuto: boolean;
    defaultRestSeconds: number;
    setRestTimerAuto: (enabled: boolean) => void;
    setDefaultRestSeconds: (seconds: number) => void;
}

export const useTrainingRoomPreferencesStore = create<TrainingRoomPreferencesState>()(
    persist(
        (set) => ({
            restTimerAuto: true,
            defaultRestSeconds: DEFAULT_REST_SECONDS,
            setRestTimerAuto: (enabled: boolean) => set({ restTimerAuto: enabled }),
            setDefaultRestSeconds: (seconds: number) =>
                set({ defaultRestSeconds: Math.max(MIN_REST_SECONDS, Math.min(MAX_REST_SECONDS, seconds)) }),
        }),
        {
            name: 'training-room-preferences',
            storage: createJSONStorage(() => storageBackend),
        },
    ),
);
