import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerProgramReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_programs',
    "List training programs created by this trainer. Can filter by student (to see their program history) or by status. Returns both program templates and assigned programs.",
    {
      student_id: z.string().uuid().optional().describe('Filter programs assigned to a specific student'),
      status: z.enum(['draft', 'active', 'scheduled', 'completed', 'paused', 'expired']).optional().describe('Filter by program status'),
      type: z.enum(['template', 'assigned']).default('assigned').describe("'template' for reusable program templates, 'assigned' for programs assigned to students"),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ student_id, status, type, limit, offset }) => {
      const supabaseAdmin = createAdminClient()

      if (type === 'template') {
        const { data, count, error } = await supabaseAdmin
          .from('program_templates')
          .select('id, name, description, duration_weeks, created_at, workout_templates(id)', { count: 'exact' })
          .eq('trainer_id', trainerId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) return mcpError(`Erro ao buscar templates: ${error.message}`)

        const programs = (data ?? []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: null,
          duration_weeks: p.duration_weeks,
          student: null,
          started_at: null,
          created_at: p.created_at,
          workout_count: Array.isArray(p.workout_templates) ? p.workout_templates.length : 0,
        }))

        return mcpSuccess({ programs, total: count ?? 0 })
      }

      // Assigned programs
      let query = supabaseAdmin
        .from('assigned_programs')
        .select('id, name, description, status, duration_weeks, started_at, created_at, student_id, students(id, name), assigned_workouts(id)', { count: 'exact' })
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (student_id) query = query.eq('student_id', student_id)
      if (status) query = query.eq('status', status)

      const { data, count, error } = await query

      if (error) return mcpError(`Erro ao buscar programas: ${error.message}`)

      const programs = (data ?? []).map(p => {
        const studentData = p.students as unknown as { id: string; name: string } | null
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          duration_weeks: p.duration_weeks,
          student: studentData ? { id: studentData.id, name: studentData.name } : null,
          started_at: p.started_at,
          created_at: p.created_at,
          workout_count: Array.isArray(p.assigned_workouts) ? p.assigned_workouts.length : 0,
        }
      })

      return mcpSuccess({ programs, total: count ?? 0 })
    }
  )

  server.tool(
    'kinevo_get_program',
    'Get full details of a training program including all workout sessions and exercises with sets, reps, and loads. Works for both templates and assigned programs.',
    {
      program_id: z.string().uuid().describe("The program's UUID"),
      type: z.enum(['template', 'assigned']).default('assigned').describe('Whether this is a template or an assigned program'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ program_id, type }) => {
      const supabaseAdmin = createAdminClient()

      if (type === 'assigned') {
        const { data, error } = await supabaseAdmin
          .from('assigned_programs')
          .select(`
            id, name, description, status, duration_weeks, started_at,
            student_id,
            students(id, name),
            assigned_workouts(
              id, name, order_index,
              assigned_workout_items(
                id, item_type, order_index, exercise_id, sets, reps,
                rest_seconds, notes, method_key, exercise_function,
                parent_item_id,
                exercise_name, exercise_muscle_group, exercise_equipment,
                exercises(id, name, equipment)
              )
            )
          `)
          .eq('id', program_id)
          .eq('trainer_id', trainerId)
          .single()

        if (error || !data) {
          return mcpError('Programa não encontrado ou não pertence a este treinador.')
        }

        const studentData = data.students as unknown as { id: string; name: string } | null
        const workouts = sortAndStructureWorkouts(
          data.assigned_workouts as unknown as RawWorkout[]
        )

        return mcpSuccess({
          program: {
            id: data.id,
            name: data.name,
            description: data.description,
            status: data.status,
            duration_weeks: data.duration_weeks,
            student: studentData,
            started_at: data.started_at,
            workouts,
          },
        })
      }

      // Template
      const { data, error } = await supabaseAdmin
        .from('program_templates')
        .select(`
          id, name, description, duration_weeks, created_at,
          workout_templates(
            id, name, order_index,
            workout_item_templates(
              id, item_type, order_index, exercise_id, sets, reps,
              rest_seconds, notes, method_key, exercise_function,
              parent_item_id,
              exercises(id, name, equipment)
            )
          )
        `)
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .single()

      if (error || !data) {
        return mcpError('Template não encontrado ou não pertence a este treinador.')
      }

      const workouts = sortAndStructureWorkouts(
        (data.workout_templates as unknown as RawWorkout[]).map(w => ({
          ...w,
          assigned_workout_items: undefined,
          items_raw: (w as unknown as { workout_item_templates: RawItem[] }).workout_item_templates,
        }))
      )

      return mcpSuccess({
        program: {
          id: data.id,
          name: data.name,
          description: data.description,
          status: null,
          duration_weeks: data.duration_weeks,
          student: null,
          started_at: null,
          workouts,
        },
      })
    }
  )
}

// Types for raw Supabase results
interface RawItem {
  id: string
  item_type: string
  order_index: number
  exercise_id: string | null
  sets: number | null
  reps: string | null
  rest_seconds: number | null
  notes: string | null
  method_key: string | null
  exercise_function: string | null
  parent_item_id: string | null
  exercise_name?: string | null
  exercise_muscle_group?: string | null
  exercise_equipment?: string | null
  exercises?: { id: string; name: string; equipment: string | null } | null
}

interface RawWorkout {
  id: string
  name: string
  order_index: number
  assigned_workout_items?: RawItem[]
  items_raw?: RawItem[]
}

interface StructuredItem {
  id: string
  item_type: string
  order_index: number
  exercise: { id: string; name: string; equipment: string | null } | null
  sets: number | null
  reps: string | null
  rest_seconds: number | null
  notes: string | null
  method_key: string | null
  exercise_function: string | null
  children?: StructuredItem[]
}

function sortAndStructureWorkouts(workouts: RawWorkout[]) {
  return [...workouts]
    .sort((a, b) => a.order_index - b.order_index)
    .map(w => {
      const rawItems = w.assigned_workout_items ?? w.items_raw ?? []
      const sorted = [...rawItems].sort((a, b) => a.order_index - b.order_index)

      // Separate root items and children (for supersets)
      const rootItems: StructuredItem[] = []
      const childrenMap = new Map<string, StructuredItem[]>()

      for (const item of sorted) {
        const structured: StructuredItem = {
          id: item.id,
          item_type: item.item_type,
          order_index: item.order_index,
          exercise: item.exercises
            ? { id: item.exercises.id, name: item.exercises.name, equipment: item.exercises.equipment }
            : item.exercise_name
              ? { id: item.exercise_id ?? '', name: item.exercise_name, equipment: item.exercise_equipment ?? null }
              : null,
          sets: item.sets,
          reps: item.reps,
          rest_seconds: item.rest_seconds,
          notes: item.notes,
          method_key: item.method_key,
          exercise_function: item.exercise_function,
        }

        if (item.parent_item_id) {
          const children = childrenMap.get(item.parent_item_id) ?? []
          children.push(structured)
          childrenMap.set(item.parent_item_id, children)
        } else {
          rootItems.push(structured)
        }
      }

      // Attach children to parent items
      for (const item of rootItems) {
        const children = childrenMap.get(item.id)
        if (children) {
          item.children = children
        }
      }

      return {
        id: w.id,
        name: w.name,
        order_index: w.order_index,
        items: rootItems,
      }
    })
}
