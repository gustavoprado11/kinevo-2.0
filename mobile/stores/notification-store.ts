import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-notifications' });
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationStore {
    unreadCount: number;
    lastSeenAt: string | null;
    setUnreadCount: (count: number) => void;
    incrementUnread: () => void;
    resetUnread: () => void;
    setLastSeen: (date: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationStore = create<NotificationStore>()(
    persist(
        (set) => ({
            unreadCount: 0,
            lastSeenAt: null,

            setUnreadCount: (count: number) => set({ unreadCount: count }),
            incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
            resetUnread: () => set({ unreadCount: 0 }),
            setLastSeen: (date: string) => set({ lastSeenAt: date }),
        }),
        {
            name: 'kinevo-notifications',
            storage: createJSONStorage(() => storageBackend),
        }
    )
);
