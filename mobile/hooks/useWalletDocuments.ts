// ============================================================================
// useWalletDocuments — documentos KYC pendentes da subconta Asaas
// ============================================================================
// GET /api/wallet/documents → AsaasDocumentGroup[] (envio externo via onboardingUrl).
// Só busca quando a carteira existe mas ainda não foi aprovada.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import type { AsaasDocumentGroup } from "@kinevo/shared/types/asaas";
import { walletFetch } from "../lib/wallet-api";

export function useWalletDocuments(enabled: boolean) {
    const [documents, setDocuments] = useState<AsaasDocumentGroup[]>([]);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const fetchDocs = useCallback(async () => {
        if (!enabled) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const res = await walletFetch<{ groups?: AsaasDocumentGroup[] }>("/api/wallet/documents");
            setDocuments(res.groups ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível carregar os documentos.");
        } finally {
            setIsLoading(false);
        }
    }, [enabled]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    return { documents, isLoading, error, refresh: fetchDocs };
}
