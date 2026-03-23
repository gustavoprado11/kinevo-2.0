import { NextRequest, NextResponse } from 'next/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { updateTrainerNotes } from '@/lib/reports/program-report-service'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: reportId } = await params
        await getTrainerWithSubscription()
        const supabase = await createClient()

        const body = await request.json()
        const notes = typeof body.notes === 'string' ? body.notes : ''

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
