import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import { SYSTEM_PRESETS, COMPOUND_METHOD_KEYS } from '@kinevo/shared/lib/prescription/set-scheme-presets'
import { resolveGroupNames, balanceAcrossGroups } from './exercise-selection'

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
    "Search the exercise catalog. Returns exercises available to this trainer (system exercises + trainer's custom exercises). Filter by muscle group, equipment, or name. When PLANNING A PROGRAM, fetch ALL the muscle groups you need in ONE call via muscle_groups (e.g. muscle_groups: ['Peito','Costas','Ombros','Quadríceps','Posterior de Coxa','Glúteo'], limit: 100) — the result comes BALANCED per group; NEVER call this tool once per group. To look up SPECIFIC exercises by name, pass ALL the names in ONE call via searches (e.g. searches: ['Stiff','Hip Thrust','Remada Curvada']) — NEVER call once per name; each extra call re-sends your whole context. Results are ordered with PRIMARY/COMPOUND movements FIRST (is_primary_movement=true, session_position='first' — e.g. squat, deadlift, row, pulldown, bench, press): use those as the MAIN lift at the start of each session, and the accessories/isolation that follow to add volume. Prefer compound staples over obscure isolation/mobility variants.",
    {
      search: z.string().optional().describe('Search by ONE exercise name (partial match). For several names, use searches instead.'),
      searches: z.array(z.string().min(2)).min(1).max(20).optional().describe("BATCH name search: ALL the specific exercise names you want to look up, in ONE call (e.g. ['Stiff','Hip Thrust','Búlgaro']). Returns matches grouped per term. ALWAYS prefer this over calling once per name. Takes precedence over the other filters."),
      muscle_group: z.string().optional().describe("Filter by ONE muscle group name (e.g., 'Peito', 'Quadríceps', 'Bíceps'). For several groups, use muscle_groups instead."),
      muscle_groups: z.array(z.string()).min(1).max(12).optional().describe("BATCH filter: ALL the muscle groups you need, in ONE call (e.g. every group of the split you are planning). The result is balanced per group, compounds first. ALWAYS prefer this over calling once per group."),
      equipment: z.string().optional().describe("Filter by equipment (e.g., 'Barra', 'Halter', 'Maquina', 'Cabo')"),
      limit: z.number().min(1).max(100).default(30),
      offset: z.number().min(0).default(0),
    },
    { title: 'Listar exercícios', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ search, searches, muscle_group, muscle_groups, equipment, limit, offset }) => {
      const supabaseAdmin = createAdminClient()

      // Lote de buscas NOMINAIS (searches[]): resolve TODOS os termos numa única
      // chamada. O padrão de prod era 6–16 buscas seriais por build — cada uma
      // re-paga o contexto inteiro do turno, e builds morriam no teto de passos
      // sem criar nada (visto em 2026-07-07). Precedência sobre os demais filtros.
      if (searches?.length) {
        const perTerm = await Promise.all(
          searches.map(async term => {
            const { data, error } = await supabaseAdmin
              .from('exercises')
              .select('id, name, equipment, difficulty_level, movement_pattern, is_primary_movement, session_position, owner_id, exercise_muscle_groups(muscle_groups(name))')
              .eq('is_archived', false)
              .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
              .ilike('name', `%${term}%`)
              .order('is_primary_movement', { ascending: false })
              .order('name')
              .limit(6)
            if (error) return { term, error: error.message, exercises: null }
            const exercises = (data ?? []).map(e => {
              const emgs = e.exercise_muscle_groups as unknown as Array<{ muscle_groups: { name: string } | null }>
              return {
                id: e.id,
                name: e.name,
                equipment: e.equipment,
                muscle_groups: emgs?.map(emg => emg.muscle_groups?.name).filter((n): n is string => !!n) ?? [],
                movement_pattern: e.movement_pattern,
                is_primary_movement: e.is_primary_movement,
                is_custom: e.owner_id === trainerId,
              }
            })
            return { term, error: null, exercises }
          })
        )
        const failed = perTerm.filter(r => r.error !== null)
        if (failed.length === perTerm.length) {
          return mcpError(`Erro ao buscar exercícios: ${failed[0].error}`)
        }
        const missing = perTerm
          .filter(r => r.exercises !== null && r.exercises.length === 0)
          .map(r => r.term)
        const results: Record<string, unknown> = {}
        for (const r of perTerm) {
          if (r.exercises !== null) results[r.term] = r.exercises
        }
        return mcpSuccess({
          results_by_search: results,
          message:
            (missing.length > 0
              ? `Termos SEM resultado: ${missing.join(', ')} — use uma variação do nome ou escolha um equivalente do catálogo por grupo. `
              : '') +
            'Buscas resolvidas em lote. Você já tem o que pediu — monte/edite o programa agora, SEM novas buscas.',
        })
      }

      // Filtro por grupo(s): nomes pedidos → grupos reais via resolveGroupNames
      // (insensível a acento/caixa, substring bidirecional — o ilike antigo era
      // sensível a acento e unidirecional: 'Peitoral' devolvia VAZIO contra o
      // grupo real "Peito", e o modelo re-tentava às cegas queimando passos).
      const requested = muscle_groups?.length ? muscle_groups : muscle_group ? [muscle_group] : []
      const batchMode = requested.length > 1

      // Ids dos muscle_groups casados — o filtro da query principal usa ESTES ids
      // (via !inner join), nunca a lista de exercise_ids: 8 grupos ≈ 455 exercícios,
      // e 455 UUIDs num .in() estouram o limite de headers do fetch
      // (UND_ERR_HEADERS_OVERFLOW) — a query falhava e o modelo degradava pro
      // padrão antigo de uma chamada por grupo.
      let mgIdList: string[] | null = null
      // exercise_id → grupos pedidos a que pertence (para o balanceamento do lote).
      let membership: Map<string, string[]> | null = null
      let groupOrder: string[] = []

      if (requested.length > 0) {
        const { data: allGroups } = await supabaseAdmin.from('muscle_groups').select('id, name')
        const resolved = resolveGroupNames(requested, allGroups ?? [])
        groupOrder = [...resolved.matches.keys()]

        if (groupOrder.length === 0) {
          // Feedback acionável em vez de lista vazia muda: o modelo corrige o nome
          // na PRÓXIMA chamada em vez de re-tentar variações às cegas.
          const known = (allGroups ?? []).map(g => g.name).join(', ')
          return mcpSuccess({
            exercises: [],
            total: 0,
            message: `Nenhum grupo muscular corresponde a: ${requested.join(', ')}. Grupos existentes: ${known}.`,
          })
        }

        const mgIdToGroup = new Map<string, string>()
        for (const [group, ids] of resolved.matches) {
          for (const id of ids) mgIdToGroup.set(id, group)
        }
        const { data: emgData } = await supabaseAdmin
          .from('exercise_muscle_groups')
          .select('exercise_id, muscle_group_id')
          .in('muscle_group_id', [...mgIdToGroup.keys()])

        membership = new Map()
        for (const row of emgData ?? []) {
          const group = mgIdToGroup.get(row.muscle_group_id)
          if (!group) continue
          const groups = membership.get(row.exercise_id)
          if (groups) {
            if (!groups.includes(group)) groups.push(group)
          } else {
            membership.set(row.exercise_id, [group])
          }
        }
        if (membership.size === 0) {
          return mcpSuccess({ exercises: [], total: 0 })
        }
        mgIdList = [...mgIdToGroup.keys()]
      }

      // Com filtro de grupo, o embed vira !inner e o .in() roda sobre os ids de
      // MUSCLE_GROUPS (poucos) na tabela embutida — o PostgREST filtra os pais
      // pelo join. Nunca filtrar por lista de exercise_ids (ver mgIdList acima).
      let query = supabaseAdmin
        .from('exercises')
        .select(
          mgIdList
            ? 'id, name, equipment, difficulty_level, movement_pattern, is_primary_movement, session_position, owner_id, exercise_muscle_groups!inner(muscle_group_id, muscle_groups(name))'
            : 'id, name, equipment, difficulty_level, movement_pattern, is_primary_movement, session_position, owner_id, exercise_muscle_groups(muscle_groups(name))',
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
      if (mgIdList) {
        query = query.in('exercise_muscle_groups.muscle_group_id', mgIdList)
      }

      // Ordena COMPOSTOS/PRIMÁRIOS primeiro (is_primary_movement). Antes era
      // alfabético, o que jogava acessórios/mobilidade (Abdução, Avião, Andar
      // Calcanhar…) pro topo e o LLM os escolhia como principais — prescrição ruim.
      // Lote (2+ grupos): busca AMPLA (o balanceamento por grupo acontece em JS,
      // sobre o conjunto inteiro — um range estreito deixaria grupos de fora);
      // offset não se aplica (a resposta balanceada não é paginável).
      query = query
        .order('is_primary_movement', { ascending: false })
        .order('name')
        .range(batchMode ? 0 : offset, batchMode ? 499 : offset + limit - 1)

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

      if (batchMode && membership) {
        const { selected, perGroup } = balanceAcrossGroups(exercises, groupOrder, membership, limit)
        return mcpSuccess({
          exercises: selected,
          total: count ?? 0,
          balanced_by_group: perGroup,
          message:
            'Catálogo balanceado por grupo (compostos primeiro, agrupados na ordem pedida). Você já tem exercícios de TODOS os grupos — monte o programa agora, sem novas buscas.',
        })
      }

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
