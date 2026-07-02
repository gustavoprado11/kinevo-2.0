/**
 * useAssistantInsights — insights de IA do treinador (assistant_insights) para a
 * home do Assistente, com paridade com a web (getAttentionInsights):
 * status new/read, mais prioritários primeiro, top 6.
 *
 * Leitura DIRETA via Supabase com RLS ("Trainer can read own insights",
 * migration 088) — mesmo padrão dos outros hooks do app; sem rota nova.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AttentionInsight } from '../lib/assistantPrompts';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const LIMIT = 6;

export interface UseAssistantInsightsReturn {
    insights: AttentionInsight[];
    loading: boolean;
    refresh: () => Promise<void>;
}

export function useAssistantInsights(): UseAssistantInsightsReturn {
    const [insights, setInsights] = useState<AttentionInsight[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('assistant_insights')
                .select('id, category, priority, title, body, student_id, students:student_id(name)')
                .in('status', ['new', 'read'])
                .order('created_at', { ascending: false })
                .limit(40);
            if (error || !data) return;
            const items = (data as unknown as Array<Record<string, unknown>>)
                .map((r) => {
                    const student = r.students as { name?: string } | null;
                    return {
                        id: r.id as string,
                        category: (r.category as string) ?? '',
                        priority: (r.priority as string) ?? 'medium',
                        title: (r.title as string) ?? '',
                        body: (r.body as string) ?? '',
                        studentId: (r.student_id as string | null) ?? null,
                        studentName: student?.name ?? null,
                    };
                })
                .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1))
                .slice(0, LIMIT);
            setInsights(items);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { insights, loading, refresh };
}
