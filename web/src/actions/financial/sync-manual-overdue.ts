'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function syncManualOverdue(): Promise<number> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return 0

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return 0

        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        const { data, error } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'past_due' })
            .eq('trainer_id', trainer.id)
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
