import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerDashboardReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_get_dashboard_summary',
    "Get an overview of the trainer's account: total students, active programs, students without programs, students inactive for 7+ days, recent activity, and key metrics.",
    {},
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async () => {
      const supabaseAdmin = createAdminClient()

      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // Start of current week (Monday)
      const dayOfWeek = now.getDay()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      startOfWeek.setHours(0, 0, 0, 0)

      // Start of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Run all queries in parallel
      const [
        studentsResult,
        activeProgramsResult,
        allProgramsResult,
        weekSessionsResult,
        monthSessionsResult,
        recentActiveResult,
        pendingFormsResult,
      ] = await Promise.all([
        // 1. All students
        supabaseAdmin
          .from('students')
          .select('id, status')
          .eq('coach_id', trainerId),

        // 2. Students with active programs
        supabaseAdmin
          .from('assigned_programs')
          .select('student_id')
          .eq('trainer_id', trainerId)
          .eq('status', 'active'),

        // 3. All programs for status counts
        supabaseAdmin
          .from('assigned_programs')
          .select('status')
          .eq('trainer_id', trainerId),

        // 4. Sessions this week
        supabaseAdmin
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'completed')
          .gte('completed_at', startOfWeek.toISOString()),

        // 5. Sessions this month
        supabaseAdmin
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'completed')
          .gte('completed_at', startOfMonth.toISOString()),

        // 6. Students who trained in last 7 days
        supabaseAdmin
          .from('workout_sessions')
          .select('student_id')
          .eq('trainer_id', trainerId)
          .eq('status', 'completed')
          .gte('completed_at', sevenDaysAgo),

        // 7. Pending form submissions
        supabaseAdmin
          .from('form_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerId)
          .eq('status', 'submitted'),
      ])

      const students = studentsResult.data ?? []
      const activeStudents = students.filter(s => s.status === 'active')
      const activeStudentIds = activeStudents.map(s => s.id)

      // Count students by status
      const statusCounts = { active: 0, inactive: 0, pending: 0 }
      for (const s of students) {
        if (s.status in statusCounts) {
          statusCounts[s.status as keyof typeof statusCounts]++
        }
      }

      // Students with active programs
      const studentsWithProgramSet = new Set(
        (activeProgramsResult.data ?? []).map(p => p.student_id)
      )
      const withoutActiveProgram = activeStudents.filter(s => !studentsWithProgramSet.has(s.id)).length

      // Students who trained recently
      const recentlyActiveSet = new Set(
        (recentActiveResult.data ?? []).map(s => s.student_id)
      )
      const inactive7days = activeStudents.filter(s => !recentlyActiveSet.has(s.id)).length

      // Program status counts
      const programs = allProgramsResult.data ?? []
      const activePrograms = programs.filter(p => p.status === 'active').length
      const draftPrograms = programs.filter(p => p.status === 'draft').length

      // Unread messages — requires student_ids subquery
      let unreadMessages = 0
      if (activeStudentIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('student_id', activeStudentIds)
          .eq('sender_type', 'student')
          .is('read_at', null)

        unreadMessages = count ?? 0
      }

      return mcpSuccess({
        summary: {
          students: {
            total: students.length,
            active: statusCounts.active,
            inactive: statusCounts.inactive,
            pending: statusCounts.pending,
            without_active_program: withoutActiveProgram,
            inactive_7_days: inactive7days,
          },
          programs: {
            active: activePrograms,
            draft: draftPrograms,
            total_created: programs.length,
          },
          sessions: {
            completed_this_week: weekSessionsResult.count ?? 0,
            completed_this_month: monthSessionsResult.count ?? 0,
          },
          unread_messages: unreadMessages,
          pending_form_submissions: pendingFormsResult.count ?? 0,
        },
      })
    }
  )
}
