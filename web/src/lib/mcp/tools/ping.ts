import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerPingTool(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_ping',
    'Test the connection to Kinevo. Returns trainer name and account status.',
    {},
    { title: 'Testar conexão', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async () => {
      const supabaseAdmin = createAdminClient()

      const [trainerResult, subscriptionResult, studentsResult] =
        await Promise.all([
          supabaseAdmin
            .from('trainers')
            .select('id, name, email')
            .eq('id', trainerId)
            .single(),
          supabaseAdmin
            .from('subscriptions')
            .select('status')
            .eq('trainer_id', trainerId)
            .maybeSingle(),
          supabaseAdmin
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', trainerId)
            .eq('status', 'active'),
        ])

      if (!trainerResult.data) {
        return mcpError('Trainer not found')
      }

      return mcpSuccess({
        trainer_name: trainerResult.data.name,
        email: trainerResult.data.email,
        subscription_status: subscriptionResult.data?.status ?? 'none',
        students_count: studentsResult.count ?? 0,
        server_time: new Date().toISOString(),
      })
    }
  )
}
