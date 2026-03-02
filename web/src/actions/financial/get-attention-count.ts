'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getFinancialAttentionCount(trainerId: string): Promise<number> {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        const [pastDue, manualOverdue, canceling] = await Promise.all([
            // Stripe past_due
            supabaseAdmin
                .from('student_contracts')
                .select('id', { count: 'exact', head: true })
                .eq('trainer_id', trainerId)
                .eq('status', 'past_due'),

            // Manual overdue (active but past grace period)
            supabaseAdmin
                .from('student_contracts')
                .select('id', { count: 'exact', head: true })
                .eq('trainer_id', trainerId)
                .in('billing_type', ['manual_recurring', 'manual_one_off'])
                .eq('status', 'active')
                .not('current_period_end', 'is', null)
                .lt('current_period_end', threeDaysAgo),

            // Canceling (scheduled but not yet canceled)
            supabaseAdmin
                .from('student_contracts')
                .select('id', { count: 'exact', head: true })
                .eq('trainer_id', trainerId)
                .eq('cancel_at_period_end', true)
                .neq('status', 'canceled'),
        ])

        return (pastDue.count ?? 0) + (manualOverdue.count ?? 0) + (canceling.count ?? 0)
    } catch (err) {
        console.error('[get-attention-count] Error:', err)
        return 0
    }
}
