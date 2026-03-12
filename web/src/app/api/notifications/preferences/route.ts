import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getTrainerFromToken(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null

    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id, notification_preferences')
        .eq('auth_user_id', user.id)
        .single()

    return trainer
}

export async function GET(request: NextRequest) {
    const trainer = await getTrainerFromToken(request)
    if (!trainer) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    return NextResponse.json({
        preferences: trainer.notification_preferences ?? {
            workout_completed: true,
            form_submitted: true,
            payment_received: true,
            payment_overdue: true,
            program_expiring: true,
            student_inactive: true,
        },
    })
}

export async function PUT(request: NextRequest) {
    const trainer = await getTrainerFromToken(request)
    if (!trainer) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let body: { preferences?: Record<string, boolean> }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    if (!body.preferences || typeof body.preferences !== 'object') {
        return NextResponse.json({ error: 'preferences é obrigatório' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
        .from('trainers')
        .update({ notification_preferences: body.preferences })
        .eq('id', trainer.id)

    if (error) {
        console.error('[preferences] Update error:', error.message)
        return NextResponse.json({ error: 'Erro ao atualizar preferências' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
