import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { mcpSuccess, mcpError } from '../types'
import { assignFormCore } from '@/actions/forms/assign-form-core'
import {
  createFormSchedulesCore,
  getStudentFormSchedulesCore,
} from '@/actions/forms/form-schedules-core'

// Teto POR CHAMADA de student_ids: confortavelmente acima do maior roster real
// (14 em prod; p99 13) pra nunca barrar um envio legítimo "pra todo mundo", mas
// limitando uma chamada injetada/errônea a <=100 em vez de ilimitado. O teto
// DIÁRIO abaixo é que faz o trabalho de conter abuso. (student_ids já são
// validados como pertencentes ao treinador no core — o cap é blast da própria
// base, não cross-tenant.)
export const MAX_FORM_STUDENTS_PER_CALL = 100
export const studentIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(MAX_FORM_STUDENTS_PER_CALL)

// Teto DIÁRIO por treinador de envios de formulário no caminho MCP CRU
// (claude.ai / ChatGPT / API key). O caminho in-app já tem limitSensitive; aqui
// fechamos o gap do caminho cru contra um loop de injeção que dispara
// formulários em massa. send_form e schedule_form compartilham o mesmo balde
// (sem bypass alternando entre os dois).
const FORM_SEND_LIMIT = { perMinute: 10, perDay: 60 } as const
const formSendKey = (trainerId: string) => `mcp:form_send:${trainerId}`

export function registerFormWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_form_templates',
    "List the form/check-in/anamnese templates this trainer can send (the trainer's own templates plus Kinevo system templates). Call this to pick a template_id before sending with kinevo_send_form. To read what students have ANSWERED, use kinevo_get_form_responses instead.",
    {
      category: z.enum(['anamnese', 'checkin', 'survey', 'assessment', 'feedback']).optional().describe('Filter by template category'),
      limit: z.number().min(1).max(50).default(30),
    },
    { title: 'Listar templates de formulário', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ category, limit }) => {
      const supabaseAdmin = createAdminClient()

      let query = supabaseAdmin
        .from('form_templates')
        .select('id, title, category, version, trainer_id, is_active')
        .or(`trainer_id.eq.${trainerId},trainer_id.is.null`)
        .eq('is_active', true)
        .order('trainer_id', { ascending: true, nullsFirst: false })
        .limit(limit)

      if (category) query = query.eq('category', category)

      const { data, error } = await query
      if (error) return mcpError(`Erro ao listar templates: ${error.message}`)

      const templates = (data ?? []).map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        version: t.version,
        is_system: t.trainer_id === null,
      }))

      return mcpSuccess({
        templates,
        total: templates.length,
        message: `${templates.length} template(s) de formulário disponível(is).`,
      })
    }
  )

  server.tool(
    'kinevo_send_form',
    "Send a form/check-in/anamnese to one or more students. The form lands in each student's app inbox as a pending request and triggers a push notification. Pick template_id via kinevo_list_form_templates and student ids via kinevo_list_students. Students who already have this same form pending are skipped (no duplicate). Use for weekly check-ins, onboarding anamnese, periodic reassessments, etc.",
    {
      template_id: z.string().uuid().describe('The form template to send (from kinevo_list_form_templates)'),
      student_ids: studentIdsSchema.describe('One or more student IDs to send the form to (máx. 100 por chamada)'),
      due_at: z.string().optional().describe('Optional due date/time in ISO 8601 (e.g. 2026-06-20 or 2026-06-20T18:00:00Z). When the student should complete it.'),
      message: z.string().max(500).optional().describe('Optional custom message shown with the request (e.g. "Check-in da semana, responde aí 💪")'),
    },
    { title: 'Enviar formulário', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ template_id, student_ids, due_at, message }) => {
      const rl = await consumeRateLimit(formSendKey(trainerId), FORM_SEND_LIMIT)
      if (!rl.allowed) return mcpError(rl.error ?? 'Limite de envio de formulários atingido.')
      const supabaseAdmin = createAdminClient()
      const result = await assignFormCore(supabaseAdmin, trainerId, {
        formTemplateId: template_id,
        studentIds: student_ids,
        dueAt: due_at ?? null,
        message,
      })

      if (!result.success) return mcpError(result.error ?? 'Erro ao enviar formulário.')

      const sent = result.assignedCount ?? 0
      const skipped = result.skippedCount ?? 0
      return mcpSuccess({
        assigned_count: sent,
        skipped_count: skipped,
        message: `Formulário enviado para ${sent} aluno(s)${skipped > 0 ? `; ${skipped} pulado(s) (já tinham este formulário pendente)` : ''}. Os alunos foram notificados.`,
      })
    }
  )

  server.tool(
    'kinevo_schedule_form',
    "Set up a RECURRING form/check-in for one or more students: the form is sent automatically on each due date (the student is notified every time). Use for ongoing weekly check-ins, monthly reassessments, etc. For a ONE-OFF send, use kinevo_send_form instead. Pick template_id via kinevo_list_form_templates and student ids via kinevo_list_students. Confirm the frequency with the trainer before scheduling.",
    {
      template_id: z.string().uuid().describe('The form template to schedule (from kinevo_list_form_templates).'),
      student_ids: studentIdsSchema.describe('One or more student IDs to put on the recurring schedule (máx. 100 por chamada).'),
      frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).describe('How often the form repeats.'),
    },
    { title: 'Agendar formulário recorrente', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ template_id, student_ids, frequency }) => {
      const rl = await consumeRateLimit(formSendKey(trainerId), FORM_SEND_LIMIT)
      if (!rl.allowed) return mcpError(rl.error ?? 'Limite de envio de formulários atingido.')
      const supabaseAdmin = createAdminClient()
      const result = await createFormSchedulesCore(supabaseAdmin, trainerId, {
        formTemplateId: template_id,
        studentIds: student_ids,
        frequency,
      })

      if (!result.success) return mcpError(result.error ?? 'Erro ao agendar formulário.')

      return mcpSuccess({
        scheduled_count: result.count ?? 0,
        frequency,
        message: `Formulário agendado (${frequency}) para ${result.count ?? 0} aluno(s). Será enviado automaticamente em cada vencimento.`,
      })
    }
  )

  server.tool(
    'kinevo_list_form_schedules',
    'List the ACTIVE recurring form schedules for a given student (which forms repeat and how often, and when each is next due). Use to review or before changing a student\'s recurring check-ins.',
    {
      student_id: z.string().uuid().describe('The student whose recurring schedules to list.'),
    },
    { title: 'Listar formulários recorrentes', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ student_id }) => {
      const supabaseAdmin = createAdminClient()
      const schedules = await getStudentFormSchedulesCore(supabaseAdmin, trainerId, student_id)

      return mcpSuccess({
        schedules: schedules.map(s => ({
          id: s.id,
          form_template_id: s.form_template_id,
          form_template_title: s.form_template_title,
          frequency: s.frequency,
          next_due_at: s.next_due_at,
          last_sent_at: s.last_sent_at,
        })),
        total: schedules.length,
      })
    }
  )
}
