import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'
import { consumeRateLimit } from '@/lib/rate-limit'
import { mcpSuccess, mcpError } from '../types'

// Teto POR CHAMADA do lote de mensagens (mesma filosofia do MAX_FORM_STUDENTS_PER_CALL
// em forms.ts: acima de qualquer roster real, mas limita chamada injetada/errônea).
export const MAX_BATCH_MESSAGE_STUDENTS = 100
export const batchStudentIdsSchema = z
  .array(z.string().uuid())
  .min(2)
  .max(MAX_BATCH_MESSAGE_STUDENTS)

// Teto DIÁRIO por treinador de lotes no caminho MCP CRU (claude.ai/API key) —
// o caminho in-app já tem limitSensitive; aqui fechamos o gap contra um loop de
// injeção disparando mensagens em massa.
const BATCH_MESSAGE_LIMIT = { perMinute: 5, perDay: 40 } as const
const batchMessageKey = (trainerId: string) => `mcp:msg_batch:${trainerId}`

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

  server.tool(
    'kinevo_send_message_batch',
    "Send the SAME text message to SEVERAL students at once (e.g. \"avisa todo mundo que amanhã não tem treino\", all inactive students, a group). ONE aggregated confirmation instead of N — prefer this over calling kinevo_send_message repeatedly. For a single student use kinevo_send_message. Resolve the ids first via kinevo_list_students; every id must belong to this trainer.",
    {
      student_ids: batchStudentIdsSchema.describe('The students to message (2 to 100 ids, from kinevo_list_students).'),
      content: z.string().min(1).max(2000).describe('The message text sent to each student.'),
    },
    { title: 'Enviar mensagem a vários alunos', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ student_ids, content }) => {
      const rl = await consumeRateLimit(batchMessageKey(trainerId), BATCH_MESSAGE_LIMIT)
      if (!rl.allowed) return mcpError(rl.error ?? 'Limite de envio em lote atingido.')

      const supabaseAdmin = createAdminClient()
      const uniqueIds = Array.from(new Set(student_ids))

      // Posse de TODOS os alunos numa query só; qualquer id estranho aborta o lote.
      const [{ data: students }, { data: trainer }] = await Promise.all([
        supabaseAdmin
          .from('students')
          .select('id, name')
          .in('id', uniqueIds)
          .eq('coach_id', trainerId),
        supabaseAdmin
          .from('trainers')
          .select('auth_user_id, name')
          .eq('id', trainerId)
          .single(),
      ])
      if (!trainer) return mcpError('Treinador não encontrado.')
      const foundIds = new Set((students ?? []).map((s) => s.id))
      const missing = uniqueIds.filter((id) => !foundIds.has(id))
      if (missing.length > 0) {
        return mcpError(`${missing.length} id(s) não pertence(m) a este treinador — lote abortado. Confira com kinevo_list_students.`)
      }

      const { data: inserted, error } = await supabaseAdmin
        .from('messages')
        .insert(
          uniqueIds.map((student_id) => ({
            student_id,
            sender_type: 'trainer',
            sender_id: trainer.auth_user_id,
            content,
          })),
        )
        .select('id, student_id')
      if (error) return mcpError(`Erro ao enviar lote: ${error.message}`)

      // Inbox + push por aluno (fire-and-forget, mesmo padrão do envio unitário).
      const preview = content.length > 100 ? content.slice(0, 100) + '...' : content
      for (const student_id of uniqueIds) {
        insertStudentNotification({
          studentId: student_id,
          trainerId,
          type: 'text_message',
          title: `Nova mensagem de ${trainer.name}`,
          subtitle: preview,
          payload: { trainer_id: trainerId, trainer_name: trainer.name },
        }).then((inboxItemId) => {
          sendStudentPush({
            studentId: student_id,
            title: `Nova mensagem de ${trainer.name}`,
            body: preview,
            inboxItemId: inboxItemId ?? undefined,
            data: { type: 'text_message', trainer_id: trainerId, trainer_name: trainer.name },
          }).catch(() => {})
        }).catch(() => {})
      }

      return mcpSuccess({
        sent_count: inserted?.length ?? uniqueIds.length,
        students: (students ?? []).map((s) => ({ id: s.id, name: s.name })),
        status: 'sent',
        message: `Mensagem enviada para ${inserted?.length ?? uniqueIds.length} aluno(s).`,
      })
    }
  )
}
