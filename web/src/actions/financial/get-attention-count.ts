'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getFinancialAttentionCount(trainerId: string): Promise<number> {
    try {
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
            // past_due: the status change updated updated_at
            pastDueQuery = pastDueQuery.gt('updated_at', seenAt)

            // manual overdue: the period ended after the trainer last checked
            manualOverdueQuery = manualOverdueQuery.gt('current_period_end', seenAt)

            // canceling: the cancellation scheduling updated updated_at
            cancelingQuery = cancelingQuery.gt('updated_at', seenAt)
        }

        const [pastDue, manualOverdue, canceling] = await Promise.all([
            pastDueQuery,
            manualOverdueQuery,
            cancelingQuery,
        ])

        return (pastDue.count ?? 0) + (manualOverdue.count ?? 0) + (canceling.count ?? 0)
    } catch (err) {
        console.error('[get-attention-count] Error:', err)
        return 0
    }
}
