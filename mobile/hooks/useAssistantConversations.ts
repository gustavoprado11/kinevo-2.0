/**
 * useAssistantConversations — lista o histórico de conversas do Assistente
 * (paridade com a sidebar do web) + renomear/arquivar.
 *
 * GET /api/trainer/assistant/conversations  → lista
 * PATCH /api/trainer/assistant/conversations/:id { title } | { archived:true }
 */
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.kinevoapp.com';

export interface ConversationListItem {
    id: string;
    title: string;
    last_message_at: string;
    message_count: number;
    studentName: string | null;
}

async function authed(path: string, init?: RequestInit): Promise<Response | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return fetch(`${WEB_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {}),
        },
    });
}

export interface UseAssistantConversationsReturn {
    items: ConversationListItem[];
    loading: boolean;
    refresh: () => Promise<void>;
    rename: (id: string, title: string) => Promise<void>;
    archive: (id: string) => Promise<void>;
}

export function useAssistantConversations(): UseAssistantConversationsReturn {
    const [items, setItems] = useState<ConversationListItem[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authed('/api/trainer/assistant/conversations', { method: 'GET' });
            if (!res || !res.ok) return;
            const json = await res.json().catch(() => null);
            if (Array.isArray(json?.conversations)) setItems(json.conversations as ConversationListItem[]);
        } catch {
            // mantém a lista atual em caso de falha de rede.
        } finally {
            setLoading(false);
        }
    }, []);

    const rename = useCallback(async (id: string, title: string) => {
        const clean = title.trim();
        if (!clean) return;
        // Otimista.
        setItems((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)));
        try {
            await authed(`/api/trainer/assistant/conversations/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ title: clean }),
            });
        } catch {
            // se falhar, o refresh seguinte corrige.
        }
    }, []);

    const archive = useCallback(async (id: string) => {
        // Otimista: some da lista.
        setItems((prev) => prev.filter((c) => c.id !== id));
        try {
            await authed(`/api/trainer/assistant/conversations/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ archived: true }),
            });
        } catch {
            // se falhar, o refresh seguinte recupera.
        }
    }, []);

    return { items, loading, refresh, rename, archive };
}
