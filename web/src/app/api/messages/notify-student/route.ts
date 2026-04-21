import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mirror of notify-trainer but in the reverse direction: trainer → student push.
// Intentional asymmetries vs. notify-trainer (documented in 2.5.3 §2):
//   - Uses `insertStudentNotification` → `student_inbox_items` table.
//   - Uses the `text_message` enum value (only fit in student inbox enum).
//   - Passes `type` inside `data` (sendStudentPush reads it from data.type).
export async function POST(request: NextRequest) {
    try {
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
        if (!studentId || typeof studentId !== 'string' || !UUID_RE.test(studentId)) {
            return NextResponse.json({ error: 'studentId required' }, { status: 400 })
        }

        const rateLimitKey = `messages:notify-student:${user.id}`
        const limit = checkRateLimit(rateLimitKey, { perMinute: 20, perDay: 500 })
        if (!limit.allowed) {
            return NextResponse.json({ error: limit.error || 'Rate limit exceeded' }, { status: 429 })
        }
        recordRequest(rateLimitKey)

        // Verify the authenticated user is a trainer
        const { data: trainer } = await supabaseAdmin
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return NextResponse.json({ error: 'Trainer not found' }, { status: 403 })
        }

        // Ownership: student must be coached by this trainer
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 403 })
        }

        const trainerName = trainer.name || 'seu treinador'
        const preview = messageContent
            ? (messageContent.length > 100 ? messageContent.slice(0, 100) + '...' : messageContent)
            : 'Enviou uma imagem'

        const subtitle = `${trainerName}: ${preview}`

        const inboxItemId = await insertStudentNotification({
            studentId,
            trainerId: trainer.id,
            type: 'text_message',
            title: `Nova mensagem de ${trainerName}`,
            subtitle,
            payload: { trainer_id: trainer.id, trainer_name: trainerName },
        })

        await sendStudentPush({
            studentId,
            title: `Nova mensagem de ${trainerName}`,
            body: preview,
            inboxItemId: inboxItemId ?? undefined,
            data: { type: 'text_message', trainer_id: trainer.id, trainer_name: trainerName },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[notify-student] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
