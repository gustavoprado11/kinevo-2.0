import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { processStudentPendingPush } from '@/lib/push-notifications'

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

    // Get student
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (!student) {
        return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    try {
        const sent = await processStudentPendingPush(student.id)
        return NextResponse.json({ success: true, sent })
    } catch (err) {
        console.error('[flush-student-pending] Error:', err)
        return NextResponse.json({ error: 'Erro ao processar notificações' }, { status: 500 })
    }
}
