// ============================================================================
// useWalletBalance — saldo da subconta Asaas do trainer
// ============================================================================
// GET /api/wallet/balance → AsaasBalance { balance, totalBalance? }.
// `balance` = saldo já liberado (sacável). `totalBalance` = total (inclui a
// liberar). Pendente = totalBalance - balance.
//
// `enabled` evita chamar quando a carteira ainda não está aprovada (o endpoint
// retorna 409 nesse caso).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import type { AsaasBalance } from "@kinevo/shared/types/asaas";
import { walletFetch } from "../lib/wallet-api";

export function useWalletBalance(enabled = true) {
    const [balance, setBalance] = useState<AsaasBalance | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = useCallback(async (refreshing = false) => {
        if (!enabled) {
            setIsLoading(false);
            return;
        }
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const data = await walletFetch<AsaasBalance>("/api/wallet/balance");
            setBalance(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar saldo");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [enabled]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    const available = balance?.balance ?? 0;
    const total = balance?.totalBalance ?? balance?.balance ?? 0;
    const pending = Math.max(0, total - available);

    return {
        balance,
        available,
        pending,
        total,
        isLoading,
        isRefreshing,
        error,
        refresh: () => fetchBalance(true),
    };
}
