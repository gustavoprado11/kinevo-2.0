/**
 * useAssistantAccess — o treinador pode usar o modo Assistente? (todos os tiers têm IA)
 *
 * Consulta /api/trainer/assistant/access (Bearer). Cacheia em memória para não
 * re-buscar a cada navegação. Fail-closed: na dúvida (erro/sem rede), allowed=false.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kinevoapp.com';

export interface AssistantAccess {
    allowed: boolean;
    tier: string;
    loading: boolean;
}

let cached: { allowed: boolean; tier: string } | null = null;

async function fetchAccess(): Promise<{ allowed: boolean; tier: string } | null> {
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
        return { allowed: json.allowed, tier: typeof json.tier === 'string' ? json.tier : 'free' };
    } catch {
        return null;
    }
}

export function useAssistantAccess(): AssistantAccess {
    const [state, setState] = useState<AssistantAccess>(
        cached ? { ...cached, loading: false } : { allowed: false, tier: 'free', loading: true },
    );

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

    return state;
}
