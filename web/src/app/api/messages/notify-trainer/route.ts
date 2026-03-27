import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export async function POST(request: NextRequest) {
    try {
        // Verify auth from Bearer token
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.slice(7)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { studentId, messageContent } = await request.json()
        if (!studentId || typeof studentId !== 'string') {
            return NextResponse.json({ error: 'studentId required' }, { status: 400 })
        }

        // Verify this user is the student
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, name, coach_id')
            .eq('id', studentId)
            .eq('auth_user_id', user.id)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 403 })
        }

        // Get trainer id (trainers.id, not auth_user_id)
        const trainerId = student.coach_id

        const preview = messageContent
            ? (messageContent.length > 100 ? messageContent.slice(0, 100) + '...' : messageContent)
            : 'Enviou uma imagem'

        const body = `${student.name}: ${preview}`

        // Insert notification + send push (non-blocking pattern)
        const notifId = await insertTrainerNotification({
            trainerId,
            type: 'student_message',
            title: `Nova mensagem de ${student.name}`,
            message: body,
            metadata: { student_id: studentId, student_name: student.name },
        })

        await sendTrainerPush({
            trainerId,
            type: 'student_message',
            title: `Nova mensagem de ${student.name}`,
            body: preview,
            notificationId: notifId ?? undefined,
            data: { studentId, type: 'student_message' },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[notify-trainer] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
