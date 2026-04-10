// Cache storage adapter with MMKV (matching training-room-store pattern)

interface CacheStorage {
    getString: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
    getAllKeys: () => string[];
    clearAll: () => void;
}

let cacheStorage: CacheStorage | null = null;

try {
    const { createMMKV } = require("react-native-mmkv");
    cacheStorage = createMMKV({ id: "kinevo-cache" }) as CacheStorage;
} catch {
    // MMKV not available (e.g. Expo Go) — cache functions become no-ops
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export function getCached<T>(key: string): { data: T; timestamp: number } | null {
    try {
        const raw = cacheStorage?.getString(key);
        if (!raw) return null;
        return JSON.parse(raw) as CacheEntry<T>;
    } catch {
        return null;
    }
}

export function setCache<T>(key: string, data: T): void {
    try {
        const entry: CacheEntry<T> = { data, timestamp: Date.now() };
        cacheStorage?.set(key, JSON.stringify(entry));
    } catch {
        // silently fail
    }
}

export function invalidateCache(key: string): void {
    try {
        cacheStorage?.delete(key);
    } catch {
        // silently fail
    }
}

export function invalidateByPrefix(prefix: string): void {
    try {
        const allKeys = cacheStorage?.getAllKeys() ?? [];
        for (const k of allKeys) {
            if (k.startsWith(prefix)) {
                cacheStorage?.delete(k);
            }
        }
    } catch {
        // silently fail
    }
}

export function clearAllCache(): void {
    try {
        cacheStorage?.clearAll();
    } catch {
        // silently fail
    }
}
