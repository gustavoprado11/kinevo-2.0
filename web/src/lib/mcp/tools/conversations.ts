import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerConversationReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_conversations',
    "List the trainer's conversations with students, ordered by most recent message. Shows unread count for each conversation.",
    {
      limit: z.number().min(1).max(50).default(20),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ limit }) => {
      const supabaseAdmin = createAdminClient()

      // 1. Active students
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainerId)
        .eq('status', 'active')

      if (!students || students.length === 0) {
        return mcpSuccess({ conversations: [] })
      }

      const studentIds = students.map(s => s.id)

      // 2. All messages for these students (for last message + unread count)
      const [messagesResult, unreadResult] = await Promise.all([
        supabaseAdmin
          .from('messages')
          .select('student_id, content, sender_type, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('messages')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('sender_type', 'student')
          .is('read_at', null),
      ])

      // Group last message per student
      const lastMessageMap = new Map<string, { content: string | null; sender_type: string; created_at: string }>()
      for (const msg of messagesResult.data ?? []) {
        if (!lastMessageMap.has(msg.student_id)) {
          lastMessageMap.set(msg.student_id, {
            content: msg.content,
            sender_type: msg.sender_type,
            created_at: msg.created_at!,
          })
        }
      }

      // Count unread per student
      const unreadMap = new Map<string, number>()
      for (const msg of unreadResult.data ?? []) {
        unreadMap.set(msg.student_id, (unreadMap.get(msg.student_id) ?? 0) + 1)
      }

      // Build conversations
      const withMessages: Array<{
        student: { id: string; name: string; avatar_url: string | null }
        last_message: { content: string | null; sender_type: string; created_at: string }
        unread_count: number
      }> = []

      const withoutMessages: Array<{
        student: { id: string; name: string; avatar_url: string | null }
        last_message: null
        unread_count: number
      }> = []

      for (const s of students) {
        const lastMsg = lastMessageMap.get(s.id)
        const unread = unreadMap.get(s.id) ?? 0

        if (lastMsg) {
          withMessages.push({
            student: { id: s.id, name: s.name, avatar_url: s.avatar_url },
            last_message: lastMsg,
            unread_count: unread,
          })
        } else {
          withoutMessages.push({
            student: { id: s.id, name: s.name, avatar_url: s.avatar_url },
            last_message: null,
            unread_count: 0,
          })
        }
      }

      // Sort: with messages (most recent first), then without (alphabetical)
      withMessages.sort((a, b) =>
        b.last_message.created_at.localeCompare(a.last_message.created_at)
      )
      withoutMessages.sort((a, b) => a.student.name.localeCompare(b.student.name))

      const conversations = [...withMessages, ...withoutMessages].slice(0, limit)

      return mcpSuccess({ conversations })
    }
  )

  server.tool(
    'kinevo_get_conversation',
    'Get messages from a conversation with a specific student, ordered by most recent first.',
    {
      student_id: z.string().uuid().describe("The student's UUID"),
      limit: z.number().min(1).max(100).default(30),
      before: z.string().optional().describe('Fetch messages before this timestamp (for pagination)'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ student_id, limit, before }) => {
      const supabaseAdmin = createAdminClient()

      // Verify student belongs to trainer
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()

      if (!student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      let query = supabaseAdmin
        .from('messages')
        .select('id, sender_type, content, image_url, created_at, read_at')
        .eq('student_id', student_id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data: messages, error } = await query

      if (error) return mcpError(`Erro ao buscar mensagens: ${error.message}`)

      // Mark student messages as read (fire-and-forget)
      supabaseAdmin
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('student_id', student_id)
        .eq('sender_type', 'student')
        .is('read_at', null)
        .then()

      return mcpSuccess({
        student: { id: student.id, name: student.name },
        messages: messages ?? [],
      })
    }
  )
}
