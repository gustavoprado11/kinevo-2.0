import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'
import { insertTrainerNotification } from '@/lib/trainer-notifications'

export async function GET(request: NextRequest) {
    // Verify CRON_SECRET to prevent external calls
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Find manual contracts that are still 'active' but overdue by >3 days
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        const { data: overdueContracts, error: fetchError } = await supabaseAdmin
            .from('student_contracts')
            .select('id, student_id, trainer_id, amount, current_period_end, billing_type')
            .in('billing_type', ['manual_recurring', 'manual_one_off'])
            .eq('status', 'active')
            .not('current_period_end', 'is', null)
            .lt('current_period_end', threeDaysAgo)

        if (fetchError) {
            console.error('[cron] Failed to fetch overdue contracts:', fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        if (!overdueContracts || overdueContracts.length === 0) {
            return NextResponse.json({ updated: 0, notified: 0 })
        }

        let updatedCount = 0
        let notifiedCount = 0

        for (const contract of overdueContracts) {
            // Mark as past_due (guard: only if still active for idempotency)
            const { error: updateError } = await supabaseAdmin
                .from('student_contracts')
                .update({ status: 'past_due' })
                .eq('id', contract.id)
                .eq('status', 'active')

            if (updateError) continue

            updatedCount++

            const daysOverdue = Math.floor(
                (Date.now() - new Date(contract.current_period_end!).getTime()) / (1000 * 60 * 60 * 24)
            )

            // Log contract event
            await logContractEvent({
                studentId: contract.student_id,
                trainerId: contract.trainer_id,
                contractId: contract.id,
                eventType: 'contract_overdue',
                metadata: { days_overdue: daysOverdue },
            })

            // Fetch student name for notification
            const { data: student } = await supabaseAdmin
                .from('students')
                .select('name')
                .eq('id', contract.student_id)
                .single()

            const studentName = student?.name ?? 'Aluno'

            // Notify trainer
            await insertTrainerNotification({
                trainerId: contract.trainer_id,
                type: 'financial_alert',
                title: 'Pagamento manual vencido',
                message: `${studentName} tem pagamento manual vencido há ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''}.`,
                metadata: {
                    student_id: contract.student_id,
                    contract_id: contract.id,
                    days_overdue: daysOverdue,
                },
            })
            notifiedCount++
        }

        console.log(`[cron] check-manual-overdue: updated=${updatedCount}, notified=${notifiedCount}`)
        return NextResponse.json({ updated: updatedCount, notified: notifiedCount })
    } catch (err) {
        console.error('[cron] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
