/**
 * themePreferenceStore — preferência de tema (Light/Dark/Sistema).
 *
 * Default: 'system' (segue iOS Display & Brightness).
 * Persiste via MMKV (in-memory fallback em Expo Go).
 */
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-theme-preference' });
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

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemePreferenceState {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
}

export const useThemePreferenceStore = create<ThemePreferenceState>()(
    persist(
        (set) => ({
            mode: 'system',
            setMode: (mode) => set({ mode }),
        }),
        {
            name: 'theme-preference',
            storage: createJSONStorage(() => storageBackend),
        },
    ),
);
