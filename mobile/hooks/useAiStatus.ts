import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_WEB_URL || "https://www.kinevoapp.com";

/**
 * Status de IA/tier do treinador, espelhado do backend web.
 *
 * Reflete o tier no app: medidor de créditos e gate de criação de aluno
 * ("Assine para adicionar alunos" no Free já no limite). O gate real é
 * revalidado no backend — aqui é só UX, e nunca trava o app.
 *
 * Fonte: GET /api/trainer/ai-status (auth por JWT da sessão Supabase).
 */
export interface AiStatus {
    tier: string;
    creditsUsed: number;
    creditsTotal: number;
    creditsRemaining: number;
    studentsLocked: boolean;
}

interface UseAiStatusResult {
    status: AiStatus | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useAiStatus(): UseAiStatusResult {
    const [status, setStatus] = useState<AiStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const res = await fetch(`${API_URL}/api/trainer/ai-status`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const contentType = res.headers.get("content-type") || "";
            if (res.ok && contentType.includes("application/json")) {
                const data = (await res.json()) as AiStatus;
                setStatus(data);
            }
        } catch (err) {
            if (__DEV__) console.error("[useAiStatus] error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { status, isLoading, refresh: fetchStatus };
}
