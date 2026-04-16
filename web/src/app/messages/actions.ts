'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendStudentPush } from '@/lib/push-notifications'
import type { Message, Conversation } from '@/types/messages'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedTrainer() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, auth_user_id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return null
    return { user, trainer, supabase }
}

// ---------------------------------------------------------------------------
// getTotalUnreadCount (lightweight — for sidebar badge)
// ---------------------------------------------------------------------------

export async function getTotalUnreadCount(): Promise<number> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return 0

    // First fetch student IDs, then query messages (Supabase JS doesn't support inline subqueries in .in())
    const { data: students } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('coach_id', auth.trainer.id)

    if (!students?.length) return 0

    const { count, error } = await supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'student')
        .is('read_at', null)
        .in('student_id', students.map(s => s.id))

    if (error) {
        console.error('[getTotalUnreadCount] Error:', error)
        return 0
    }

    return count ?? 0
}

// ---------------------------------------------------------------------------
// getConversations
// ---------------------------------------------------------------------------

export async function getConversations(): Promise<Conversation[]> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return []

    // Get all students that have at least one message, with last message + unread count.
    // Using supabaseAdmin to avoid RLS overhead on the aggregation query.
    const { data: rows, error } = await supabaseAdmin.rpc('get_trainer_conversations' as any, {
        p_trainer_id: auth.trainer.id,
    })

    // Fallback: if RPC doesn't exist yet, do it with raw queries
    if (error) {
        // Get students with messages
        const { data: students } = await supabaseAdmin
            .from('students')
            .select('id, name, avatar_url, status')
            .eq('coach_id', auth.trainer.id)
            .eq('status', 'active')

        if (!students?.length) return []

        const studentIds = students.map(s => s.id)

        // Get last message per student
        const { data: messages } = await supabaseAdmin
            .from('messages')
            .select('student_id, content, image_url, sender_type, created_at')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false })

        // Get unread counts (messages from student that trainer hasn't read)
        const { data: unreadRows } = await supabaseAdmin
            .from('messages')
            .select('student_id')
            .in('student_id', studentIds)
            .eq('sender_type', 'student')
            .is('read_at', null)

        // Build maps
        const lastMessageMap = new Map<string, { content: string | null; image_url: string | null; sender_type: string; created_at: string }>()
        for (const m of messages || []) {
            if (!lastMessageMap.has(m.student_id)) {
                lastMessageMap.set(m.student_id, m)
            }
        }

        const unreadCountMap = new Map<string, number>()
        for (const r of unreadRows || []) {
            unreadCountMap.set(r.student_id, (unreadCountMap.get(r.student_id) || 0) + 1)
        }

        // Include ALL active students — those with messages first (by recency), then without (alphabetically)
        const withMessages: Conversation[] = []
        const withoutMessages: Conversation[] = []

        for (const s of students) {
            const last = lastMessageMap.get(s.id)
            const conv: Conversation = {
                student: {
                    id: s.id,
                    name: s.name,
                    avatar_url: s.avatar_url,
                    status: s.status,
                },
                lastMessage: last ? {
                    content: last.content,
                    image_url: last.image_url,
                    sender_type: last.sender_type as 'trainer' | 'student',
                    created_at: last.created_at,
                } : null,
                unreadCount: unreadCountMap.get(s.id) || 0,
            }

            if (last) {
                withMessages.push(conv)
            } else {
                withoutMessages.push(conv)
            }
        }

        // With messages: most recent first; without: alphabetical
        withMessages.sort((a, b) => {
            const aTime = a.lastMessage?.created_at ?? ''
            const bTime = b.lastMessage?.created_at ?? ''
            return bTime.localeCompare(aTime)
        })
        withoutMessages.sort((a, b) => a.student.name.localeCompare(b.student.name))

        return [...withMessages, ...withoutMessages]
    }

    return rows as Conversation[]
}

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

export async function getMessages(
    studentId: string,
    cursor?: string,
    limit = 50,
): Promise<{ messages: Message[]; hasMore: boolean }> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return { messages: [], hasMore: false }

    // Verify student belongs to this trainer
    const { data: student } = await auth.supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('coach_id', auth.trainer.id)
        .maybeSingle()

    if (!student) return { messages: [], hasMore: false }

    let query = auth.supabase
        .from('messages')
        .select('id, student_id, sender_type, sender_id, content, image_url, read_at, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit + 1) // Fetch one extra to detect hasMore

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error || !data) return { messages: [], hasMore: false }

    const hasMore = data.length > limit
    const messages = (hasMore ? data.slice(0, limit) : data).reverse() as Message[] // ASC order for chat

    return { messages, hasMore }
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
    studentId: string,
    formData: FormData,
): Promise<{ success: boolean; message?: Message; error?: string }> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return { success: false, error: 'Sessão inválida.' }

    const content = (formData.get('content') as string)?.trim() || null
    const file = formData.get('image')

    if (!content && !(file instanceof File && file.size > 0)) {
        return { success: false, error: 'Envie uma mensagem ou imagem.' }
    }

    // Verify student belongs to this trainer
    const { data: student } = await auth.supabase
        .from('students')
        .select('id, name')
        .eq('id', studentId)
        .eq('coach_id', auth.trainer.id)
        .maybeSingle()

    if (!student) return { success: false, error: 'Aluno não encontrado.' }

    // Handle image upload
    let imageUrl: string | null = null
    if (file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_SIZE) {
            return { success: false, error: 'Imagem muito grande. Máximo 5MB.' }
        }

        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
            return { success: false, error: 'Formato não suportado. Use JPG, PNG, WebP ou GIF.' }
        }

        // Never interpolate file.name directly — a name like
        // "../other-student/shell.jpg" could escape the path prefix used by
        // the storage RLS policy. Use a server-generated random name instead.
        const filePath = `${studentId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await auth.supabase.storage
            .from('messages')
            .upload(filePath, file, {
                upsert: false,
                contentType: ALLOWED_CONTENT_TYPES[ext],
            })

        if (uploadError) {
            console.error('[sendMessage] Upload error:', uploadError)
            return { success: false, error: 'Falha no upload da imagem.' }
        }

        const { data: publicData } = auth.supabase.storage.from('messages').getPublicUrl(filePath)
        imageUrl = publicData.publicUrl
    }

    // Insert message
    const { data: msg, error: insertError } = await auth.supabase
        .from('messages')
        .insert({
            student_id: studentId,
            sender_type: 'trainer',
            sender_id: auth.user.id,
            content,
            image_url: imageUrl,
        })
        .select()
        .single()

    if (insertError || !msg) {
        console.error('[sendMessage] Insert error:', insertError)
        return { success: false, error: 'Erro ao enviar mensagem.' }
    }

    // Send push notification to student (non-blocking)
    const pushBody = content
        ? (content.length > 100 ? content.slice(0, 100) + '...' : content)
        : 'Enviou uma imagem'

    sendStudentPush({
        studentId,
        title: auth.trainer.name,
        body: pushBody,
        data: { type: 'message', studentId },
    }).catch((err) => {
        console.error('[sendMessage] Push notification failed:', err)
    })

    return { success: true, message: msg as Message }
}

// ---------------------------------------------------------------------------
// markMessagesAsRead
// ---------------------------------------------------------------------------

export async function markMessagesAsRead(studentId: string): Promise<void> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return

    await auth.supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('sender_type', 'student')
        .is('read_at', null)
}
