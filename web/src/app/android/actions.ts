'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

type Result =
    | { status: 'success' }
    | { status: 'duplicate' }
    | { status: 'error'; message: string }

const GOOGLE_EMAIL_RE = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i

export async function submitAndroidTester(
    email: string,
    studentName?: string,
): Promise<Result> {
    const trimmedEmail = email.trim().toLowerCase()

    if (!GOOGLE_EMAIL_RE.test(trimmedEmail)) {
        return { status: 'error', message: 'O e-mail precisa ser @gmail.com ou @googlemail.com.' }
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
        .from('android_tester_queue')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle()

    if (existing) {
        return { status: 'duplicate' }
    }

    // Insert into queue
    const { error } = await supabaseAdmin
        .from('android_tester_queue')
        .insert({
            email: trimmedEmail,
            student_name: studentName?.trim() || null,
        })

    if (error) {
        console.error('[android-tester] Insert error:', error.message)
        return { status: 'error', message: 'Erro ao cadastrar. Tente novamente.' }
    }

    // Notify admin via push (non-blocking)
    const adminCoachId = process.env.ADMIN_COACH_ID
    if (adminCoachId) {
        const nameLabel = studentName?.trim() ? ` | Nome: ${studentName.trim()}` : ''
        const body = `Email: ${trimmedEmail}${nameLabel}. Adicione no Google Play Console.`

        const notifId = await insertTrainerNotification({
            trainerId: adminCoachId,
            type: 'android_tester',
            title: 'Novo tester Android',
            message: body,
            metadata: { email: trimmedEmail, student_name: studentName?.trim() ?? '' },
        })

        await sendTrainerPush({
            trainerId: adminCoachId,
            type: 'android_tester',
            title: 'Novo tester Android',
            body,
            notificationId: notifId ?? undefined,
        })
    }

    return { status: 'success' }
}
