// ============================================================================
// usePixKeys — CRUD das chaves PIX de saque do trainer
// ============================================================================
// GET    /api/wallet/pix-keys            → { data: PixKeyRow[] }
// POST   /api/wallet/pix-keys            → cria (valida formato no backend)
// PATCH  /api/wallet/pix-keys/[id]       → { isDefault: true }
// DELETE /api/wallet/pix-keys/[id]
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import type { PixKeyType } from "@kinevo/shared/types/asaas";
import { walletFetch } from "../lib/wallet-api";

export interface PixKeyRow {
    id: string;
    alias: string;
    pix_key: string;
    key_type: PixKeyType;
    owner_name: string | null;
    bank_name: string | null;
    is_default: boolean;
    validated_at: string | null;
    created_at?: string;
}

export interface AddPixKeyInput {
    alias: string;
    pixKey: string;
    keyType: PixKeyType;
    isDefault?: boolean;
}

export function usePixKeys() {
    const [keys, setKeys] = useState<PixKeyRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchKeys = useCallback(async (refreshing = false) => {
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const res = await walletFetch<{ data: PixKeyRow[] }>("/api/wallet/pix-keys");
            setKeys(res.data ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao listar chaves PIX");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const addKey = useCallback(async (input: AddPixKeyInput) => {
        const created = await walletFetch<PixKeyRow>("/api/wallet/pix-keys", {
            method: "POST",
            body: input,
        });
        await fetchKeys();
        return created;
    }, [fetchKeys]);

    const setDefault = useCallback(async (id: string) => {
        await walletFetch(`/api/wallet/pix-keys/${id}`, {
            method: "PATCH",
            body: { isDefault: true },
        });
        await fetchKeys();
    }, [fetchKeys]);

    const removeKey = useCallback(async (id: string) => {
        await walletFetch(`/api/wallet/pix-keys/${id}`, { method: "DELETE" });
        await fetchKeys();
    }, [fetchKeys]);

    return {
        keys,
        isLoading,
        isRefreshing,
        error,
        refresh: () => fetchKeys(true),
        addKey,
        setDefault,
        removeKey,
    };
}
