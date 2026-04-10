import { useState, useEffect, useCallback, useRef } from "react";
import { getCached, setCache } from "../lib/cache";
import { useNetworkStatus } from "./useNetworkStatus";

interface UseCachedQueryOptions<T> {
    cacheKey: string;
    fetcher: () => Promise<T>;
    ttl?: number;
    enabled?: boolean;
}

interface UseCachedQueryReturn<T> {
    data: T | null;
    isLoading: boolean;
    isRefreshing: boolean;
    isStale: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useCachedQuery<T>({
    cacheKey,
    fetcher,
    ttl = 5 * 60 * 1000,
    enabled = true,
}: UseCachedQueryOptions<T>): UseCachedQueryReturn<T> {
    const [data, setData] = useState<T | null>(() => {
        // Synchronous initial read from cache for instant render
        if (!enabled) return null;
        const cached = getCached<T>(cacheKey);
        return cached?.data ?? null;
    });
    const [isLoading, setIsLoading] = useState(() => {
        if (!enabled) return false;
        const cached = getCached<T>(cacheKey);
        return !cached;
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isConnected } = useNetworkStatus();
    const mountedRef = useRef(true);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchAndCache = useCallback(async () => {
        try {
            const freshData = await fetcherRef.current();
            if (!mountedRef.current) return;
            setData(freshData);
            setCache(cacheKey, freshData);
            setError(null);
        } catch (err: unknown) {
            if (!mountedRef.current) return;
            const message = err instanceof Error ? err.message : "Erro ao buscar dados";
            setError(message);
            if (__DEV__) console.error(`[useCachedQuery:${cacheKey}]`, err);
        }
    }, [cacheKey]);

    // Initial load + stale-while-revalidate
    useEffect(() => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }

        const cached = getCached<T>(cacheKey);

        if (cached) {
            setData(cached.data);
            setIsLoading(false);

            // Always revalidate in background when connected
            if (isConnected !== false) {
                const age = Date.now() - cached.timestamp;
                setIsStale(age >= ttl);
                setIsRefreshing(true);
                fetchAndCache().finally(() => {
                    if (mountedRef.current) {
                        setIsRefreshing(false);
                        setIsStale(false);
                    }
                });
            }
        } else if (isConnected !== false) {
            // No cache — must fetch
            setIsLoading(true);
            fetchAndCache().finally(() => {
                if (mountedRef.current) setIsLoading(false);
            });
        } else {
            // Offline, no cache
            setIsLoading(false);
            setError("Sem conexão e sem dados salvos");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey, enabled]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchAndCache();
        if (mountedRef.current) setIsRefreshing(false);
    }, [fetchAndCache]);

    return { data, isLoading, isRefreshing, isStale, error, refresh };
}
