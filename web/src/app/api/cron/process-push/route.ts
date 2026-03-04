import { NextRequest, NextResponse } from 'next/server'
import { processPendingPush } from '@/lib/push-notifications'

/**
 * GET /api/cron/process-push
 * Daily safety net — processes any pending push notifications that weren't
 * flushed by the mobile app's flush-pending calls.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const sent = await processPendingPush()
        console.log(`[cron:process-push] Sent ${sent} pending push notifications`)
        return NextResponse.json({ sent })
    } catch (err) {
        console.error('[cron:process-push] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
