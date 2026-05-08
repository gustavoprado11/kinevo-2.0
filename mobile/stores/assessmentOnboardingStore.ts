import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------
// Same pattern used by mobile/stores/assessmentDraftStore.ts and
// mobile/stores/training-room-store.ts. Namespaced under
// `kinevo-assessment-onboarding`.

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-assessment-onboarding' });
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

interface AssessmentOnboardingState {
    tourSeen: boolean;
    markTourSeen: () => void;
}

export const useAssessmentOnboardingStore = create<AssessmentOnboardingState>()(
    persist(
        (set) => ({
            tourSeen: false,
            markTourSeen: () => set({ tourSeen: true }),
        }),
        {
            name: 'kinevo-assessment-tour-seen',
            storage: createJSONStorage(() => storageBackend),
            version: 1,
        },
    ),
);
