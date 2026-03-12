import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendStudentPush } from '@/lib/push-notifications'

/**
 * GET /api/cron/process-form-schedules
 * Runs daily — finds active form_schedules where next_due_at <= now(),
 * creates inbox items + draft submissions (anti-spam: skips if a pending
 * inbox item already exists for that student+template), then advances next_due_at.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date().toISOString()

        const { data: dueSchedules, error: fetchError } = await supabaseAdmin
            .from('form_schedules')
            .select('id, trainer_id, student_id, form_template_id, frequency, next_due_at')
            .eq('is_active', true)
            .lte('next_due_at', now)

        if (fetchError) {
            console.error('[cron:process-form-schedules] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        if (!dueSchedules || dueSchedules.length === 0) {
            return NextResponse.json({ processed: 0, sent: 0, skipped: 0 })
        }

        let sentCount = 0
        let skippedCount = 0

        for (const schedule of dueSchedules) {
            try {
                // Verify student still belongs to trainer
                const { data: student } = await supabaseAdmin
                    .from('students')
                    .select('id')
                    .eq('id', schedule.student_id)
                    .eq('coach_id', schedule.trainer_id)
                    .single()

                if (!student) {
                    await supabaseAdmin
                        .from('form_schedules')
                        .update({ is_active: false })
                        .eq('id', schedule.id)
                    skippedCount++
                    continue
                }

                // Get form template (must still be active)
                const { data: template } = await supabaseAdmin
                    .from('form_templates')
                    .select('id, title, category, version, schema_json')
                    .eq('id', schedule.form_template_id)
                    .eq('is_active', true)
                    .single()

                if (!template) {
                    await supabaseAdmin
                        .from('form_schedules')
                        .update({ is_active: false })
                        .eq('id', schedule.id)
                    skippedCount++
                    continue
                }

                // Anti-spam: check for existing pending inbox item for this student+template
                const { data: pendingItems } = await supabaseAdmin
                    .from('student_inbox_items')
                    .select('id, payload')
                    .eq('student_id', schedule.student_id)
                    .eq('trainer_id', schedule.trainer_id)
                    .eq('type', 'form_request')
                    .in('status', ['unread', 'pending_action'])

                const hasPendingForTemplate = (pendingItems ?? []).some((item: any) =>
                    item.payload?.form_template_id === schedule.form_template_id
                )

                if (hasPendingForTemplate) {
                    // Already pending — just advance the schedule
                    const nextDue = computeNextDue(schedule.frequency, new Date())
                    await supabaseAdmin
                        .from('form_schedules')
                        .update({ next_due_at: nextDue.toISOString(), last_sent_at: now })
                        .eq('id', schedule.id)
                    skippedCount++
                    continue
                }

                // Create inbox item
                const { data: inboxItem, error: inboxError } = await supabaseAdmin
                    .from('student_inbox_items')
                    .insert({
                        student_id: schedule.student_id,
                        trainer_id: schedule.trainer_id,
                        type: 'form_request',
                        status: 'pending_action',
                        title: template.title,
                        subtitle: 'Formulário recorrente',
                        payload: {
                            payload_version: 1,
                            form_template_id: template.id,
                            form_template_version: template.version,
                            category: template.category,
                            source: 'recurring_schedule',
                            schedule_id: schedule.id,
                        },
                    })
                    .select('id')
                    .single()

                if (inboxError || !inboxItem) {
                    console.error(`[cron:process-form-schedules] Inbox error schedule=${schedule.id}:`, inboxError)
                    skippedCount++
                    continue
                }

                // Create draft submission
                const { data: submission, error: subError } = await supabaseAdmin
                    .from('form_submissions')
                    .insert({
                        form_template_id: template.id,
                        form_template_version: template.version,
                        trainer_id: schedule.trainer_id,
                        student_id: schedule.student_id,
                        inbox_item_id: inboxItem.id,
                        status: 'draft',
                        schema_snapshot_json: template.schema_json,
                        trigger_context: 'recurring',
                    })
                    .select('id')
                    .single()

                if (subError || !submission) {
                    console.error(`[cron:process-form-schedules] Submission error schedule=${schedule.id}:`, subError)
                    skippedCount++
                    continue
                }

                // Backfill submission_id into inbox payload
                await supabaseAdmin
                    .from('student_inbox_items')
                    .update({
                        payload: {
                            payload_version: 1,
                            form_template_id: template.id,
                            form_template_version: template.version,
                            category: template.category,
                            source: 'recurring_schedule',
                            schedule_id: schedule.id,
                            submission_id: submission.id,
                        },
                    })
                    .eq('id', inboxItem.id)

                // Send push notification (fire-and-forget)
                sendStudentPush({
                    studentId: schedule.student_id,
                    title: 'Nova avaliação disponível',
                    body: 'Seu treinador enviou uma avaliação para você preencher.',
                    inboxItemId: inboxItem.id,
                    data: { type: 'form_request', inbox_item_id: inboxItem.id },
                })

                // Advance schedule
                const nextDue = computeNextDue(schedule.frequency, new Date())
                await supabaseAdmin
                    .from('form_schedules')
                    .update({ next_due_at: nextDue.toISOString(), last_sent_at: now })
                    .eq('id', schedule.id)

                sentCount++
            } catch (err) {
                console.error(`[cron:process-form-schedules] Error schedule=${schedule.id}:`, err)
                skippedCount++
            }
        }

        console.log(`[cron:process-form-schedules] processed=${dueSchedules.length} sent=${sentCount} skipped=${skippedCount}`)
        return NextResponse.json({ processed: dueSchedules.length, sent: sentCount, skipped: skippedCount })
    } catch (err) {
        console.error('[cron:process-form-schedules] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

function computeNextDue(frequency: string, fromDate: Date): Date {
    const next = new Date(fromDate)
    switch (frequency) {
        case 'daily':
            next.setDate(next.getDate() + 1)
            break
        case 'weekly':
            next.setDate(next.getDate() + 7)
            break
        case 'biweekly':
            next.setDate(next.getDate() + 14)
            break
        case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
        default:
            next.setDate(next.getDate() + 7)
    }
    return next
}
