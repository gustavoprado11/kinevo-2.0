import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import type { WorkoutSet } from '@kinevo/shared/types/prescription'
import {
  summarizeSetScheme,
  summarizeWithRounds,
  expandSchemeByRounds,
  validateSetScheme,
} from '@kinevo/shared/lib/prescription/set-scheme'

type WorkoutType = 'template' | 'assigned'

// ----------------------------------------------------------------------------
// Weekly scheduling
// ----------------------------------------------------------------------------
// `assigned_workouts.scheduled_days` is an integer array using JS getDay()
// convention (0=Sunday … 6=Saturday). `workout_templates.frequency` is the
// equivalent string-code array ('sun','mon',…,'sat'). The MCP exposes a single
// integer-array param and converts to the right column per program type.

export const DAY_INT_TO_STR: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

/** Zod schema for `scheduled_days`: weekday integers (0=Sunday … 6=Saturday). */
const scheduledDaysZod = z.array(z.number().int().min(0).max(6))
  .describe('Days of the week this session is scheduled on, as integers (0=Sunday, 1=Monday, … 6=Saturday). E.g. [1,3,5] = Mon/Wed/Fri. Pass [] to clear the schedule.')

/** Build the column patch for a session schedule given the program type. */
function scheduleColumn(programType: WorkoutType, days: number[]): Record<string, unknown> {
  const unique = Array.from(new Set(days)).sort((a, b) => a - b)
  return programType === 'template'
    ? { frequency: unique.map(d => DAY_INT_TO_STR[d]) }
    : { scheduled_days: unique }
}

// ----------------------------------------------------------------------------
// Per-set prescription (advanced methods: pyramid, drop-set, cluster, 5x5, …)
// ----------------------------------------------------------------------------

/** Zod schema for one prescribed set inside a `set_scheme`. `set_number` is
 *  assigned automatically from array position, so callers never pass it. */
export const setSchemaZod = z.object({
  set_type: z.enum(['warmup', 'normal', 'top', 'backoff', 'drop', 'failure', 'cluster', 'amrap'])
    .default('normal')
    .describe("Type of set. 'normal' for straight sets; 'top'/'backoff' for top+backoff; 'drop' for drop-set quedas; 'cluster' for rest-pause; 'warmup'/'failure'/'amrap' as named."),
  reps: z.string().describe("Reps for this set (e.g., '8', '8-12', 'AMRAP', '8+4+2' for cluster)"),
  rest_seconds: z.number().min(0).max(600).default(60).describe('Rest in seconds AFTER this set'),
  weight_target_kg: z.number().nullable().optional().describe('Suggested absolute load in kg for this set'),
  weight_target_pct1rm: z.number().nullable().optional().describe('Suggested load as % of 1RM for this set'),
  rir: z.number().nullable().optional().describe('Reps in reserve target'),
  tempo: z.string().nullable().optional().describe("Tempo string, e.g. '3-1-1-0'"),
  notes: z.string().nullable().optional().describe('Per-set note'),
})

/** Materialize a per-round `set_scheme` into the rows persisted to
 *  `workout_item_set_templates` / `assigned_workout_item_sets`, plus the
 *  aggregate `(sets, reps, rest_seconds)` triple mirrored on the parent item.
 *  Mirrors `insertSetSchemeRows` + `aggregatesFromItem` in the web builder so
 *  the MCP writes byte-for-byte the same shape. */
