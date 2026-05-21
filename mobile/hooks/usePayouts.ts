// ============================================================================
// usePayouts — histórico de saques + solicitação de novo saque PIX
// ============================================================================
// GET  /api/wallet/payouts  → { data: PayoutRow[] }
// POST /api/wallet/payouts  → { id, asaasTransferId, status, value }
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import type { PixKeyType } from "@kinevo/shared/types/asaas";
import { walletFetch } from "../lib/wallet-api";

export type PayoutStatus =
    | "requested"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
    | "awaiting_authorization";

export interface PayoutRow {
    id: string;
    amount_cents: number;
    status: PayoutStatus;
    failure_reason: string | null;
    end_to_end_id: string | null;
    requested_at: string;
    completed_at: string | null;
    pix_key_snapshot: string | null;
    pix_key_type_snapshot: PixKeyType | null;
}

export interface CreatePayoutResult {
    id: string;
    asaasTransferId: string;
    status: PayoutStatus;
    value: number;
}

export function usePayouts() {
    const [payouts, setPayouts] = useState<PayoutRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPayouts = useCallback(async (refreshing = false) => {
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const res = await walletFetch<{ data: PayoutRow[] }>("/api/wallet/payouts");
            setPayouts(res.data ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao listar saques");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchPayouts();
    }, [fetchPayouts]);

    /** value em reais (não centavos). */
    const requestPayout = useCallback(async (pixKeyId: string, value: number) => {
        const result = await walletFetch<CreatePayoutResult>("/api/wallet/payouts", {
            method: "POST",
            body: { pixKeyId, value },
        });
        await fetchPayouts();
        return result;
    }, [fetchPayouts]);

    return {
        payouts,
        isLoading,
        isRefreshing,
        error,
        refresh: () => fetchPayouts(true),
        requestPayout,
    };
}
