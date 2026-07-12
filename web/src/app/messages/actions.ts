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

/** Linha da RPC get_trainer_conversations (migration 244) — fora dos tipos gerados. */
interface ConversationSummaryRow {
    student_id: string
    student_name: string
    avatar_url: string | null
    student_status: string
    last_content: string | null
    last_image_url: string | null
    last_sender_type: string | null
    last_created_at: string | null
    unread_count: number | null
}

export async function getConversations(
    includeArchived = false,
): Promise<Conversation[]> {
    const auth = await getAuthenticatedTrainer()
    if (!auth) return []

    // PF3: agregação no BANCO (migrations 244/245). Antes baixávamos TODAS as
    // mensagens de todos os alunos, sem limit, só pra achar a última por
    // aluno — payload O(histórico) a cada abertura E a cada INSERT realtime,
    // com preview errado acima do cap de 1000 linhas do PostgREST.
    // D4: pending entra sempre; arquivados sob demanda.
    const { data, error } = await supabaseAdmin.rpc(
        'get_trainer_conversations' as never,
        {
            p_trainer_id: auth.trainer.id,
            p_include_archived: includeArchived,
        } as never,
    )

    if (error) {
        console.error('[getConversations] RPC error:', error)
        return []
    }

    const rows = (data ?? []) as unknown as ConversationSummaryRow[]
    // A RPC já ordena: com mensagens por recência, depois sem mensagens por nome.
    return rows.map((r) => ({
        student: {
            id: r.student_id,
            name: r.student_name,
            avatar_url: r.avatar_url,
            status: r.student_status,
        },
        lastMessage: r.last_created_at
            ? {
                content: r.last_content,
                image_url: r.last_image_url,
                sender_type: (r.last_sender_type ?? 'student') as 'trainer' | 'student',
                created_at: r.last_created_at,
            }
            : null,
        unreadCount: r.unread_count ?? 0,
    }))
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
        .select('id, student_id, sender_type, sender_id, content, image_url, image_path, read_at, created_at')
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
    let imagePath: string | null = null
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
        // Dual-write the storage path (A2): source of truth for future signed URLs.
        imagePath = filePath
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
            image_path: imagePath,
        })
        .select()
        .single()

    if (insertError || !msg) {
        console.error('[sendMessage] Insert error:', insertError)
        // A imagem já subiu mas a mensagem não existe — remove o objeto órfão
        // (o retry gera outro nome e deixaria lixo acumulando no bucket).
        if (imagePath) {
            await auth.supabase.storage.from('messages').remove([imagePath]).catch(() => {})
        }
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
