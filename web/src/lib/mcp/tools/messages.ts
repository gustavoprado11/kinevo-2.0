import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'
import { mcpSuccess, mcpError } from '../types'

export function registerMessageWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_send_message',
    "Send a text message to a student. The message appears in the student's Kinevo app inbox.",
    {
      student_id: z.string().uuid().describe("The student's UUID"),
      content: z.string().min(1).max(2000).describe('Message text content'),
    },
    { title: 'Enviar mensagem', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ student_id, content }) => {
      const supabaseAdmin = createAdminClient()

      // 1. Verify student belongs to trainer & get trainer info
      const [studentResult, trainerResult] = await Promise.all([
        supabaseAdmin
          .from('students')
          .select('id')
          .eq('id', student_id)
          .eq('coach_id', trainerId)
          .single(),
        supabaseAdmin
          .from('trainers')
          .select('auth_user_id, name')
          .eq('id', trainerId)
          .single(),
      ])

      if (!studentResult.data) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }
      if (!trainerResult.data) {
        return mcpError('Treinador não encontrado.')
      }

      const trainerName = trainerResult.data.name
      const trainerAuthId = trainerResult.data.auth_user_id

      // 2. Insert message
      const { data: msg, error } = await supabaseAdmin
        .from('messages')
        .insert({
          student_id,
          sender_type: 'trainer',
          sender_id: trainerAuthId,
          content,
        })
        .select('id, content, created_at')
        .single()

      if (error || !msg) {
        return mcpError(`Erro ao enviar mensagem: ${error?.message ?? 'desconhecido'}`)
      }

      // 3. Create inbox item + push notification (fire-and-forget)
      const preview = content.length > 100 ? content.slice(0, 100) + '...' : content

      insertStudentNotification({
        studentId: student_id,
        trainerId,
        type: 'text_message',
        title: `Nova mensagem de ${trainerName}`,
        subtitle: preview,
        payload: { trainer_id: trainerId, trainer_name: trainerName },
      }).then((inboxItemId) => {
        sendStudentPush({
          studentId: student_id,
          title: `Nova mensagem de ${trainerName}`,
          body: preview,
          inboxItemId: inboxItemId ?? undefined,
          data: { type: 'text_message', trainer_id: trainerId, trainer_name: trainerName },
        }).catch(() => {})
      })

      return mcpSuccess({
        message: { id: msg.id, content: msg.content, created_at: msg.created_at },
        status: 'sent',
      })
    }
  )
}
