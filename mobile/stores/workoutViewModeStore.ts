/**
 * workoutViewModeStore — preferência de modo de execução de treino do aluno.
 *
 *   - 'lista' (Lista completa): todos os exercícios visíveis; só o atual expandido.
 *   - 'foco'  (Um por vez): um exercício por vez, com player de vídeo.
 *
 * Default: 'lista' (comportamento consolidado). É preferência de UI local por
 * device — persiste via MMKV (in-memory fallback em Expo Go). Não vai ao banco
 * (a tabela `students` não tem coluna de preferência de UI). Espelha o padrão de
 * themePreferenceStore.
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

let storageBackend: StateStorage;

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-workout-viewmode' });
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

export type WorkoutViewMode = 'lista' | 'foco';

interface WorkoutViewModeState {
    mode: WorkoutViewMode;
    setMode: (mode: WorkoutViewMode) => void;
}

export const useWorkoutViewModeStore = create<WorkoutViewModeState>()(
    persist(
        (set) => ({
            mode: 'lista',
            setMode: (mode) => set({ mode }),
        }),
        {
            name: 'workout-view-mode',
            storage: createJSONStorage(() => storageBackend),
        },
    ),
);
