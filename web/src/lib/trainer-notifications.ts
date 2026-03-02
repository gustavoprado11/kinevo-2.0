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
 */
export async function insertTrainerNotification(params: TrainerNotificationParams): Promise<void> {
    try {
        const { error } = await supabaseAdmin
            .from('trainer_notifications')
            .insert({
                trainer_id: params.trainerId,
                type: params.type,
                title: params.title,
                message: params.message,
                metadata: params.metadata ?? {},
            })

        if (error) {
            console.error('[trainer-notifications] Insert failed:', error.message)
        }
    } catch (err) {
        console.error('[trainer-notifications] Unexpected error:', err)
    }
}
