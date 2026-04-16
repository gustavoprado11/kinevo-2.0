import { NextRequest, NextResponse } from 'next/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { updateTrainerNotes } from '@/lib/reports/program-report-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_NOTES_LEN = 10_000

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: reportId } = await params
        if (!UUID_RE.test(reportId)) {
            return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
        }

        const { trainer } = await getTrainerWithSubscription()
        const supabase = await createClient()

        // Explicit ownership check — do not rely solely on RLS.
        // The audit flagged this as an IDOR: a malicious trainer could PATCH
        // notes on another trainer's report if the program_reports RLS policy
        // regresses. This explicit gate also lets us sanitize the notes
        // payload consistently.
        const { data: report } = await supabase
            .from('program_reports')
            .select('id, trainer_id')
            .eq('id', reportId)
            .eq('trainer_id', trainer.id)
            .maybeSingle()

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 })
        }

        const body = await request.json()
        const rawNotes = typeof body.notes === 'string' ? body.notes : ''
        // Cap length; rendering sanitization belongs at the view layer, but
        // truncating here prevents DoS via giant payloads hitting the DB.
        const notes = rawNotes.slice(0, MAX_NOTES_LEN)

        const success = await updateTrainerNotes(supabase, reportId, notes)

        if (!success) {
            return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[report-notes] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