export function materializeScheme(scheme: WorkoutSet[], rounds: number | undefined) {
  const safeRounds = Math.max(1, Math.min(20, Math.floor(rounds ?? 1)))
  const useRounds = safeRounds > 1
  const aggregates = useRounds ? summarizeWithRounds(scheme, safeRounds) : summarizeSetScheme(scheme)
  const expanded = useRounds ? expandSchemeByRounds(scheme, safeRounds) : scheme
  const rows = expanded.map((s, i) => ({
    set_number: i + 1,
    set_type: s.set_type,
    reps: s.reps,
    rest_seconds: s.rest_seconds,
    weight_target_kg: s.weight_target_kg ?? null,
    weight_target_pct1rm: s.weight_target_pct1rm ?? null,
    rir: s.rir ?? null,
    tempo: s.tempo ?? null,
    notes: s.notes ?? null,
    round_number: useRounds ? (s.round_number ?? null) : null,
  }))
  return { aggregates, rows, rounds: safeRounds }
}

/** Turn the MCP `set_scheme` input (no set_number) into a validated
 *  `WorkoutSet[]` with contiguous set_number. Returns an error string when the
 *  scheme is incoherent. */
export function buildSetScheme(rawSets: Array<z.infer<typeof setSchemaZod>>): { scheme: WorkoutSet[] } | { error: string } {
  const scheme: WorkoutSet[] = rawSets.map((s, i) => ({
    set_number: i + 1,
    set_type: s.set_type,
    reps: s.reps,
    rest_seconds: s.rest_seconds,
    weight_target_kg: s.weight_target_kg ?? null,
    weight_target_pct1rm: s.weight_target_pct1rm ?? null,
    rir: s.rir ?? null,
    tempo: s.tempo ?? null,
    notes: s.notes ?? null,
  }))
  const validation = validateSetScheme(scheme)
  if (!validation.valid) {
    return { error: `set_scheme inválido: ${validation.errors.join('; ')}` }
  }
  return { scheme }
}

/** Replace the per-set rows of an item: deletes all existing rows then inserts
 *  the new ones. Pass an empty array to only clear. Returns an error string on
 *  failure, or null on success. */
async function replaceSchemeRows(
  supabaseAdmin: SupabaseClient,
  workoutType: WorkoutType,
  itemId: string,
  rows: Array<Record<string, unknown>>
): Promise<string | null> {
  const setTable = workoutType === 'template' ? 'workout_item_set_templates' : 'assigned_workout_item_sets'
  const fk = workoutType === 'template' ? 'workout_item_template_id' : 'assigned_workout_item_id'

  const { error: deleteError } = await supabaseAdmin.from(setTable).delete().eq(fk, itemId)
  if (deleteError) return deleteError.message
  if (rows.length === 0) return null

  const payload = rows.map(r => ({ ...r, [fk]: itemId }))
  const { error: insertError } = await supabaseAdmin.from(setTable).insert(payload)
  return insertError ? insertError.message : null
}

/** Verify a workout session belongs to a program owned by this trainer. */
async function verifyWorkoutOwnership(
  supabaseAdmin: SupabaseClient,
  workoutId: string,
  workoutType: WorkoutType,
  trainerId: string
): Promise<boolean> {
  if (workoutType === 'assigned') {
    const { data } = await supabaseAdmin
      .from('assigned_workouts')
      .select('id, assigned_programs(trainer_id)')
      .eq('id', workoutId)
      .single()
    const program = data?.assigned_programs as unknown as { trainer_id: string } | null
    return !!data && program?.trainer_id === trainerId
  }

  const { data } = await supabaseAdmin
    .from('workout_templates')
    .select('id, program_templates(trainer_id)')
    .eq('id', workoutId)
    .single()
  const program = data?.program_templates as unknown as { trainer_id: string } | null
  return !!data && program?.trainer_id === trainerId
}

/** Verify a workout item belongs to a workout in a program owned by this trainer. */
async function verifyItemOwnership(
  supabaseAdmin: SupabaseClient,
  itemId: string,
  workoutType: WorkoutType,
  trainerId: string
): Promise<boolean> {
  if (workoutType === 'assigned') {
    const { data } = await supabaseAdmin
      .from('assigned_workout_items')
      .select('id, assigned_workouts(assigned_programs(trainer_id))')
      .eq('id', itemId)
      .single()
    const workout = data?.assigned_workouts as unknown as { assigned_programs: { trainer_id: string } | null } | null
    return !!data && workout?.assigned_programs?.trainer_id === trainerId
  }

  const { data } = await supabaseAdmin
    .from('workout_item_templates')
    .select('id, workout_templates(program_templates(trainer_id))')
    .eq('id', itemId)
    .single()
  const workout = data?.workout_templates as unknown as { program_templates: { trainer_id: string } | null } | null
  return !!data && workout?.program_templates?.trainer_id === trainerId
}

