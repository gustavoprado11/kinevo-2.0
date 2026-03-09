import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/trainer-notifications/mark-read
 * Marks notifications as read. Body: { ids: string[] } or { all: true }
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    let body: { ids?: string[]; all?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    if (body.all) {
        const { error } = await supabase
            .from('trainer_notifications')
            .update({ read: true })
            .eq('trainer_id', trainer.id)
            .eq('read', false)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (body.ids && body.ids.length > 0) {
        const { error } = await supabase
            .from('trainer_notifications')
            .update({ read: true })
            .eq('trainer_id', trainer.id)
            .in('id', body.ids)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
