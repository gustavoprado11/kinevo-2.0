// ─────────────────────────────────────────────────────────────────────────────
// Persistência local do estado do player de treino (espelho, no telefone, do
// WorkoutStatePersistence.swift do Watch). Sem isto, kill do app no meio do
// treino perdia tudo que não tinha sido persistido no banco: pesos/reps
// digitados sem marcar, séries marcadas offline (persistSetLog falhou),
// exercícios trocados (swap) e cardio concluído.
//
// A rehidratação do banco (A2 do useWorkoutSession) cobre as séries que
// CHEGARAM ao Supabase; este snapshot cobre o resto. Precedência na restauração:
// banco ganha para séries completed; o snapshot preenche o restante.
// ─────────────────────────────────────────────────────────────────────────────

interface PersistedSetData {
    weight: string;
    reps: string;
    completed: boolean;
}

export interface PersistedExerciseState {
    /** assigned_workout_item_id — chave de matching na restauração */
    id: string;
    exercise_id: string;
    name: string;
    video_url?: string;
    swap_source: 'none' | 'manual' | 'auto';
    setsData: PersistedSetData[];
    item_config?: Record<string, any>;
}

export interface PersistedWorkoutState {
    sessionId: string | null;
    savedAt: string;
    exercises: PersistedExerciseState[];
}

// Storage — MMKV com fallback in-memory (mesmo padrão do training-room-store;
// o fallback cobre Expo Go, onde o módulo nativo não existe).
interface StorageLike {
    getString(key: string): string | undefined;
    set(key: string, value: string): void;
    remove(key: string): void;
}

let storage: StorageLike;
try {
    const { createMMKV } = require('react-native-mmkv');
    storage = createMMKV({ id: 'kinevo-workout-state' });
} catch {
    const memoryStore = new Map<string, string>();
    storage = {
        getString: (key: string) => memoryStore.get(key),
        set: (key: string, value: string) => { memoryStore.set(key, value); },
        remove: (key: string) => { memoryStore.delete(key); },
    };
}

const keyFor = (workoutId: string) => `workout_state_${workoutId}`;

// Snapshots mais velhos que isto são lixo (espelha o cleanup server-side de
// sessões in_progress >24h no _layout.tsx).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveWorkoutState(workoutId: string, state: PersistedWorkoutState): void {
    try {
        storage.set(keyFor(workoutId), JSON.stringify(state));
    } catch (e: any) {
        if (__DEV__) console.warn(`[workoutStatePersistence] save failed: ${e?.message}`);
    }
}

export function loadWorkoutState(workoutId: string): PersistedWorkoutState | null {
    try {
        const raw = storage.getString(keyFor(workoutId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedWorkoutState;
        if (!parsed || !Array.isArray(parsed.exercises)) return null;
        const age = Date.now() - Date.parse(parsed.savedAt);
        if (!Number.isFinite(age) || age > MAX_AGE_MS) {
            clearWorkoutState(workoutId);
            return null;
        }
        return parsed;
    } catch (e: any) {
        if (__DEV__) console.warn(`[workoutStatePersistence] load failed: ${e?.message}`);
        return null;
    }
}

export function clearWorkoutState(workoutId: string): void {
    try {
        storage.remove(keyFor(workoutId));
    } catch (e: any) {
        if (__DEV__) console.warn(`[workoutStatePersistence] clear failed: ${e?.message}`);
    }
}
