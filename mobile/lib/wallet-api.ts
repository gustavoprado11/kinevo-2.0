// ============================================================================
// wallet-api — cliente fino pros endpoints /api/wallet/* (Carteira Asaas)
// ============================================================================
// Os endpoints web já são mobile-aware: requireTrainer() aceita Bearer token.
// Este helper centraliza: pegar o token da sessão Supabase, montar a URL,
// enviar JSON e propagar o erro com a mensagem real vinda da API.
//
// Mesma base de URL usada por useStripeStatus (EXPO_PUBLIC_WEB_URL).
// ============================================================================

import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";

export class WalletApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "WalletApiError";
        this.status = status;
    }
}

interface WalletFetchOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
}

/**
 * Chama um endpoint /api/wallet/* autenticado com o Bearer da sessão atual.
 * Retorna o JSON tipado como T. Lança WalletApiError com a mensagem da API
 * em caso de falha (ou de sessão ausente).
 */
export async function walletFetch<T>(path: string, options: WalletFetchOptions = {}): Promise<T> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
        throw new WalletApiError("Sessão expirada. Faça login novamente.", 401);
    }

    const res = await fetch(`${API_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
        const message =
            (payload && typeof payload === "object" && "error" in payload
                ? String((payload as { error: unknown }).error)
                : null) || `Erro ${res.status} ao falar com o servidor.`;
        throw new WalletApiError(message, res.status);
    }

    return payload as T;
}
