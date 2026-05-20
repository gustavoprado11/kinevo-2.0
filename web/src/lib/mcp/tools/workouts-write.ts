import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerWorkoutWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_add_workout_session',
    "Add a new workout session (e.g., 'Treino A - Peito e Triceps') to an existing program. Works for both templates and assigned programs.",
    {
      program_id: z.string().uuid().describe('The program ID to add the session to'),
      program_type: z.enum(['template', 'assigned']).default('assigned').describe('Whether the program is a template or assigned'),
      name: z.string().describe("Session name (e.g., 'Treino A - Peito e Triceps')"),
      order_index: z.number().min(0).optional().describe('Position in the program. If omitted, appends at the end.'),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ program_id, program_type, name, order_index }) => {
      const supabaseAdmin = createAdminClient()

      // Verify program belongs to trainer
      const programTable = program_type === 'template' ? 'program_templates' : 'assigned_programs'
      const { data: program } = await supabaseAdmin
        .from(programTable)
        .select('id')
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .single()

      if (!program) {
        return mcpError('Programa não encontrado ou não pertence a este treinador.')
      }

      const workoutTable = program_type === 'template' ? 'workout_templates' : 'assigned_workouts'
      const fkColumn = program_type === 'template' ? 'program_template_id' : 'assigned_program_id'

      // Calculate order_index if not provided
      let finalOrderIndex = order_index
      if (finalOrderIndex === undefined) {
        const { data: last } = await supabaseAdmin
          .from(workoutTable)
          .select('order_index')
          .eq(fkColumn, program_id)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()

        finalOrderIndex = last ? last.order_index + 1 : 0
      }

      const { data, error } = await supabaseAdmin
        .from(workoutTable)
        .insert({
          [fkColumn]: program_id,
          name,
          order_index: finalOrderIndex,
        } as Record<string, unknown>)
        .select('id, name, order_index')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao criar sessão de treino: ${error?.message ?? 'desconhecido'}`)
      }

      return mcpSuccess({
        workout: data,
        message: `Sessão "${data.name}" adicionada ao programa na posição ${data.order_index}.`,
      })
    }
  )

  server.tool(
    'kinevo_add_exercise_to_session',
    'Add an exercise to a workout session with sets, reps, and rest configuration. Can add exercises to both template and assigned workout sessions.',
    {
      workout_id: z.string().uuid().describe('The workout session ID to add the exercise to'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
      exercise_id: z.string().uuid().describe('The exercise ID from the catalog'),
      sets: z.number().min(1).max(20).describe('Number of sets'),
      reps: z.string().describe("Reps prescription (e.g., '12', '8-12', '10/10/8/6', 'AMRAP')"),
      rest_seconds: z.number().min(0).max(600).optional().default(90).describe('Rest between sets in seconds'),
      notes: z.string().optional().describe("Special instructions (e.g., 'Carga inicial: 80kg', 'Controlar a excêntrica')"),
      exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().default('main').describe('The role of this exercise in the session'),
      order_index: z.number().min(0).optional().describe('Position in the session. If omitted, appends at the end.'),
      method_key: z.string().optional().describe("Training method (e.g., 'drop_set', 'rest_pause', 'cluster')"),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ workout_id, workout_type, exercise_id, sets, reps, rest_seconds, notes, exercise_function, order_index, method_key }) => {
      const supabaseAdmin = createAdminClient()

      // Verify workout belongs to a program owned by this trainer
      if (workout_type === 'assigned') {
        const { data: workout } = await supabaseAdmin
          .from('assigned_workouts')
          .select('id, assigned_programs(trainer_id)')
          .eq('id', workout_id)
          .single()

        const programData = workout?.assigned_programs as unknown as { trainer_id: string } | null
        if (!workout || programData?.trainer_id !== trainerId) {
          return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
        }
      } else {
        const { data: workout } = await supabaseAdmin
          .from('workout_templates')
          .select('id, program_templates(trainer_id)')
          .eq('id', workout_id)
          .single()

        const programData = workout?.program_templates as unknown as { trainer_id: string } | null
        if (!workout || programData?.trainer_id !== trainerId) {
          return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
        }
      }

      // Get exercise info for snapshots
      const { data: exercise } = await supabaseAdmin
        .from('exercises')
        .select('id, name, equipment')
        .eq('id', exercise_id)
        .single()

      if (!exercise) {
        return mcpError('Exercício não encontrado no catálogo.')
      }

      const itemTable = workout_type === 'template' ? 'workout_item_templates' : 'assigned_workout_items'
      const fkColumn = workout_type === 'template' ? 'workout_template_id' : 'assigned_workout_id'

      // Calculate order_index if not provided
      let finalOrderIndex = order_index
      if (finalOrderIndex === undefined) {
        const { data: last } = await supabaseAdmin
          .from(itemTable)
          .select('order_index')
          .eq(fkColumn, workout_id)
          .is('parent_item_id', null)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()

        finalOrderIndex = last ? last.order_index + 1 : 0
      }

      const insertData: Record<string, unknown> = {
        [fkColumn]: workout_id,
        item_type: 'exercise',
        exercise_id,
        sets,
        reps,
        rest_seconds: rest_seconds ?? 90,
        notes: notes ?? null,
        exercise_function: exercise_function ?? 'main',
        order_index: finalOrderIndex,
        method_key: method_key ?? null,
      }

      // Assigned items store exercise snapshots
      if (workout_type === 'assigned') {
        insertData.exercise_name = exercise.name
        insertData.exercise_equipment = exercise.equipment
      }

      const { data, error } = await supabaseAdmin
        .from(itemTable)
        .insert(insertData)
        .select('id, order_index, sets, reps, rest_seconds')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao adicionar exercício: ${error?.message ?? 'desconhecido'}`)
      }

      return mcpSuccess({
        workout_item: {
          id: data.id,
          exercise_name: exercise.name,
          sets: data.sets,
          reps: data.reps,
          rest_seconds: data.rest_seconds,
          order_index: data.order_index,
        },
        message: `${exercise.name} adicionado: ${data.sets}x${data.reps}, descanso ${data.rest_seconds}s.`,
      })
    }
  )
}
