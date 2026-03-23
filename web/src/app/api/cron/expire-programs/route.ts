import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * CRON: Expire programs whose expires_at has passed.
 * Runs daily — idempotent (only transitions active → expired).
 * Notifies trainers for each expired program.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Find active programs that have passed their expiration date
        const { data: expiredPrograms, error: fetchError } = await supabaseAdmin
            .from('assigned_programs')
            .select('id, student_id, trainer_id, name')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lt('expires_at', new Date().toISOString())

        if (fetchError) {
            console.error('[cron:expire-programs] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        if (!expiredPrograms || expiredPrograms.length === 0) {
            return NextResponse.json({ expired: 0, notified: 0 })
        }

        let expiredCount = 0
        let notifiedCount = 0

        for (const program of expiredPrograms) {
            // Transition active → expired (idempotent guard via status filter)
            const { error: updateError } = await supabaseAdmin
                .from('assigned_programs')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', program.id)
                .eq('status', 'active')

            if (updateError) {
                console.error(`[cron:expire-programs] Failed to expire program ${program.id}:`, updateError)
                continue
            }

            expiredCount++

            // Fetch student name for notification
            const { data: student } = await supabaseAdmin
                .from('students')
                .select('name')
                .eq('id', program.student_id)
                .single()

            const studentName = student?.name ?? 'Aluno'
            const programName = program.name ?? 'Programa'

            // Notify trainer
            const notifId = await insertTrainerNotification({
                trainerId: program.trainer_id,
                type: 'program_expired',
                title: 'Programa expirou',
                message: `O programa "${programName}" de ${studentName} expirou. Revise e tome uma ação.`,
                metadata: {
                    student_id: program.student_id,
                    program_id: program.id,
                },
            })

            sendTrainerPush({
                trainerId: program.trainer_id,
                type: 'program_expired',
                title: 'Programa expirou',
                body: `O programa "${programName}" de ${studentName} expirou. Revise e tome uma ação.`,
                notificationId: notifId ?? undefined,
                data: {
                    type: 'program_expired',
                    student_id: program.student_id,
                    program_id: program.id,
                },
            })

            notifiedCount++
        }

        console.log(`[cron:expire-programs] expired=${expiredCount}, notified=${notifiedCount}`)
        return NextResponse.json({ expired: expiredCount, notified: notifiedCount })
    } catch (err) {
        console.error('[cron:expire-programs] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
