'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ──

export interface InsightItem {
    id: string
    student_id: string | null
    student_name: string | null
    category: 'alert' | 'progression' | 'suggestion' | 'summary'
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    body: string
    action_type: string | null
    action_metadata: Record<string, any>
    status: 'new' | 'read' | 'dismissed' | 'acted'
    source: 'rules' | 'llm'
    insight_key: string
    created_at: string
}

export interface InsightCounts {
    new: number
    read: number
}

// ── Priority ordering for sort ──

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// ── Actions ──

export async function getTrainerInsights(): Promise<{ insights: InsightItem[]; error: string | null }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { insights: [], error: 'Não autenticado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { insights: [], error: 'Trainer não encontrado' }

    const { data, error } = await supabase
        .from('assistant_insights')
        .select('id, student_id, category, priority, title, body, action_type, action_metadata, status, source, insight_key, created_at')
        .eq('trainer_id', trainer.id)
        .in('status', ['new', 'read'])
        .order('created_at', { ascending: false })

    if (error) return { insights: [], error: error.message }

    // Fetch student names for insights that have student_id
    const studentIds = [...new Set((data || []).filter(d => d.student_id).map(d => d.student_id!))]
    let studentMap = new Map<string, string>()

    if (studentIds.length > 0) {
        const { data: students } = await supabase
            .from('students')
            .select('id, name')
            .in('id', studentIds)

        studentMap = new Map((students || []).map(s => [s.id, s.name]))
    }

    const insights: InsightItem[] = (data || []).map(row => ({
        ...row,
        student_name: row.student_id ? (studentMap.get(row.student_id) || null) : null,
        action_metadata: row.action_metadata || {},
    }))

    // Sort by priority DESC, then created_at DESC
    insights.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 3
        const pb = PRIORITY_ORDER[b.priority] ?? 3
        if (pa !== pb) return pa - pb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return { insights, error: null }
}

export async function markInsightRead(insightId: string): Promise<{ success: boolean }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('assistant_insights')
        .update({ status: 'read', updated_at: new Date().toISOString() })
        .eq('id', insightId)
        .eq('status', 'new')

    return { success: !error }
}

export async function dismissInsight(insightId: string): Promise<{ success: boolean }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('assistant_insights')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('id', insightId)

    return { success: !error }
}

export async function getInsightCounts(): Promise<InsightCounts> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { new: 0, read: 0 }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { new: 0, read: 0 }

    const { data, error } = await supabase
        .from('assistant_insights')
        .select('status')
        .eq('trainer_id', trainer.id)
        .in('status', ['new', 'read'])

    if (error || !data) return { new: 0, read: 0 }

    return {
        new: data.filter(d => d.status === 'new').length,
        read: data.filter(d => d.status === 'read').length,
    }
}
