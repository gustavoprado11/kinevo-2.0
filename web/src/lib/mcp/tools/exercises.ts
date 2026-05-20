import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerExerciseReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_exercises',
    "Search the exercise catalog. Returns exercises available to this trainer (system exercises + trainer's custom exercises). Filter by muscle group, equipment, or name.",
    {
      search: z.string().optional().describe('Search by exercise name (partial match)'),
      muscle_group: z.string().optional().describe("Filter by muscle group name (e.g., 'Peitoral', 'Quadriceps', 'Biceps')"),
      equipment: z.string().optional().describe("Filter by equipment (e.g., 'Barra', 'Halter', 'Maquina', 'Cabo')"),
      limit: z.number().min(1).max(100).default(30),
      offset: z.number().min(0).default(0),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ search, muscle_group, equipment, limit, offset }) => {
      const supabaseAdmin = createAdminClient()

      // If filtering by muscle group, first get matching exercise IDs
      let muscleFilterIds: string[] | null = null
      if (muscle_group) {
        const { data: mgData } = await supabaseAdmin
          .from('muscle_groups')
          .select('id')
          .ilike('name', `%${muscle_group}%`)

        if (mgData && mgData.length > 0) {
          const mgIds = mgData.map(mg => mg.id)
          const { data: emgData } = await supabaseAdmin
            .from('exercise_muscle_groups')
            .select('exercise_id')
            .in('muscle_group_id', mgIds)

          muscleFilterIds = emgData?.map(e => e.exercise_id) ?? []
          if (muscleFilterIds.length === 0) {
            return mcpSuccess({ exercises: [], total: 0 })
          }
        } else {
          return mcpSuccess({ exercises: [], total: 0 })
        }
      }

      let query = supabaseAdmin
        .from('exercises')
        .select(
          'id, name, equipment, difficulty_level, movement_pattern, owner_id, exercise_muscle_groups(muscle_groups(name))',
          { count: 'exact' }
        )
        .eq('is_archived', false)
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }
      if (equipment) {
        query = query.ilike('equipment', `%${equipment}%`)
      }
      if (muscleFilterIds) {
        query = query.in('id', muscleFilterIds)
      }

      query = query
        .order('name')
        .range(offset, offset + limit - 1)

      const { data, count, error } = await query

      if (error) return mcpError(`Erro ao buscar exercícios: ${error.message}`)

      const exercises = (data ?? []).map(e => {
        const emgs = e.exercise_muscle_groups as unknown as Array<{ muscle_groups: { name: string } | null }>
        const muscleGroups = emgs
          ?.map(emg => emg.muscle_groups?.name)
          .filter((n): n is string => !!n) ?? []

        return {
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          muscle_groups: muscleGroups,
          difficulty_level: e.difficulty_level,
          movement_pattern: e.movement_pattern,
          is_custom: e.owner_id === trainerId,
        }
      })

      return mcpSuccess({ exercises, total: count ?? 0 })
    }
  )
}
