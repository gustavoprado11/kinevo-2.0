import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { estimateOneRepMax } from '@kinevo/shared/lib/estimate-one-rep-max'

export function registerProgressReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_get_student_progress',
    "Get a student's training progress including workout history, adherence rate, and load progression over time. Can filter by date range and specific exercise for load tracking.",
    {
      student_id: z.string().uuid().describe("The student's UUID"),
      days: z.number().min(1).max(365).default(30).describe('Number of days to look back'),
      exercise_id: z.string().uuid().optional().describe('If provided, returns load progression for this specific exercise'),
    },
    { title: 'Progresso do aluno', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ student_id, days, exercise_id }) => {
      const supabaseAdmin = createAdminClient()
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()

      // Verify student belongs to trainer
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()

      if (!student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      // Completed sessions in period
      const { data: sessions } = await supabaseAdmin
        .from('workout_sessions')
        .select('id, assigned_workout_id, completed_at, duration_seconds, rpe, assigned_workouts(name)')
        .eq('student_id', student_id)
        .eq('trainer_id', trainerId)
        .eq('status', 'completed')
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })

      const sessionList = sessions ?? []
      const sessionIds = sessionList.map(s => s.id)

      // Set logs for volume per session
      let setLogs: Array<{
        workout_session_id: string
        weight: number | null
        reps_completed: number | null
      }> = []

      if (sessionIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('set_logs')
          .select('workout_session_id, weight, reps_completed')
          .in('workout_session_id', sessionIds)
          .eq('is_completed', true)

        setLogs = data ?? []
      }

      // Aggregate volume per session
      const volumeMap = new Map<string, { sets: number; volume: number }>()
      for (const log of setLogs) {
        const entry = volumeMap.get(log.workout_session_id) ?? { sets: 0, volume: 0 }
        entry.sets++
        entry.volume += (Number(log.weight) || 0) * (log.reps_completed ?? 0)
        volumeMap.set(log.workout_session_id, entry)
      }

      const sessionData = sessionList.map(s => {
        const workoutName = (s.assigned_workouts as unknown as { name: string } | null)?.name ?? 'Treino'
        const vol = volumeMap.get(s.id)
        return {
          id: s.id,
          workout_name: workoutName,
          completed_at: s.completed_at!,
          duration_seconds: s.duration_seconds ?? 0,
          rpe: s.rpe,
          total_sets: vol?.sets ?? 0,
          total_volume_kg: Math.round((vol?.volume ?? 0) * 100) / 100,
        }
      })

      const totalDuration = sessionData.reduce((sum, s) => sum + s.duration_seconds, 0)
      const rpeValues = sessionData.filter(s => s.rpe != null).map(s => s.rpe!)

      // Exercise progression (if requested)
      let exerciseProgression = null
      if (exercise_id && sessionIds.length > 0) {
        const { data: exerciseLogs } = await supabaseAdmin
          .from('set_logs')
          .select('workout_session_id, set_number, weight, reps_completed')
          .in('workout_session_id', sessionIds)
          .or(`exercise_id.eq.${exercise_id},executed_exercise_id.eq.${exercise_id}`)
          .eq('is_completed', true)

        // Get exercise name
        const { data: exerciseData } = await supabaseAdmin
          .from('exercises')
          .select('name')
          .eq('id', exercise_id)
          .single()

        const exerciseName = exerciseData?.name ?? 'Exercício'

        // Group by session, then map to dates
        const sessionDateMap = new Map(sessionList.map(s => [s.id, s.completed_at!]))
        const bySession = new Map<string, Array<{ set_number: number; weight: number; reps: number }>>()

        for (const log of exerciseLogs ?? []) {
          const sets = bySession.get(log.workout_session_id) ?? []
          sets.push({
            set_number: log.set_number,
            weight: Number(log.weight) || 0,
            reps: log.reps_completed ?? 0,
          })
          bySession.set(log.workout_session_id, sets)
        }

        exerciseProgression = Array.from(bySession.entries())
          .map(([sessionId, sets]) => {
            sets.sort((a, b) => a.set_number - b.set_number)
            // S5: mesma fórmula do relatório de programa (best-of Epley+Brzycki)
            // — antes o chat MCP usava Epley puro e mostrava 1RM diferente do
            // PDF para os mesmos set_logs.
            const bestSet = sets.reduce(
              (best, s) => {
                const est = estimateOneRepMax(s.weight, s.reps)
                return est > best.est ? { est, weight: s.weight, reps: s.reps } : best
              },
              { est: 0, weight: 0, reps: 0 }
            )

            return {
              date: sessionDateMap.get(sessionId) ?? '',
              exercise_name: exerciseName,
              sets,
              estimated_1rm: bestSet.est > 0 ? Math.round(bestSet.est * 10) / 10 : null,
            }
          })
          .sort((a, b) => a.date.localeCompare(b.date))
      }

      return mcpSuccess({
        student_name: student.name,
        period: { from: since, to: now },
        summary: {
          total_sessions: sessionData.length,
          total_duration_minutes: Math.round(totalDuration / 60),
          avg_session_duration_minutes:
            sessionData.length > 0 ? Math.round(totalDuration / 60 / sessionData.length) : 0,
          adherence_rate_pct: null, // Requires program frequency data — complex calculation
          avg_rpe: rpeValues.length > 0
            ? Math.round((rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length) * 10) / 10
            : null,
        },
        sessions: sessionData,
        exercise_progression: exerciseProgression,
      })
    }
  )

  server.tool(
    'kinevo_get_form_responses',
    'Get form/check-in responses submitted by a student. Includes pre/post-workout check-ins, anamneses, and surveys.',
    {
      student_id: z.string().uuid().describe("The student's UUID"),
      category: z.enum(['anamnese', 'checkin', 'survey', 'assessment', 'feedback']).optional().describe('Filter by form category'),
      trigger_context: z.enum(['manual', 'pre_workout', 'post_workout', 'recurring']).optional().describe('Filter by how the form was triggered'),
      limit: z.number().min(1).max(50).default(20),
    },
    { title: 'Respostas de formulários', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ student_id, category, trigger_context, limit }) => {
      const supabaseAdmin = createAdminClient()

      // Verify student belongs to trainer
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()

      if (!student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      let query = supabaseAdmin
        .from('form_submissions')
        .select(
          'id, status, answers_json, submitted_at, trainer_feedback, trigger_context, form_templates(title, category)',
          { count: 'exact' }
        )
        .eq('student_id', student_id)
        .eq('trainer_id', trainerId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(limit)

      if (trigger_context) {
        query = query.eq('trigger_context', trigger_context)
      }

      const { data, count, error } = await query

      if (error) return mcpError(`Erro ao buscar respostas: ${error.message}`)

      let responses = (data ?? []).map(r => {
        const template = r.form_templates as unknown as { title: string; category: string } | null
        return {
          id: r.id,
          form_title: template?.title ?? 'Formulário',
          category: template?.category ?? 'unknown',
          trigger_context: r.trigger_context,
          status: r.status,
          answers: r.answers_json,
          submitted_at: r.submitted_at,
          trainer_feedback: r.trainer_feedback,
        }
      })

      // Post-query filter by category (Supabase can't filter on nested join easily)
      if (category) {
        responses = responses.filter(r => r.category === category)
      }

      return mcpSuccess({ responses, total: category ? responses.length : (count ?? 0) })
    }
  )
}
