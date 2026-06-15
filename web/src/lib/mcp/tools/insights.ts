import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerInsightToolsAndCheckins(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_insights',
    "List the AI-generated insights/alerts for this trainer (e.g. student at churn risk, adherence drop, billing attention). Good for \"any important alerts today?\". By default returns active (non-dismissed, non-expired) insights, highest priority first.",
    {
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Filter by priority.'),
      include_dismissed: z.boolean().default(false).describe('When true, also includes dismissed insights.'),
      limit: z.number().min(1).max(50).default(20),
    },
    { title: 'Ver insights', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ priority, include_dismissed, limit }) => {
      const supabaseAdmin = createAdminClient()
      const nowIso = new Date().toISOString()

      let query = supabaseAdmin
        .from('assistant_insights')
        .select('id, category, priority, title, body, action_type, status, student_id, created_at, expires_at, students(name)')
        .eq('trainer_id', trainerId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!include_dismissed) query = query.neq('status', 'dismissed')
      if (priority) query = query.eq('priority', priority)

      const { data, error } = await query
      if (error) return mcpError(`Erro ao listar insights: ${error.message}`)

      const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const insights = (data ?? [])
        .map(i => {
          const studentData = i.students as unknown as { name: string } | null
          return {
            id: i.id,
            category: i.category,
            priority: i.priority,
            title: i.title,
            body: i.body,
            action_type: i.action_type,
            status: i.status,
            student: i.student_id ? { id: i.student_id, name: studentData?.name ?? null } : null,
            created_at: i.created_at,
          }
        })
        .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9))

      return mcpSuccess({ insights, total: insights.length })
    }
  )

  server.tool(
    'kinevo_get_workout_checkins',
    "Read a student's most recent pre/post-workout check-in answers (how they felt, soreness, energy, etc). Use to understand how training is going for a specific student. Returns the latest submissions newest-first.",
    {
      student_id: z.string().uuid().describe('The student whose workout check-ins to read.'),
      limit: z.number().min(1).max(20).default(5),
    },
    { title: 'Ver check-ins de treino', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ student_id, limit }) => {
      const supabaseAdmin = createAdminClient()

      // Ownership: o admin client bypassa RLS, então confirmamos que o aluno é
      // deste treinador antes de devolver respostas.
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id')
        .eq('id', student_id)
        .single()
      if (!student || student.coach_id !== trainerId) {
        return mcpError('Aluno não encontrado.')
      }

      const { data, error } = await supabaseAdmin
        .from('form_submissions')
        .select('id, trigger_context, submitted_at, answers_json, form_templates(title)')
        .eq('student_id', student_id)
        .in('trigger_context', ['pre_workout', 'post_workout'])
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at', { ascending: false })
        .limit(limit)

      if (error) return mcpError(`Erro ao buscar check-ins: ${error.message}`)

      const checkins = (data ?? []).map(row => {
        const tpl = row.form_templates as unknown as { title: string } | null
        return {
          id: row.id,
          trigger_context: row.trigger_context,
          form_title: tpl?.title ?? 'Check-in',
          submitted_at: row.submitted_at,
          answers: row.answers_json,
        }
      })

      return mcpSuccess({ checkins, total: checkins.length })
    }
  )
}
