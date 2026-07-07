// ============================================================================
// useStudentPayment — cobrança pendente do aluno logado (pagar in-app)
// ============================================================================
// GET /api/student/payment → { hasPending, amount, planTitle, invoiceUrl, ... }
// O aluno paga via WebView do checkout Asaas (invoiceUrl).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { walletFetch } from "../lib/wallet-api";

export interface StudentPayment {
    hasPending: boolean;
    contractId?: string;
    amount?: number;
    status?: string;
    planTitle?: string | null;
    billingType?: string | null;
    invoiceUrl?: string | null;
}

export function useStudentPayment() {
    const [data, setData] = useState<StudentPayment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // isLoading só no PRIMEIRO load (default true): re-fetches (pull-to-refresh,
    // poll do checkout) não podem trocar a tela inteira pelo loader.
    const fetchPayment = useCallback(async () => {
        try {
            const res = await walletFetch<StudentPayment>("/api/student/payment");
            setData(res);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar cobrança");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPayment();
    }, [fetchPayment]);

    return { data, isLoading, error, refresh: fetchPayment };
}
