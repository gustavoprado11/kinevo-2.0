'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function syncManualOverdue(trainerId: string): Promise<number> {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        const { data, error } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'past_due' })
            .eq('trainer_id', trainerId)
            .in('billing_type', ['manual_recurring', 'manual_one_off'])
            .eq('status', 'active')
            .not('current_period_end', 'is', null)
            .lt('current_period_end', threeDaysAgo)
            .select('id')

        if (error) {
            console.error('[sync-manual-overdue] DB error:', error)
            return 0
        }

        return data?.length ?? 0
    } catch (err) {
        console.error('[sync-manual-overdue] Error:', err)
        return 0
    }
}
