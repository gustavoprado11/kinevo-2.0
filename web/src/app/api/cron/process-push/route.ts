import { NextRequest, NextResponse } from 'next/server'
import { processPendingPush, processStudentPendingPush } from '@/lib/push-notifications'

/**
 * GET /api/cron/process-push
 * Daily safety net — processes any pending push notifications that weren't
 * flushed by the mobile app's flush-pending calls.
 * Handles both trainer and student notifications.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const [trainerSent, studentSent] = await Promise.all([
            processPendingPush(),
            processStudentPendingPush(),
        ])
        console.log(`[cron:process-push] Sent ${trainerSent} trainer + ${studentSent} student push notifications`)
        return NextResponse.json({ trainerSent, studentSent })
    } catch (err) {
        console.error('[cron:process-push] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
