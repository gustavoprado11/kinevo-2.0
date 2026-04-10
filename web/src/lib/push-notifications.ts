import { supabaseAdmin } from '@/lib/supabase-admin'

interface SendTrainerPushParams {
    trainerId: string
    type: string
    title: string
    body: string
    data?: Record<string, string>
    /** When provided, marks push_sent_at on this trainer_notifications row after successful send. */
    notificationId?: string
}

/**
 * Send push notification to a trainer's registered devices.
 * Non-blocking — never throws. Checks notification preferences before sending.
 * Handles DeviceNotRegistered by marking tokens as inactive.
 */
export async function sendTrainerPush(params: SendTrainerPushParams): Promise<void> {
    try {
        // 1. Check trainer preferences
        const { data: trainer } = await supabaseAdmin
            .from('trainers')
            .select('notification_preferences')
            .eq('id', params.trainerId)
            .single()

        if (!trainer) return

        const prefs = (trainer.notification_preferences ?? {}) as Record<string, boolean>
        if (prefs[params.type] === false) return

        // 2. Get active push tokens
        const { data: tokens } = await supabaseAdmin
            .from('push_tokens')
            .select('id, expo_push_token')
            .eq('trainer_id', params.trainerId)
            .eq('role', 'trainer')
            .eq('active', true)

        if (!tokens || tokens.length === 0) return

        // 3. Send via Expo Push API
        const messages = tokens.map((t) => ({
            to: t.expo_push_token,
            sound: 'default' as const,
            title: params.title,
            body: params.body,
            data: params.data ?? {},
        }))

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        })

        if (!response.ok) {
            console.error('[push-notifications] Expo API error:', response.status)
            return
        }

        const result = await response.json()
        const tickets = result.data ?? []

        // 4. Handle DeviceNotRegistered — mark tokens as inactive
        for (let i = 0; i < tickets.length; i++) {
            if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered') {
                await supabaseAdmin
                    .from('push_tokens')
                    .update({ active: false, updated_at: new Date().toISOString() })
                    .eq('id', tokens[i].id)
                console.log('[push-notifications] Token deactivated:', tokens[i].expo_push_token)
            }
        }

        // Save tickets for receipt checking
        const ticketRows = tickets
            .map((ticket: any, i: number) => {
                if (ticket.status === 'ok' && ticket.id) {
                    return {
                        ticket_id: ticket.id,
                        push_token_id: tokens[i].id,
                        user_id: params.trainerId,
                        role: 'trainer',
                        notification_id: params.notificationId ?? null,
                    }
                }
                return null
            })
            .filter(Boolean)

        if (ticketRows.length > 0) {
            await supabaseAdmin.from('push_tickets').insert(ticketRows)
        }

        // 5. Mark push_sent_at so flush/cron won't re-send
        if (params.notificationId) {
            await supabaseAdmin
                .from('trainer_notifications')
                .update({ push_sent_at: new Date().toISOString() })
                .eq('id', params.notificationId)
        }
    } catch (err) {
        console.error('[push-notifications] Unexpected error:', err)
    }
}

// ---------------------------------------------------------------------------
// Student push
// ---------------------------------------------------------------------------

interface SendStudentPushParams {
    studentId: string
    title: string
    body: string
    data?: Record<string, string>
    /** When provided, marks push_sent_at on this student_inbox_items row after successful send. */
    inboxItemId?: string
}

/**
 * Send push notification to a student's registered devices.
 * Non-blocking — never throws.
 */
