// ============================================================================
// useWallet — status/summary da Carteira Asaas do trainer
// ============================================================================
// GET /api/wallet/status → KinevoWalletSummary (status KYC, mode, flags).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import type { KinevoWalletSummary } from "@kinevo/shared/types/asaas";
import { walletFetch } from "../lib/wallet-api";

export function useWallet() {
    const [summary, setSummary] = useState<KinevoWalletSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async (refreshing = false) => {
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const data = await walletFetch<KinevoWalletSummary>("/api/wallet/status");
            setSummary(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar carteira");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { summary, isLoading, isRefreshing, error, refresh: () => fetchStatus(true) };
}
