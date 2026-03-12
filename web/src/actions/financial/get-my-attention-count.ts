'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getMyAttentionCount(): Promise<number> {
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

        const trainerId = trainer.id

        // Fetch the timestamp of the trainer's last visit to financial pages
        const { data: trainerData } = await supabaseAdmin
            .from('trainers')
            .select('financial_attention_seen_at')
            .eq('id', trainerId)
            .single()

        const seenAt = trainerData?.financial_attention_seen_at as string | null

        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        // Build queries — only count items that changed AFTER seenAt
        let pastDueQuery = supabaseAdmin
            .from('student_contracts')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .eq('status', 'past_due')

        let manualOverdueQuery = supabaseAdmin
            .from('student_contracts')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .in('billing_type', ['manual_recurring', 'manual_one_off'])
            .eq('status', 'active')
            .not('current_period_end', 'is', null)
            .lt('current_period_end', threeDaysAgo)

        let cancelingQuery = supabaseAdmin
            .from('student_contracts')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .eq('cancel_at_period_end', true)
            .neq('status', 'canceled')

        if (seenAt) {
            pastDueQuery = pastDueQuery.gt('updated_at', seenAt)
            manualOverdueQuery = manualOverdueQuery.gt('current_period_end', seenAt)
            cancelingQuery = cancelingQuery.gt('updated_at', seenAt)
        }

        const [pastDue, manualOverdue, canceling] = await Promise.all([
            pastDueQuery,
            manualOverdueQuery,
            cancelingQuery,
        ])

        return (pastDue.count ?? 0) + (manualOverdue.count ?? 0) + (canceling.count ?? 0)
    } catch {
        return 0
    }
}