export async function sendStudentPush(params: SendStudentPushParams): Promise<void> {
    try {
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('auth_user_id, notification_preferences')
            .eq('id', params.studentId)
            .single()

        if (!student?.auth_user_id) return

        // Check student notification preferences (null = all enabled)
        const prefs = student.notification_preferences as { push_enabled?: boolean; categories?: Record<string, boolean> } | null
        if (prefs) {
            if (prefs.push_enabled === false) return
            const notifType = params.data?.type
            if (notifType && prefs.categories?.[notifType] === false) return
        }

        const { data: tokens } = await supabaseAdmin
            .from('push_tokens')
            .select('id, expo_push_token')
            .eq('user_id', student.auth_user_id)
            .eq('role', 'student')
            .eq('active', true)

        if (!tokens || tokens.length === 0) return

        const messages = tokens.map((t) => ({
            to: t.expo_push_token,
            sound: 'default' as const,
            title: params.title,
            body: params.body,
            data: params.data ?? {},
        }))

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        })

        if (!response.ok) {
            console.error('[push-notifications] Expo API error (student):', response.status)
            return
        }

        const result = await response.json()
        const tickets = result.data ?? []

        for (let i = 0; i < tickets.length; i++) {
            if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered') {
                await supabaseAdmin
                    .from('push_tokens')
                    .update({ active: false, updated_at: new Date().toISOString() })
                    .eq('id', tokens[i].id)
            }
        }

        // Save tickets for receipt checking
        const ticketRows = tickets
            .map((ticket: any, i: number) => {
                if (ticket.status === 'ok' && ticket.id) {
                    return {
                        ticket_id: ticket.id,
                        push_token_id: tokens[i].id,
                        user_id: student.auth_user_id,
                        role: 'student',
                        notification_id: params.inboxItemId ?? null,
                    }
                }
                return null
            })
            .filter(Boolean)

        if (ticketRows.length > 0) {
            await supabaseAdmin.from('push_tickets').insert(ticketRows)
        }

        // Mark push_sent_at so flush/cron won't re-send
        if (params.inboxItemId) {
            await supabaseAdmin
                .from('student_inbox_items')
                .update({ push_sent_at: new Date().toISOString() })
                .eq('id', params.inboxItemId)
        }
    } catch (err) {
        console.error('[push-notifications] Student push error:', err)
    }
}

/**
 * Process pending student inbox items and send push notifications.
 */
export async function processStudentPendingPush(studentId?: string): Promise<number> {
    let query = supabaseAdmin
        .from('student_inbox_items')
        .select('id, student_id, type, title, subtitle, payload')
        .is('push_sent_at', null)
        .in('status', ['unread', 'pending_action'])
        .order('created_at', { ascending: true })
        .limit(50)

    if (studentId) {
        query = query.eq('student_id', studentId)
    }

    const { data: pending } = await query

    if (!pending || pending.length === 0) return 0

    let sent = 0

    for (const item of pending) {
        await sendStudentPush({
            studentId: item.student_id,
            title: item.title,
            body: item.subtitle ?? '',
            inboxItemId: item.id,
            data: {
                notificationId: item.id,
                type: item.type,
                ...(item.payload as Record<string, string> ?? {}),
            },
        })

        sent++
    }

    return sent
}

// ---------------------------------------------------------------------------
// Trainer push processing
// ---------------------------------------------------------------------------

/**
 * Process pending notifications for a trainer and send push.
 * Used by flush-pending API route and process-push CRON.
 */
export async function processPendingPush(trainerId?: string): Promise<number> {
    let query = supabaseAdmin
        .from('trainer_notifications')
        .select('id, trainer_id, type, title, body, data')
        .eq('is_read', false)
        .order('created_at', { ascending: true })
        .limit(50)

    if (trainerId) {
        query = query.eq('trainer_id', trainerId)
    }

    const { data: pending } = await query

    if (!pending || pending.length === 0) return 0

    // Group by trainer
    const byTrainer = new Map<string, typeof pending>()
    for (const notif of pending) {
        const list = byTrainer.get(notif.trainer_id) ?? []
        list.push(notif)
        byTrainer.set(notif.trainer_id, list)
    }

    let sent = 0

    for (const [tId, notifs] of byTrainer) {
        for (const notif of notifs) {
            await sendTrainerPush({
                trainerId: tId,
                type: notif.type,
                title: notif.title,
                body: notif.body,
                notificationId: notif.id,
                data: {
                    notificationId: notif.id,
                    ...(notif.data as Record<string, string> ?? {}),
                },
            })

            sent++
        }
    }

    return sent
}
