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
    { title: 'Listar métodos de treino', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
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
    "Search the exercise catalog. Returns exercises available to this trainer (system exercises + trainer's custom exercises). Filter by muscle group, equipment, or name. Results are ordered with PRIMARY/COMPOUND movements FIRST (is_primary_movement=true, session_position='first' — e.g. squat, deadlift, row, pulldown, bench, press): use those as the MAIN lift at the start of each session, and the accessories/isolation that follow to add volume. Prefer compound staples over obscure isolation/mobility variants.",
    {
      search: z.string().optional().describe('Search by exercise name (partial match)'),
      muscle_group: z.string().optional().describe("Filter by muscle group name (e.g., 'Peitoral', 'Quadriceps', 'Biceps')"),
      equipment: z.string().optional().describe("Filter by equipment (e.g., 'Barra', 'Halter', 'Maquina', 'Cabo')"),
      limit: z.number().min(1).max(100).default(30),
      offset: z.number().min(0).default(0),
    },
    { title: 'Listar exercícios', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
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
          'id, name, equipment, difficulty_level, movement_pattern, is_primary_movement, session_position, owner_id, exercise_muscle_groups(muscle_groups(name))',
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

      // Ordena COMPOSTOS/PRIMÁRIOS primeiro (is_primary_movement). Antes era
      // alfabético, o que jogava acessórios/mobilidade (Abdução, Avião, Andar
      // Calcanhar…) pro topo e o LLM os escolhia como principais — prescrição ruim.
      query = query
        .order('is_primary_movement', { ascending: false })
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
          // Sinal-chave p/ prescrição: compostos/principais (use como MAIN, no início
          // da sessão) vs acessórios. Os primários vêm primeiro na lista.
          is_primary_movement: e.is_primary_movement,
          session_position: e.session_position,
          is_custom: e.owner_id === trainerId,
        }
      })

      return mcpSuccess({ exercises, total: count ?? 0 })
    }
  )

  server.tool(
    'kinevo_find_exercise_substitutes',
    "Find substitute candidates for an exercise (injury/pain, missing equipment, or preference). Returns the reference exercise plus catalog alternatives that share its movement pattern and/or muscle groups, and — when student_id is given — the student's medical restrictions. THE TOOL DOES NOT DO CLINICAL REASONING: from the candidates, YOU pick 2-3 options that avoid the limitation the trainer described (e.g. shoulder pain → prefer neutral-grip/machine variants, avoid overhead), explain why, and let the trainer choose. Then apply the swap with kinevo_update_workout_item if a program item was given.",
    {
      exercise_id: z.string().uuid().optional().describe('The exercise to substitute (preferred when known).'),
      exercise_name: z.string().min(2).optional().describe('Alternative to exercise_id: resolve by name (partial match).'),
      student_id: z.string().uuid().optional().describe("When set, includes the student's medical restrictions to inform the choice."),
      limit: z.number().min(3).max(30).default(12).describe('Max candidates to return.'),
    },
    { title: 'Buscar substitutos de exercício', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ exercise_id, exercise_name, student_id, limit }) => {
      if (!exercise_id && !exercise_name) {
        return mcpError('Informe exercise_id ou exercise_name.')
      }
      const supabaseAdmin = createAdminClient()

      // Resolve o exercício de referência.
      let refQuery = supabaseAdmin
        .from('exercises')
        .select('id, name, equipment, movement_pattern, is_primary_movement, exercise_muscle_groups(muscle_group_id, muscle_groups(name))')
        .eq('is_archived', false)
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
        .limit(5)
      refQuery = exercise_id ? refQuery.eq('id', exercise_id) : refQuery.ilike('name', `%${exercise_name}%`)
      const { data: refMatches, error: refErr } = await refQuery
      if (refErr) return mcpError(`Erro ao buscar exercício: ${refErr.message}`)
      if (!refMatches || refMatches.length === 0) {
        return mcpError('Exercício não encontrado no catálogo.')
      }
      if (!exercise_id && refMatches.length > 1) {
        return mcpSuccess({
          ambiguous: true,
          matches: refMatches.map((e) => ({ id: e.id, name: e.name, equipment: e.equipment })),
          message: 'Mais de um exercício casa com esse nome — escolha um e chame de novo com exercise_id.',
        })
      }
      const ref = refMatches[0]
      const refMgs = (ref.exercise_muscle_groups as unknown as Array<{ muscle_group_id: string; muscle_groups: { name: string } | null }>) ?? []
      const refMgIds = refMgs.map((x) => x.muscle_group_id)
      const refMgNames = refMgs.map((x) => x.muscle_groups?.name).filter((n): n is string => !!n)

      // Candidatos: mesmo padrão de movimento OU mesmo(s) grupo(s) muscular(es).
      let candidateIds: string[] | null = null
      if (refMgIds.length > 0) {
        const { data: emg } = await supabaseAdmin
          .from('exercise_muscle_groups')
          .select('exercise_id')
          .in('muscle_group_id', refMgIds)
        candidateIds = Array.from(new Set((emg ?? []).map((e) => e.exercise_id))).filter((id) => id !== ref.id)
      }

      let candQuery = supabaseAdmin
        .from('exercises')
        .select('id, name, equipment, movement_pattern, is_primary_movement, session_position, owner_id, exercise_muscle_groups(muscle_groups(name))')
        .eq('is_archived', false)
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
        .neq('id', ref.id)
      if (ref.movement_pattern && candidateIds && candidateIds.length > 0) {
        // padrão igual OU grupo muscular compartilhado
        candQuery = candQuery.or(`movement_pattern.eq.${ref.movement_pattern},id.in.(${candidateIds.slice(0, 200).join(',')})`)
      } else if (ref.movement_pattern) {
        candQuery = candQuery.eq('movement_pattern', ref.movement_pattern)
      } else if (candidateIds && candidateIds.length > 0) {
        candQuery = candQuery.in('id', candidateIds.slice(0, 200))
      } else {
        return mcpError('Exercício de referência sem padrão de movimento nem grupos musculares — não há como sugerir substitutos pelo catálogo.')
      }
      const { data: cands, error: candErr } = await candQuery
        .order('is_primary_movement', { ascending: false })
        .order('name')
        .limit(limit)
      if (candErr) return mcpError(`Erro ao buscar candidatos: ${candErr.message}`)

      // Restrições médicas do aluno (opcional).
      let medicalRestrictions: string[] | null = null
      let studentName: string | null = null
      if (student_id) {
        const { data: student } = await supabaseAdmin
          .from('students')
          .select('id, name')
          .eq('id', student_id)
          .eq('coach_id', trainerId)
          .single()
        if (!student) return mcpError('Aluno não encontrado ou não pertence a este treinador.')
        studentName = student.name
        const { data: profile } = await supabaseAdmin
          .from('student_prescription_profiles')
          .select('medical_restrictions')
          .eq('student_id', student_id)
          .eq('trainer_id', trainerId)
          .maybeSingle()
        medicalRestrictions = (profile?.medical_restrictions as string[] | null) ?? null
      }

      const candidates = (cands ?? []).map((e) => {
        const emgs = e.exercise_muscle_groups as unknown as Array<{ muscle_groups: { name: string } | null }>
        return {
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          movement_pattern: e.movement_pattern,
          muscle_groups: emgs?.map((x) => x.muscle_groups?.name).filter((n): n is string => !!n) ?? [],
          is_primary_movement: e.is_primary_movement,
          same_pattern: !!ref.movement_pattern && e.movement_pattern === ref.movement_pattern,
          is_custom: e.owner_id === trainerId,
        }
      })

      return mcpSuccess({
        reference: {
          id: ref.id,
          name: ref.name,
          equipment: ref.equipment,
          movement_pattern: ref.movement_pattern,
          muscle_groups: refMgNames,
        },
        candidates,
        student: studentName ? { id: student_id, name: studentName } : null,
        medical_restrictions: medicalRestrictions,
        message: `${candidates.length} candidato(s) a substituto de ${ref.name}. Escolha os clinicamente adequados à limitação descrita e proponha ao treinador.`,
      })
    }
  )
}
