import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------
// Pattern espelhado de assessmentDraftStore.ts e assessmentOnboardingStore.ts.
// Namespaced em `kinevo-forms-tab-state`.

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-forms-tab-state' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => { mmkv.remove(name); },
    };
} catch {
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => { memoryStore.set(name, value); },
        removeItem: (name: string) => { memoryStore.delete(name); },
    };
}

export type FormsSegment = 'formularios' | 'avaliacoes';

interface FormsTabState {
    /** Segmento ativo no topo da tela (Formulários | Avaliações).
     *  Persiste entre sessões para preservar contexto do trainer. */
    activeSegment: FormsSegment;
    setActiveSegment: (segment: FormsSegment) => void;

    /** Banner in-app de reorganização (M11). Aparece na primeira visita
     *  pós-deploy; desaparece definitivamente quando trainer toca "Entendi". */
    migrationBannerSeen: boolean;
    markMigrationBannerSeen: () => void;
}

export const useFormsTabStateStore = create<FormsTabState>()(
    persist(
        (set) => ({
            activeSegment: 'formularios',
            setActiveSegment: (segment) => set({ activeSegment: segment }),

            migrationBannerSeen: false,
            markMigrationBannerSeen: () => set({ migrationBannerSeen: true }),
        }),
        {
            name: 'kinevo-forms-tab-state',
            storage: createJSONStorage(() => storageBackend),
            version: 1,
        },
    ),
);
