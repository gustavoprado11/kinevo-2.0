import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { SYSTEM_PRESETS, COMPOUND_METHOD_KEYS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

export function registerExerciseReadTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_training_methods',
    "List the advanced prescription capabilities available when building or editing workouts: training-method presets (pyramid, drop-set, cluster, 5x5, top+backoff), the per-set scheme fields, the valid set types, and how supersets work. Call this before prescribing advanced methods so you pass the right method_key, set_scheme, and rounds to kinevo_add_exercise_to_session / kinevo_update_workout_item.",
    {},
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async () => {
      const supabaseAdmin = createAdminClient()

      // System presets (static) + any custom presets this trainer saved.
      const methods = (Object.keys(SYSTEM_PRESETS) as Array<keyof typeof SYSTEM_PRESETS>).map(key => {
        const p = SYSTEM_PRESETS[key]
        return {
          method_key: p.key,
          name: p.name,
          description: p.description,
          is_compound: COMPOUND_METHOD_KEYS.has(p.key),
          default_rounds: p.defaultRounds,
          default_set_scheme: p.defaultSetsConfig,
        }
      })

      let customMethods: Array<{ method_key: string; name: string; description: string | null }> = []
      const { data: customRows } = await supabaseAdmin
        .from('training_method_presets')
        .select('key, name, description')
        .eq('trainer_id', trainerId)
      if (customRows) {
        customMethods = customRows.map(r => ({ method_key: r.key, name: r.name, description: r.description }))
      }

      return mcpSuccess({
        how_to_use: 'Pass method_key + set_scheme to kinevo_add_exercise_to_session or kinevo_update_workout_item. set_scheme is an array of per-set objects (set_number is auto-assigned). For compound methods (drop_set, cluster) provide ONE round in set_scheme and set rounds > 1 to repeat it. The parent sets/reps/rest_seconds are derived automatically. method_key="standard" means a simple non-scheme prescription; "custom" means a hand-built scheme matching no preset.',
        set_scheme_fields: {
          set_type: "One of: 'warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap'",
          reps: "Free-form rep target per set: '8', '8-12', 'AMRAP', '8+4+2' (cluster)",
          rest_seconds: 'Rest in seconds after this set',
          weight_target_kg: 'Optional absolute load in kg for this set',
          weight_target_pct1rm: 'Optional load as % of 1RM for this set',
          rir: 'Optional reps-in-reserve target',
          tempo: "Optional tempo string, e.g. '3-1-1-0'",
          notes: 'Optional per-set note',
        },
        methods,
        custom_methods: customMethods,
        supersets: {
          how: 'Use kinevo_create_superset to group 2+ exercises performed back-to-back with rest only after the group. The superset is a container item (item_type "superset") holding child exercises; rest_seconds on the container is the rest between rounds. Per-set schemes are not supported inside superset children (V1).',
        },
      })
    }
  )

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
