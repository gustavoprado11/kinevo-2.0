import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/trainer-notifications
 * Returns the trainer's recent notifications (last 20, newest first).
 */
export async function GET() {
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

    const { data: notifications, error } = await supabase
        .from('trainer_notifications')
        .select('id, type, title, body, is_read, data, category, created_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('[trainer-notifications] Fetch error:', error)
        return NextResponse.json({ error: 'Erro ao carregar notificações.' }, { status: 500 })
    }

    const unreadCount = notifications?.filter(n => !n.is_read).length ?? 0

    return NextResponse.json({ notifications: notifications ?? [], unreadCount })
}
