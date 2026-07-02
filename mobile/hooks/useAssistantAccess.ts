/**
 * useAssistantAccess — o treinador pode usar o modo Assistente? (todos os tiers têm IA)
 *
 * Consulta /api/trainer/assistant/access (Bearer). Cacheia em memória para não
 * re-buscar a cada navegação. Fail-closed: na dúvida (erro/sem rede), allowed=false.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kinevoapp.com';

/** Medidor de créditos do período (espelha AiUsageSummary do web). */
export interface AssistantUsageSummary {
    tier: string;
    creditsUsed: number;
    creditsTotal: number;
    creditsRemaining: number;
    periodStart: string;
    periodEnd: string;
    exhausted: boolean;
}

export interface AssistantAccess {
    allowed: boolean;
    tier: string;
    /** Medidor do ciclo (Onda 3: exibido na home) — null se a rota não devolveu. */
    summary: AssistantUsageSummary | null;
    loading: boolean;
    /** Re-busca o medidor — os créditos mudam a cada turno de chat. */
    refresh: () => Promise<void>;
}

type AccessPayload = { allowed: boolean; tier: string; summary: AssistantUsageSummary | null };

let cached: AccessPayload | null = null;

async function fetchAccess(): Promise<AccessPayload | null> {
    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return null;
        const res = await fetch(`${WEB_URL}/api/trainer/assistant/access`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json || typeof json.allowed !== 'boolean') return null;
        return {
            allowed: json.allowed,
            tier: typeof json.tier === 'string' ? json.tier : 'free',
            summary:
                json.summary && typeof json.summary === 'object'
                    ? (json.summary as AssistantUsageSummary)
                    : null,
        };
    } catch {
        return null;
    }
}

export function useAssistantAccess(): AssistantAccess {
    const [state, setState] = useState<AccessPayload & { loading: boolean }>(
        cached
            ? { ...cached, loading: false }
            : { allowed: false, tier: 'free', summary: null, loading: true },
    );

    const refresh = useCallback(async () => {
        const r = await fetchAccess();
        if (r) {
            cached = r;
            setState({ ...r, loading: false });
        } else {
            setState((s) => ({ ...s, loading: false }));
        }
    }, []);

    useEffect(() => {
        let active = true;
        void (async () => {
            const r = await fetchAccess();
            if (!active) return;
            if (r) {
                cached = r;
                setState({ ...r, loading: false });
            } else {
                setState((s) => ({ ...s, loading: false }));
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    return { ...state, refresh };
}
