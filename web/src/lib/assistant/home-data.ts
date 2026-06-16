/**
 * Dados do home do Assistente (aba /assistente, modo Cowork).
 *
 * "Precisa de atenção" reusa assistant_insights (alertas já gerados pelo cron:
 * estagnação, adesão, etc.). Leitura via service role com filtro por trainer.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AttentionItem {
    id: string
    category: string
    priority: string
    title: string
    body: string
    studentId: string | null
    studentName: string | null
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/** Top insights ativos do treinador (mais prioritários primeiro). */
export async function getAttentionInsights(
    sb: SupabaseClient,
    trainerId: string,
    limit = 6,
): Promise<AttentionItem[]> {
    const { data, error } = await sb
        .from('assistant_insights')
        .select('id, category, priority, title, body, student_id, status, students:student_id(name)')
        .eq('trainer_id', trainerId)
        .in('status', ['new', 'read'])
        .order('created_at', { ascending: false })
        .limit(40)
    if (error || !data) return []

    return (data as Record<string, unknown>[])
        .map((r) => {
            const student = r.students as { name?: string } | null
            return {
                id: r.id as string,
                category: (r.category as string) ?? '',
                priority: (r.priority as string) ?? 'medium',
                title: (r.title as string) ?? '',
                body: (r.body as string) ?? '',
                studentId: (r.student_id as string | null) ?? null,
                studentName: student?.name ?? null,
            }
        })
        .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1))
        .slice(0, limit)
}
