import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { convertLeadToStudentCore } from '@/actions/leads/convert-lead-core'

const LEAD_STATUSES = ['new', 'read', 'contacted', 'converted', 'archived'] as const

export function registerLeadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_leads',
    "List this trainer's CRM leads (prospective students captured via landing pages / capture forms). Shows contact info, goal, level and status. Use for \"who are my new leads?\" or to follow up.",
    {
      status: z.enum(LEAD_STATUSES).optional().describe('Filter by lead status.'),
      limit: z.number().min(1).max(50).default(30),
    },
    { title: 'Listar leads', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ status, limit }) => {
      const supabaseAdmin = createAdminClient()

      let query = supabaseAdmin
        .from('trainer_leads')
        .select('id, name, email, whatsapp, goal, level, message, status, source, created_at, converted_to_student_id')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) return mcpError(`Erro ao listar leads: ${error.message}`)

      const leads = (data ?? []).map(l => ({
        id: l.id,
        name: l.name,
        email: l.email,
        whatsapp: l.whatsapp,
        goal: l.goal,
        level: l.level,
        message: l.message,
        status: l.status,
        source: l.source,
        created_at: l.created_at,
        converted: l.converted_to_student_id !== null,
      }))

      return mcpSuccess({ leads, total: leads.length })
    }
  )

  server.tool(
    'kinevo_update_lead_status',
    "Update a lead's status in the CRM pipeline (new → read → contacted → converted/archived). Use to mark a lead as contacted or archive it. To actually turn a lead into a student account, that is done in the app (not via this tool).",
    {
      lead_id: z.string().uuid().describe('The lead to update (from kinevo_list_leads).'),
      status: z.enum(LEAD_STATUSES).describe('New status for the lead.'),
    },
    { title: 'Atualizar status do lead', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ lead_id, status }) => {
      const supabaseAdmin = createAdminClient()

      const { data, error } = await supabaseAdmin
        .from('trainer_leads')
        .update({ status })
        .eq('id', lead_id)
        .eq('trainer_id', trainerId)
        .select('id')

      if (error) return mcpError(`Erro ao atualizar lead: ${error.message}`)
      if (!data || data.length === 0) return mcpError('Lead não encontrado.')

      return mcpSuccess({ lead_id, status, message: `Lead atualizado para "${status}".` })
    }
  )

  server.tool(
    'kinevo_convert_lead',
    "Convert a lead into a real student account (courtesy / no contract — billing can be set up later with kinevo_create_contract). This CREATES a login account and returns the student's credentials (password) so the trainer can share them. Idempotent: a lead already converted (or whose e-mail already exists under this trainer) just links to the existing student, with no new password. Call WITHOUT confirm first to preview; call again with confirm=true only after the trainer approved.",
    {
      lead_id: z.string().uuid().describe('The lead to convert (from kinevo_list_leads).'),
      modality: z.enum(['online', 'presential']).describe('How the student will be trained.'),
      confirm: z.boolean().default(false).describe('Set true ONLY after the trainer approved. Without it, returns a preview and does nothing.'),
    },
    { title: 'Converter lead em aluno', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ lead_id, modality, confirm }) => {
      const supabaseAdmin = createAdminClient()

      const { data: lead } = await supabaseAdmin
        .from('trainer_leads')
        .select('id, name, email, trainer_id, converted_to_student_id')
        .eq('id', lead_id)
        .eq('trainer_id', trainerId)
        .single()
      if (!lead) return mcpError('Lead não encontrado.')

      if (!confirm) {
        const note = lead.converted_to_student_id
          ? `Este lead já foi convertido — chamar de novo só devolve o vínculo existente (sem nova senha).`
          : `Isto vai CRIAR uma conta de aluno (cortesia, sem contrato) para ${lead.name} (${lead.email}) na modalidade ${modality} e gerar credenciais de acesso.`
        return mcpSuccess({
          preview: true,
          action: 'convert_lead',
          message: `PRÉ-VISUALIZAÇÃO (nada foi criado). ${note} Confirme com o treinador e chame de novo com confirm=true.`,
        })
      }

      const result = await convertLeadToStudentCore(supabaseAdmin, trainerId, lead_id, { modality })
      if (!result.success) return mcpError(result.message ?? 'Não foi possível converter o lead.')

      return mcpSuccess({
        student_id: result.studentId,
        already_existed: result.alreadyExisted ?? false,
        credentials: result.credentials ?? null,
        message: result.alreadyExisted
          ? `Lead vinculado ao aluno existente (sem novas credenciais).`
          : `Aluno criado a partir do lead. Compartilhe as credenciais com ${result.credentials?.name ?? 'o aluno'}.`,
      })
    }
  )
}
