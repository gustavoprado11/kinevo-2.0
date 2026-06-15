import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { assignFormCore } from '@/actions/forms/assign-form-core'

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
      student_ids: z.array(z.string().uuid()).min(1).describe('One or more student IDs to send the form to'),
      due_at: z.string().optional().describe('Optional due date/time in ISO 8601 (e.g. 2026-06-20 or 2026-06-20T18:00:00Z). When the student should complete it.'),
      message: z.string().max(500).optional().describe('Optional custom message shown with the request (e.g. "Check-in da semana, responde aí 💪")'),
    },
    { title: 'Enviar formulário', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ template_id, student_ids, due_at, message }) => {
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
}
