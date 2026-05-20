import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerBillingReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_subscriptions',
    'List student contracts/subscriptions managed by this trainer. Shows payment status, plan, amount, and next billing date.',
    {
      status: z.string().optional().describe("Filter by contract status (e.g., 'active', 'past_due', 'canceled', 'pending')"),
      limit: z.number().min(1).max(50).default(30),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ status, limit }) => {
      const supabaseAdmin = createAdminClient()

      let query = supabaseAdmin
        .from('student_contracts')
        .select(
          `id, amount, status, billing_type, provider, current_period_end,
           cancel_at_period_end, start_date, created_at,
           students(id, name),
           trainer_plans(title, price)`,
          { count: 'exact' }
        )
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status) {
        query = query.eq('status', status)
      }

      const { data, count, error } = await query

      if (error) return mcpError(`Erro ao buscar assinaturas: ${error.message}`)

      const subscriptions = (data ?? []).map(c => {
        const studentData = c.students as unknown as { id: string; name: string } | null
        const planData = c.trainer_plans as unknown as { title: string; price: number } | null
        return {
          id: c.id,
          student: studentData ? { id: studentData.id, name: studentData.name } : null,
          plan: planData ? { title: planData.title, price: Number(planData.price) } : null,
          amount: Number(c.amount),
          status: c.status,
          billing_type: c.billing_type,
          provider: c.provider,
          current_period_end: c.current_period_end,
          cancel_at_period_end: c.cancel_at_period_end,
          start_date: c.start_date,
          created_at: c.created_at,
        }
      })

      return mcpSuccess({ subscriptions, total: count ?? 0 })
    }
  )

  server.tool(
    'kinevo_get_revenue_summary',
    'Get a financial summary: MRR (Monthly Recurring Revenue), new contracts this month, cancellations, and payment status overview.',
    {
      month: z.string().optional().describe('Month in YYYY-MM format. Defaults to current month.'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ month }) => {
      const supabaseAdmin = createAdminClient()

      const targetMonth = month ?? new Date().toISOString().slice(0, 7)
      const monthStart = `${targetMonth}-01T00:00:00Z`
      const monthStartDate = new Date(monthStart)
      const monthEnd = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 1).toISOString()

      const [activeResult, newResult, cancelResult, pastDueResult, eventsResult] = await Promise.all([
        // 1. Active contracts for MRR
        supabaseAdmin
          .from('student_contracts')
          .select('amount')
          .eq('trainer_id', trainerId)
          .eq('status', 'active'),

        // 2. New contracts this month
        supabaseAdmin
          .from('student_contracts')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .gte('created_at', monthStart)
          .lt('created_at', monthEnd),

        // 3. Cancellations this month
        supabaseAdmin
          .from('student_contracts')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'canceled')
          .gte('canceled_at', monthStart)
          .lt('canceled_at', monthEnd),

        // 4. Past due
        supabaseAdmin
          .from('student_contracts')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'past_due'),

        // 5. Financial events this month
        supabaseAdmin
          .from('contract_events')
          .select('event_type, metadata, created_at, students(name)')
          .eq('trainer_id', trainerId)
          .gte('created_at', monthStart)
          .lt('created_at', monthEnd)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      const activeContracts = activeResult.data ?? []
      const mrr = activeContracts.reduce((sum, c) => sum + Number(c.amount), 0)

      const events = (eventsResult.data ?? []).map(e => {
        const studentData = e.students as unknown as { name: string } | null
        return {
          event_type: e.event_type,
          student_name: studentData?.name ?? 'Desconhecido',
          date: e.created_at,
          metadata: e.metadata,
        }
      })

      return mcpSuccess({
        period: targetMonth,
        revenue: {
          mrr: Math.round(mrr * 100) / 100,
          total_active_contracts: activeContracts.length,
          new_contracts_this_month: newResult.count ?? 0,
          cancellations_this_month: cancelResult.count ?? 0,
          past_due_contracts: pastDueResult.count ?? 0,
        },
        events,
      })
    }
  )
}
