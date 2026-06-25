/**
 * assistantModeStore — modo da Home do treinador (Clássico / Assistente).
 *
 * Espelha a flag `trainers.home_style` do web (migration 210): o treinador
 * Pro+ pode alternar a Home entre o dashboard clássico e o dashboard do
 * Assistente. Persistido localmente via MMKV para resposta instantânea; a
 * sincronização com o servidor (`home_style` + set-home-style) entra na Fase 2.
 *
 * Default: 'classic'. Persiste via MMKV (fallback in-memory em Expo Go).
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-assistant-mode' });
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

export type AssistantMode = 'classic' | 'assistant';

interface AssistantModeState {
    mode: AssistantMode;
    setMode: (mode: AssistantMode) => void;
    toggle: () => void;
}

export const useAssistantModeStore = create<AssistantModeState>()(
    persist(
        (set, get) => ({
            mode: 'classic',
            setMode: (mode) => set({ mode }),
            toggle: () => set({ mode: get().mode === 'assistant' ? 'classic' : 'assistant' }),
        }),
        {
            name: 'assistant-mode',
            storage: createJSONStorage(() => storageBackend),
        },
    ),
);
