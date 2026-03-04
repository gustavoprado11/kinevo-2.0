import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    let body: { expoPushToken?: string; role?: string; platform?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { expoPushToken, role = 'trainer', platform = 'ios' } = body
    if (!expoPushToken) {
        return NextResponse.json({ error: 'expoPushToken é obrigatório' }, { status: 400 })
    }

    if (!['trainer', 'student'].includes(role)) {
        return NextResponse.json({ error: 'role inválido' }, { status: 400 })
    }

    // Get trainer_id if role is trainer
    let trainerId: string | null = null
    if (role === 'trainer') {
        const { data: trainer } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        trainerId = trainer?.id ?? null
    }

    // Upsert token (idempotent — UNIQUE on user_id + role + expo_push_token)
    const { error } = await supabaseAdmin
        .from('push_tokens')
        .upsert(
            {
                user_id: user.id,
                trainer_id: trainerId,
                role,
                expo_push_token: expoPushToken,
                platform,
                active: true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,role,expo_push_token' }
        )

    if (error) {
        console.error('[register-token] Upsert error:', error.message)
        return NextResponse.json({ error: 'Erro ao registrar token' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
