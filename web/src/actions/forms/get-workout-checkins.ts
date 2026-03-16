'use server'

import { createClient } from '@/lib/supabase/server'

export interface WorkoutCheckinSummary {
    id: string
    triggerContext: 'pre_workout' | 'post_workout'
    formTitle: string
    submittedAt: string
    answersJson: Record<string, any> | null
    schemaJson: { questions?: any[] } | null
}

/**
 * Fetches the last N form submissions with trigger_context IN ('pre_workout', 'post_workout')
 * for a given student, ordered by submitted_at DESC.
 */
export async function getRecentWorkoutCheckins(studentId: string, limit = 3): Promise<WorkoutCheckinSummary[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('form_submissions')
        .select('id, trigger_context, submitted_at, answers_json, schema_snapshot_json, form_templates(title)')
        .eq('student_id', studentId)
        .in('trigger_context', ['pre_workout', 'post_workout'])
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[getRecentWorkoutCheckins] error:', error)
        return []
    }

    return (data ?? []).map((row: any) => ({
        id: row.id,
        triggerContext: row.trigger_context,
        formTitle: row.form_templates?.title || 'Check-in',
        submittedAt: row.submitted_at,
        answersJson: row.answers_json,
        schemaJson: row.schema_snapshot_json,
    }))
}
