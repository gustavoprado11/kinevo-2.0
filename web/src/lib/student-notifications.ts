import { supabaseAdmin } from '@/lib/supabase-admin'

interface StudentNotificationParams {
    studentId: string
    trainerId: string
    type: 'program_assigned' | 'form_request' | 'feedback' | 'system_alert' | 'text_message'
    title: string
    subtitle?: string
    payload?: Record<string, unknown>
}

/**
 * Insert a notification into the student inbox.
 * Non-blocking — never throws. A failed notification should not break the calling flow.
 * Returns the inserted inbox item ID (or null on failure).
 */
export async function insertStudentNotification(params: StudentNotificationParams): Promise<string | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('student_inbox_items')
            .insert({
                student_id: params.studentId,
                trainer_id: params.trainerId,
                type: params.type,
                status: 'unread',
                title: params.title,
                subtitle: params.subtitle ?? null,
                payload: params.payload ?? {},
            })
            .select('id')
            .single()

        if (error) {
            console.error('[student-notifications] Insert failed:', error.message)
            return null
        }

        return data?.id ?? null
    } catch (err) {
        console.error('[student-notifications] Unexpected error:', err)
        return null
    }
}
