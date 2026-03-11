import { supabaseAdmin } from '@/lib/supabase-admin'

interface TrainerNotificationParams {
    trainerId: string
    type: string
    title: string
    message: string
    metadata?: Record<string, unknown>
}

/**
 * Insert a notification for a trainer.
 * Non-blocking — never throws. A failed notification should not break the calling flow.
 * Returns the inserted notification ID (or null on failure).
 */
export async function insertTrainerNotification(params: TrainerNotificationParams): Promise<string | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('trainer_notifications')
            .insert({
                trainer_id: params.trainerId,
                type: params.type,
                title: params.title,
                message: params.message,
                metadata: params.metadata ?? {},
            })
            .select('id')
            .single()

        if (error) {
            console.error('[trainer-notifications] Insert failed:', error.message)
            return null
        }

        return data?.id ?? null
    } catch (err) {
        console.error('[trainer-notifications] Unexpected error:', err)
        return null
    }
}
