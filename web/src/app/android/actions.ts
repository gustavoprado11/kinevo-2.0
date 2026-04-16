'use server'

import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

type Result =
    | { status: 'success' }
    | { status: 'duplicate' }
    | { status: 'error'; message: string }

const GOOGLE_EMAIL_RE = /^[^\s@]+@(gmail\.com|googlemail\.com)$/i

// This Server Action is public (no auth). Abuse is prevented by rate-limiting
// per source IP. TODO: add Cloudflare Turnstile or similar before allowing
// higher throughput — current caps assume low legitimate volume.
const PER_IP_LIMITS = { perMinute: 3, perDay: 10 }
const GLOBAL_LIMITS = { perMinute: 30, perDay: 500 }

export async function submitAndroidTester(
    email: string,
    studentName?: string,
): Promise<Result> {
    // Rate limit by IP (primary) and global (defense against IP rotation).
    const headerStore = await headers()
    const ip = (headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headerStore.get('x-real-ip')
        || 'unknown').slice(0, 64)
    const ipKey = `android-tester:ip:${ip}`
    const ipLimit = checkRateLimit(ipKey, PER_IP_LIMITS)
    if (!ipLimit.allowed) {
        return { status: 'error', message: 'Muitas tentativas. Tente novamente mais tarde.' }
    }
    const globalLimit = checkRateLimit('android-tester:global', GLOBAL_LIMITS)
    if (!globalLimit.allowed) {
        return { status: 'error', message: 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.' }
    }
    recordRequest(ipKey)
    recordRequest('android-tester:global')

    const trimmedEmail = email.trim().toLowerCase()

    if (!GOOGLE_EMAIL_RE.test(trimmedEmail)) {
        return { status: 'error', message: 'O e-mail precisa ser @gmail.com ou @googlemail.com.' }
    }

    // Cap name length to prevent payload amplification in push notifications.
    const safeStudentName = studentName?.trim().slice(0, 80) || null

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
            student_name: safeStudentName,
        })

    if (error) {
        console.error('[android-tester] Insert error:', error.message)
        return { status: 'error', message: 'Erro ao cadastrar. Tente novamente.' }
    }

    // Notify admin via push (non-blocking)
    const adminCoachId = process.env.ADMIN_COACH_ID
    if (adminCoachId) {
        const nameLabel = safeStudentName ? ` | Nome: ${safeStudentName}` : ''
        const body = `Email: ${trimmedEmail}${nameLabel}. Adicione no Google Play Console.`

        const notifId = await insertTrainerNotification({
            trainerId: adminCoachId,
            type: 'android_tester',
            title: 'Novo tester Android',
            message: body,
            metadata: { email: trimmedEmail, student_name: safeStudentName ?? '' },
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
