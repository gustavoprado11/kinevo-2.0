import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

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
}