export function registerWorkoutWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_add_workout_session',
    "Add a new workout session (e.g., 'Treino A - Peito e Triceps') to an existing program. Works for both templates and assigned programs. RECOMMENDED: also pass scheduled_days to place the session on specific weekdays — a well-prescribed program tells the student which days to train each session, which drives the student's weekly calendar and reminders.",
    {
      program_id: z.string().uuid().describe('The program ID to add the session to'),
      program_type: z.enum(['template', 'assigned']).default('assigned').describe('Whether the program is a template or assigned'),
      name: z.string().describe("Session name (e.g., 'Treino A - Peito e Triceps')"),
      order_index: z.number().min(0).optional().describe('Position in the program. If omitted, appends at the end.'),
      scheduled_days: scheduledDaysZod.optional(),
    },
    { title: 'Adicionar sessão de treino', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ program_id, program_type, name, order_index, scheduled_days }) => {
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

      const sortedDays = scheduled_days !== undefined
        ? Array.from(new Set(scheduled_days)).sort((a, b) => a - b)
        : undefined

      // Branch por tabela para manter o payload tipado contra o schema gerado
      const { data, error } = program_type === 'template'
        ? await supabaseAdmin
            .from('workout_templates')
            .insert({
              program_template_id: program_id,
              name,
              order_index: finalOrderIndex,
              ...(sortedDays !== undefined ? { frequency: sortedDays.map(d => DAY_INT_TO_STR[d]) } : {}),
            })
            .select('id, name, order_index')
            .single()
        : await supabaseAdmin
            .from('assigned_workouts')
            .insert({
              assigned_program_id: program_id,
              name,
              order_index: finalOrderIndex,
              ...(sortedDays !== undefined ? { scheduled_days: sortedDays } : {}),
            })
            .select('id, name, order_index')
            .single()

      if (error || !data) {
        return mcpError(`Erro ao criar sessão de treino: ${error?.message ?? 'desconhecido'}`)
      }

      const scheduleMsg = scheduled_days?.length
        ? ` Agendada em: ${scheduled_days.slice().sort((a, b) => a - b).map(d => DAY_INT_TO_STR[d]).join(', ')}.`
        : ''
      return mcpSuccess({
        workout: data,
        message: `Sessão "${data.name}" adicionada ao programa na posição ${data.order_index}.${scheduleMsg}`,
      })
    }
  )

  server.tool(
    'kinevo_add_exercise_to_session',
    "Add an exercise to a workout session. Supports both simple prescription (sets + reps + rest) and advanced per-set prescription (set_scheme) with different reps/load/rest per set, training methods (pyramid, drop-set, cluster, 5x5, top+backoff) and per-set load targets (kg or %1RM). Call kinevo_list_training_methods to see method presets. To group exercises into a superset, use kinevo_create_superset instead.",
    {
      workout_id: z.string().uuid().describe('The workout session ID to add the exercise to'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
      exercise_id: z.string().uuid().describe('The exercise ID from the catalog'),
      sets: z.number().min(1).max(20).optional().describe('Number of sets (simple mode). Ignored when set_scheme is provided.'),
      reps: z.string().optional().describe("Reps prescription (simple mode, e.g., '12', '8-12', 'AMRAP'). Ignored when set_scheme is provided."),
      rest_seconds: z.number().min(0).max(600).optional().default(90).describe('Rest between sets in seconds (simple mode)'),
      notes: z.string().optional().describe("Special instructions (e.g., 'Carga inicial: 80kg', 'Controlar a excêntrica')"),
      exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().default('main').describe('The role of this exercise in the session'),
      order_index: z.number().min(0).optional().describe('Position in the session. If omitted, appends at the end.'),
      method_key: z.enum(['standard', 'custom', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).optional().describe("Training method label. Use with set_scheme. 'custom' for a hand-built scheme that matches no preset."),
      set_scheme: z.array(setSchemaZod).min(1).optional().describe('Advanced per-set prescription. Each entry is one set (or, for compound methods, one phase of a round). When provided, sets/reps/rest_seconds are derived from it. For drop-set/cluster pass ONE round here and set rounds>1.'),
      rounds: z.number().min(1).max(20).optional().describe('Number of rounds the set_scheme repeats (compound methods like drop-set/cluster). Defaults to 1 (linear methods).'),
    },
    { title: 'Adicionar exercício à sessão', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ workout_id, workout_type, exercise_id, sets, reps, rest_seconds, notes, exercise_function, order_index, method_key, set_scheme, rounds }) => {
      const supabaseAdmin = createAdminClient()

      const owns = await verifyWorkoutOwnership(supabaseAdmin, workout_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
      }

      // Resolve prescription: advanced (set_scheme) or simple (sets/reps).
      let aggregates: { sets: number; reps: string; rest_seconds: number }
      let schemeRows: Array<Record<string, unknown>> | null = null
      let effectiveRounds = 1

      if (set_scheme && set_scheme.length > 0) {
        const built = buildSetScheme(set_scheme)
        if ('error' in built) return mcpError(built.error)
        const m = materializeScheme(built.scheme, rounds)
        aggregates = m.aggregates
        schemeRows = m.rows
        effectiveRounds = m.rounds
      } else {
        if (sets === undefined || reps === undefined) {
          return mcpError('Informe sets e reps (modo simples) ou set_scheme (modo avançado).')
        }
        aggregates = { sets, reps, rest_seconds: rest_seconds ?? 90 }
      }

      // Get exercise info for snapshots. Escopo: só exercícios do sistema
      // (owner_id null) ou do próprio treinador — impede referenciar exercício
      // privado de OUTRO treinador (vazaria nome/equipamento).
      const { data: exercise } = await supabaseAdmin
        .from('exercises')
        .select('id, name, equipment')
        .eq('id', exercise_id)
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
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

      const baseItem = {
        item_type: 'exercise',
        exercise_id,
        sets: aggregates.sets,
        reps: aggregates.reps,
        rest_seconds: aggregates.rest_seconds,
        notes: notes ?? null,
        exercise_function: exercise_function ?? 'main',
        order_index: finalOrderIndex,
        method_key: method_key ?? null,
        rounds: effectiveRounds,
      }

      // Branch por tabela para manter o payload tipado; assigned guarda snapshots do exercício
      const { data, error } = workout_type === 'template'
        ? await supabaseAdmin
            .from('workout_item_templates')
            .insert({ ...baseItem, workout_template_id: workout_id })
            .select('id, order_index, sets, reps, rest_seconds')
            .single()
        : await supabaseAdmin
            .from('assigned_workout_items')
            .insert({
              ...baseItem,
              assigned_workout_id: workout_id,
              exercise_name: exercise.name,
              exercise_equipment: exercise.equipment,
            })
            .select('id, order_index, sets, reps, rest_seconds')
            .single()

      if (error || !data) {
        return mcpError(`Erro ao adicionar exercício: ${error?.message ?? 'desconhecido'}`)
      }

      // Persist per-set rows when an advanced scheme was provided.
      if (schemeRows) {
        const schemeError = await replaceSchemeRows(supabaseAdmin, workout_type, data.id, schemeRows)
        if (schemeError) {
          // Roll back the orphan item so we don't leave a half-written exercise.
          await supabaseAdmin.from(itemTable).delete().eq('id', data.id)
          return mcpError(`Erro ao gravar as séries do método: ${schemeError}`)
        }
      }

      return mcpSuccess({
        workout_item: {
          id: data.id,
          exercise_name: exercise.name,
          sets: data.sets,
          reps: data.reps,
          rest_seconds: data.rest_seconds,
          order_index: data.order_index,
          method_key: method_key ?? null,
          rounds: effectiveRounds,
          set_count: schemeRows?.length ?? null,
        },
        message: schemeRows
          ? `${exercise.name} adicionado com método ${method_key ?? 'custom'} (${schemeRows.length} séries${effectiveRounds > 1 ? `, ${effectiveRounds} rodadas` : ''}).`
          : `${exercise.name} adicionado: ${data.sets}x${data.reps}, descanso ${data.rest_seconds}s.`,
      })
    }
  )

  server.tool(
    'kinevo_update_workout_session',
    'Rename, reorder, or reschedule an existing workout session in a program. Use this to edit a session in-place without recreating the program — including setting which weekdays the session falls on (scheduled_days).',
    {
      workout_id: z.string().uuid().describe('The workout session ID to update'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
      name: z.string().optional().describe("New session name (e.g., 'Treino A - Segunda')"),
      order_index: z.number().min(0).optional().describe('New position in the program'),
      scheduled_days: scheduledDaysZod.optional(),
    },
    { title: 'Atualizar sessão de treino', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ workout_id, workout_type, name, order_index, scheduled_days }) => {
      const supabaseAdmin = createAdminClient()

      if (name === undefined && order_index === undefined && scheduled_days === undefined) {
        return mcpError('Informe ao menos um campo para atualizar (name, order_index ou scheduled_days).')
      }

      const owns = await verifyWorkoutOwnership(supabaseAdmin, workout_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
      }

      const workoutTable = workout_type === 'template' ? 'workout_templates' : 'assigned_workouts'

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (order_index !== undefined) updateData.order_index = order_index
      if (scheduled_days !== undefined) {
        Object.assign(updateData, scheduleColumn(workout_type, scheduled_days))
      }

      const { data, error } = await supabaseAdmin
        .from(workoutTable)
        .update(updateData)
        .eq('id', workout_id)
        .select('id, name, order_index')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao atualizar sessão: ${error?.message ?? 'desconhecido'}`)
      }

      const scheduleMsg = scheduled_days !== undefined
        ? scheduled_days.length
          ? ` Agendada em: ${scheduled_days.slice().sort((a, b) => a - b).map(d => DAY_INT_TO_STR[d]).join(', ')}.`
          : ' Agendamento removido.'
        : ''
      return mcpSuccess({
        workout: data,
        message: `Sessão "${data.name}" atualizada.${scheduleMsg}`,
      })
    }
  )

  server.tool(
    'kinevo_delete_workout_session',
    'Delete a workout session from a program. This permanently removes the session and all its exercises (cascade). Use to clean up old sessions when editing a program in-place.',
    {
      workout_id: z.string().uuid().describe('The workout session ID to delete'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
    },
    { title: 'Excluir sessão de treino', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ workout_id, workout_type }) => {
      const supabaseAdmin = createAdminClient()

      const owns = await verifyWorkoutOwnership(supabaseAdmin, workout_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
      }

      const workoutTable = workout_type === 'template' ? 'workout_templates' : 'assigned_workouts'

      const { data, error } = await supabaseAdmin
        .from(workoutTable)
        .delete()
        .eq('id', workout_id)
        .select('id, name')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao remover sessão: ${error?.message ?? 'desconhecido'}`)
      }

      return mcpSuccess({
        deleted_workout: data,
        message: `Sessão "${data.name}" e seus exercícios foram removidos.`,
      })
    }
  )

  server.tool(
    'kinevo_update_workout_item',
    "Edit an exercise inside a workout session in-place: change sets, reps, rest, notes, function, training method, position, or swap the exercise itself. Also supports advanced per-set prescription via set_scheme (replaces the whole per-set scheme). Only the fields you pass are changed.",
    {
      item_id: z.string().uuid().describe('The workout item (exercise) ID to update'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
      exercise_id: z.string().uuid().optional().describe('Swap to a different exercise from the catalog'),
      sets: z.number().min(1).max(20).optional().describe('Number of sets (simple mode). Ignored when set_scheme is provided.'),
      reps: z.string().optional().describe("Reps prescription (simple mode). Ignored when set_scheme is provided."),
      rest_seconds: z.number().min(0).max(600).optional().describe('Rest between sets in seconds (simple mode)'),
      notes: z.string().nullable().optional().describe('Special instructions. Pass null to clear.'),
      exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().describe('The role of this exercise in the session'),
      method_key: z.enum(['standard', 'custom', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).nullable().optional().describe("Training method label. Pass null or 'standard' to clear."),
      order_index: z.number().min(0).optional().describe('New position in the session'),
      set_scheme: z.array(setSchemaZod).optional().describe('Advanced per-set prescription. Replaces the entire existing scheme. Pass an empty array [] to remove the scheme and revert to simple mode (also clears method_key). When non-empty, sets/reps/rest_seconds are derived from it.'),
      rounds: z.number().min(1).max(20).optional().describe('Rounds the set_scheme repeats (compound methods). Defaults to 1.'),
    },
    { title: 'Atualizar exercício', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ item_id, workout_type, exercise_id, sets, reps, rest_seconds, notes, exercise_function, method_key, order_index, set_scheme, rounds }) => {
      const supabaseAdmin = createAdminClient()

      const owns = await verifyItemOwnership(supabaseAdmin, item_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Exercício não encontrado ou não pertence a este treinador.')
      }

      const updateData: Record<string, unknown> = {}
      if (rest_seconds !== undefined) updateData.rest_seconds = rest_seconds
      if (notes !== undefined) updateData.notes = notes
      if (exercise_function !== undefined) updateData.exercise_function = exercise_function
      if (method_key !== undefined) updateData.method_key = method_key
      if (order_index !== undefined) updateData.order_index = order_index

      // Advanced per-set scheme handling. A non-empty scheme overrides
      // sets/reps/rest aggregates; an empty array clears the scheme.
      let schemeRows: Array<Record<string, unknown>> | null = null
      let clearScheme = false
      if (set_scheme !== undefined) {
        if (set_scheme.length === 0) {
          clearScheme = true
          updateData.rounds = 1
          if (method_key === undefined) updateData.method_key = null
        } else {
          const built = buildSetScheme(set_scheme)
          if ('error' in built) return mcpError(built.error)
          const m = materializeScheme(built.scheme, rounds)
          schemeRows = m.rows
          updateData.sets = m.aggregates.sets
          updateData.reps = m.aggregates.reps
          updateData.rest_seconds = m.aggregates.rest_seconds
          updateData.rounds = m.rounds
        }
      } else {
        if (sets !== undefined) updateData.sets = sets
        if (reps !== undefined) updateData.reps = reps
      }

      // Swapping the exercise: validate catalog and refresh snapshots for assigned items
      if (exercise_id !== undefined) {
        const { data: exercise } = await supabaseAdmin
          .from('exercises')
          .select('id, name, equipment')
          .eq('id', exercise_id)
          .single()

        if (!exercise) {
          return mcpError('Exercício não encontrado no catálogo.')
        }

        updateData.exercise_id = exercise_id
        if (workout_type === 'assigned') {
          updateData.exercise_name = exercise.name
          updateData.exercise_equipment = exercise.equipment
        }
      }

      if (Object.keys(updateData).length === 0 && !schemeRows && !clearScheme) {
        return mcpError('Informe ao menos um campo para atualizar.')
      }

      const itemTable = workout_type === 'template' ? 'workout_item_templates' : 'assigned_workout_items'

      const { data, error } = await supabaseAdmin
        .from(itemTable)
        .update(updateData)
        .eq('id', item_id)
        .select('id, exercise_id, sets, reps, rest_seconds, notes, exercise_function, method_key, order_index, rounds')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao atualizar exercício: ${error?.message ?? 'desconhecido'}`)
      }

      // Replace per-set rows when a scheme was provided (non-empty) or clear them.
      if (schemeRows || clearScheme) {
        const schemeError = await replaceSchemeRows(supabaseAdmin, workout_type, item_id, schemeRows ?? [])
        if (schemeError) {
          return mcpError(`Erro ao gravar as séries do método: ${schemeError}`)
        }
      }

      return mcpSuccess({
        workout_item: data,
        message: schemeRows
          ? `Exercício atualizado com método ${data.method_key ?? 'custom'} (${schemeRows.length} séries).`
          : `Exercício atualizado: ${data.sets}x${data.reps}, descanso ${data.rest_seconds}s.`,
      })
    }
  )

  server.tool(
    'kinevo_create_superset',
    "Create a superset (or bi-set/tri-set) inside a workout session: a group of exercises performed back-to-back with rest taken only after the group. Creates the superset container plus its child exercises in one call. Works for templates and assigned programs.",
    {
      workout_id: z.string().uuid().describe('The workout session ID to add the superset to'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
      rest_seconds: z.number().min(0).max(600).optional().default(60).describe('Rest in seconds after each round of the superset'),
      order_index: z.number().min(0).optional().describe('Position of the superset in the session. If omitted, appends at the end.'),
      exercises: z.array(z.object({
        exercise_id: z.string().uuid().describe('Exercise ID from the catalog'),
        sets: z.number().min(1).max(20).describe('Number of rounds/sets for this exercise'),
        reps: z.string().describe("Reps prescription (e.g., '10', '8-12')"),
        exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().default('main'),
        notes: z.string().optional().describe('Special instructions for this exercise'),
      })).min(2).describe('The exercises in the superset, in order. At least 2.'),
    },
    { title: 'Criar superset', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ workout_id, workout_type, rest_seconds, order_index, exercises }) => {
      const supabaseAdmin = createAdminClient()

      const owns = await verifyWorkoutOwnership(supabaseAdmin, workout_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Sessão de treino não encontrada ou não pertence a este treinador.')
      }

      // Validate every exercise against the catalog up front (gather snapshots).
      // Escopo por owner: só sistema (owner_id null) ou do próprio treinador —
      // exercício de outro treinador cai como "não encontrado" abaixo.
      const catalog = new Map<string, { name: string; equipment: string | null }>()
      const { data: exerciseRows } = await supabaseAdmin
        .from('exercises')
        .select('id, name, equipment')
        .in('id', exercises.map(e => e.exercise_id))
        .or(`owner_id.is.null,owner_id.eq.${trainerId}`)

      for (const row of exerciseRows ?? []) {
        catalog.set(row.id, { name: row.name, equipment: row.equipment })
      }
      const missing = exercises.find(e => !catalog.has(e.exercise_id))
      if (missing) {
        return mcpError(`Exercício ${missing.exercise_id} não encontrado no catálogo.`)
      }

      const itemTable = workout_type === 'template' ? 'workout_item_templates' : 'assigned_workout_items'
      const fkColumn = workout_type === 'template' ? 'workout_template_id' : 'assigned_workout_id'

      // Compute parent order_index (append among root items) if not provided.
      let parentOrderIndex = order_index
      if (parentOrderIndex === undefined) {
        const { data: last } = await supabaseAdmin
          .from(itemTable)
          .select('order_index')
          .eq(fkColumn, workout_id)
          .is('parent_item_id', null)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()
        parentOrderIndex = last ? last.order_index + 1 : 0
      }

      // 1. Insert the superset container (item_type 'superset', no exercise).
      const parentInsert = {
        item_type: 'superset',
        parent_item_id: null,
        exercise_id: null,
        sets: null,
        reps: null,
        rest_seconds: rest_seconds ?? 60,
        order_index: parentOrderIndex,
        method_key: null,
        rounds: 1,
      }
      // Branch por tabela para manter o payload tipado contra o schema gerado
      const { data: parent, error: parentError } = workout_type === 'template'
        ? await supabaseAdmin
            .from('workout_item_templates')
            .insert({ ...parentInsert, workout_template_id: workout_id })
            .select('id, order_index')
            .single()
        : await supabaseAdmin
            .from('assigned_workout_items')
            .insert({ ...parentInsert, assigned_workout_id: workout_id })
            .select('id, order_index')
            .single()

      if (parentError || !parent) {
        return mcpError(`Erro ao criar superset: ${parentError?.message ?? 'desconhecido'}`)
      }

      // 2. Insert the child exercises under the parent.
      const childBase = (e: typeof exercises[number], i: number) => ({
        item_type: 'exercise',
        parent_item_id: parent.id,
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        rest_seconds: 0,
        notes: e.notes ?? null,
        exercise_function: e.exercise_function ?? 'main',
        order_index: i,
        method_key: null,
        rounds: 1,
      })

      // Branch por tabela para manter o payload tipado; assigned guarda snapshots do exercício
      const { error: childError } = workout_type === 'template'
        ? await supabaseAdmin.from('workout_item_templates').insert(
            exercises.map((e, i) => ({ ...childBase(e, i), workout_template_id: workout_id })),
          )
        : await supabaseAdmin.from('assigned_workout_items').insert(
            exercises.map((e, i) => {
              const snap = catalog.get(e.exercise_id)!
              return {
                ...childBase(e, i),
                assigned_workout_id: workout_id,
                exercise_name: snap.name,
                exercise_equipment: snap.equipment,
              }
            }),
          )
      if (childError) {
        // Roll back the parent (cascade removes any partial children).
        await supabaseAdmin.from(itemTable).delete().eq('id', parent.id)
        return mcpError(`Erro ao adicionar exercícios ao superset: ${childError.message}`)
      }

      return mcpSuccess({
        superset: {
          id: parent.id,
          order_index: parent.order_index,
          rest_seconds: rest_seconds ?? 60,
          exercises: exercises.map(e => ({ exercise_id: e.exercise_id, name: catalog.get(e.exercise_id)!.name })),
        },
        message: `Superset com ${exercises.length} exercícios criado, descanso ${rest_seconds ?? 60}s após cada rodada.`,
      })
    }
  )

  server.tool(
    'kinevo_delete_workout_item',
    'Remove an exercise from a workout session. This permanently deletes the item (and any superset children attached to it). Use to clean up exercises when editing a session in-place.',
    {
      item_id: z.string().uuid().describe('The workout item (exercise) ID to delete'),
      workout_type: z.enum(['template', 'assigned']).default('assigned'),
    },
    { title: 'Excluir exercício', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ item_id, workout_type }) => {
      const supabaseAdmin = createAdminClient()

      const owns = await verifyItemOwnership(supabaseAdmin, item_id, workout_type, trainerId)
      if (!owns) {
        return mcpError('Exercício não encontrado ou não pertence a este treinador.')
      }

      const itemTable = workout_type === 'template' ? 'workout_item_templates' : 'assigned_workout_items'

      const { data, error } = await supabaseAdmin
        .from(itemTable)
        .delete()
        .eq('id', item_id)
        .select('id')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao remover exercício: ${error?.message ?? 'desconhecido'}`)
      }

      return mcpSuccess({
        deleted_item: { id: data.id },
        message: 'Exercício removido da sessão.',
      })
    }
  )
}
