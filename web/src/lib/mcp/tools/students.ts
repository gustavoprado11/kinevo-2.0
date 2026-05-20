import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerStudentReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_students',
    'List the trainer\'s students with optional filters. Returns active students by default. Use this to find students by name, check who is active/inactive, or get an overview of all students.',
    {
      search: z.string().optional().describe('Filter by student name (partial match, case-insensitive)'),
      status: z.enum(['active', 'inactive', 'pending']).optional().describe('Filter by student status. Defaults to all statuses if omitted.'),
      limit: z.number().min(1).max(100).default(50).describe('Max results to return'),
      offset: z.number().min(0).default(0).describe('Offset for pagination'),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ search, status, limit, offset }) => {
      const supabaseAdmin = createAdminClient()

      let query = supabaseAdmin
        .from('students')
        .select('id, name, email, phone, status, objective, modality, avatar_url, created_at', { count: 'exact' })
        .eq('coach_id', trainerId)

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }
      if (status) {
        query = query.eq('status', status)
      }

      query = query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1)

      const { data: students, count, error } = await query

      if (error) return mcpError(`Erro ao buscar alunos: ${error.message}`)
      if (!students) return mcpSuccess({ students: [], total: 0 })

      const studentIds = students.map(s => s.id)

      // Fetch active programs and last workout in parallel
      const [programsResult, sessionsResult] = await Promise.all([
        supabaseAdmin
          .from('assigned_programs')
          .select('id, name, student_id')
          .eq('trainer_id', trainerId)
          .eq('status', 'active')
          .in('student_id', studentIds),
        supabaseAdmin
          .from('workout_sessions')
          .select('student_id, completed_at')
          .eq('trainer_id', trainerId)
          .eq('status', 'completed')
          .in('student_id', studentIds)
          .order('completed_at', { ascending: false }),
      ])

      const programMap = new Map<string, { id: string; name: string }>()
      for (const p of programsResult.data ?? []) {
        if (!programMap.has(p.student_id)) {
          programMap.set(p.student_id, { id: p.id, name: p.name })
        }
      }

      const lastWorkoutMap = new Map<string, string>()
      for (const s of sessionsResult.data ?? []) {
        if (!lastWorkoutMap.has(s.student_id) && s.completed_at) {
          lastWorkoutMap.set(s.student_id, s.completed_at)
        }
      }

      const result = students.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        status: s.status,
        objective: s.objective,
        modality: s.modality,
        avatar_url: s.avatar_url,
        created_at: s.created_at,
        active_program: programMap.get(s.id) ?? null,
        last_workout_at: lastWorkoutMap.get(s.id) ?? null,
      }))

      return mcpSuccess({ students: result, total: count ?? 0 })
    }
  )

  server.tool(
    'kinevo_get_student',
    'Get the complete profile of a specific student including personal data, clinical conditions, training history, and current program. Use this when the trainer asks about a specific student\'s details.',
    {
      student_id: z.string().uuid().describe("The student's UUID"),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ student_id }) => {
      const supabaseAdmin = createAdminClient()

      // 1. Student with coach_id check
      const { data: student, error } = await supabaseAdmin
        .from('students')
        .select('id, name, email, phone, status, objective, modality, avatar_url, trainer_notes, management_tags, created_at')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()

      if (error || !student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      // 2-5 in parallel
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [profileResult, programResult, totalResult, recentResult, lastSessionResult, contractResult] =
        await Promise.all([
          supabaseAdmin
            .from('student_prescription_profiles')
            .select('training_level, goal, available_days, session_duration_minutes, available_equipment, medical_restrictions, adherence_rate')
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .maybeSingle(),
          supabaseAdmin
            .from('assigned_programs')
            .select('id, name, status, duration_weeks, started_at, current_week, assigned_workouts(id, name, order_index)')
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .eq('status', 'active')
            .maybeSingle(),
          supabaseAdmin
            .from('workout_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .eq('status', 'completed'),
          supabaseAdmin
            .from('workout_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .gte('completed_at', thirtyDaysAgo),
          supabaseAdmin
            .from('workout_sessions')
            .select('completed_at')
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from('student_contracts')
            .select('status, amount, current_period_end')
            .eq('student_id', student_id)
            .eq('trainer_id', trainerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

      const profile = profileResult.data
      const program = programResult.data
      const contract = contractResult.data

      return mcpSuccess({
        student: {
          ...student,
          prescription_profile: profile
            ? {
                training_level: profile.training_level,
                goal: profile.goal,
                available_days: profile.available_days,
                session_duration_minutes: profile.session_duration_minutes,
                available_equipment: profile.available_equipment,
                medical_restrictions: profile.medical_restrictions,
              }
            : null,
          active_program: program
            ? {
                id: program.id,
                name: program.name,
                status: program.status,
                duration_weeks: program.duration_weeks,
                started_at: program.started_at,
                current_week: program.current_week,
                workouts: (program.assigned_workouts as { id: string; name: string; order_index: number }[]) ?? [],
              }
            : null,
          stats: {
            total_sessions: totalResult.count ?? 0,
            sessions_last_30_days: recentResult.count ?? 0,
            last_workout_at: lastSessionResult.data?.completed_at ?? null,
            adherence_rate: profile?.adherence_rate ?? null,
          },
          contract: contract
            ? {
                status: contract.status,
                amount: Number(contract.amount),
                current_period_end: contract.current_period_end,
              }
            : null,
        },
      })
    }
  )
}
