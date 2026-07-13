import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import {
  DAY_INT_TO_STR,
  setSchemaZod,
  buildSetScheme,
  materializeScheme,
  validateRoundsForMethod,
} from './workouts-write'
import { activateAssignedProgram } from '@/lib/programs/activate-assigned-program'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'

export function registerProgramWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_create_program',
    "Create an EMPTY program shell, to be populated afterwards with kinevo_add_workout_session + kinevo_add_exercise_to_session. Omit student_id to create a REUSABLE TEMPLATE that appears in the trainer's Program Library (Biblioteca de Programas); pass student_id to create it already assigned to that student as a draft. TIP: to build a full library template (sessions + exercises) in a single call, prefer kinevo_create_program_template.",
    {
      name: z.string().min(2).describe("Program name (e.g., 'Hipertrofia - Fase 1')"),
      description: z.string().optional().describe('Program description and goals'),
      duration_weeks: z.number().min(1).max(52).optional().describe('Program duration in weeks'),
      student_id: z.string().uuid().optional().describe("If provided, creates the program as already assigned to this student (status: 'draft')"),
    },
    { title: 'Criar programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ name, description, duration_weeks, student_id }) => {
      const supabaseAdmin = createAdminClient()

      if (student_id) {
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

        const { data, error } = await supabaseAdmin
          .from('assigned_programs')
          .insert({
            trainer_id: trainerId,
            student_id,
            name,
            description: description ?? null,
            duration_weeks: duration_weeks ?? null,
            status: 'draft',
          })
          .select('id, name, status')
          .single()

        if (error || !data) {
          return mcpError(`Erro ao criar programa: ${error?.message ?? 'desconhecido'}`)
        }

        return mcpSuccess({
          program: { id: data.id, name: data.name, type: 'assigned', status: data.status },
          message: `Programa "${data.name}" criado como rascunho para o aluno.`,
        })
      }

      // Create as reusable template
      const { data, error } = await supabaseAdmin
        .from('program_templates')
        .insert({
          trainer_id: trainerId,
          name,
          description: description ?? null,
          duration_weeks: duration_weeks ?? null,
        })
        .select('id, name')
        .single()

      if (error || !data) {
        return mcpError(`Erro ao criar template: ${error?.message ?? 'desconhecido'}`)
      }

      return mcpSuccess({
        program: { id: data.id, name: data.name, type: 'template', status: null },
        message: `Template de programa "${data.name}" criado.`,
      })
    }
  )

  server.tool(
    'kinevo_create_program_template',
    "Create a COMPLETE reusable program template in the trainer's Program Library (Biblioteca de Programas) in ONE transactional call: the program plus all its workout sessions, exercises, supersets and per-set schemes. Use this — instead of orchestrating create_program + N add_session + M add_exercise — whenever you have the whole template designed up front. The template can later be assigned to any student with kinevo_assign_program (action 'assign_template'), which copies it and materializes the schedule. All exercise_id values must exist in the catalog (kinevo_list_exercises).",
    {
      name: z.string().min(2).describe("Template name (e.g., 'Hipertrofia Full Body 3x')"),
      description: z.string().optional().describe('Program description and goals'),
      duration_weeks: z.number().min(1).max(52).optional().describe('Program duration in weeks'),
      sessions: z.array(z.object({
        name: z.string().describe("Session name (e.g., 'Treino A - Peito e Tríceps')"),
        scheduled_days: z.array(z.number().int().min(0).max(6)).optional()
          .describe('Suggested weekdays for this session as integers (0=Sunday … 6=Saturday). Stored as the template frequency and copied as the schedule when assigned. E.g. [1,4] = Mon/Thu.'),
        items: z.array(z.object({
          exercise_id: z.string().uuid().optional().describe('Exercise ID from the catalog. Required unless this item is a superset.'),
          sets: z.number().min(1).max(20).optional().describe('Number of sets (simple mode). Ignored when set_scheme is provided.'),
          reps: z.string().optional().describe("Reps prescription (simple mode, e.g., '12', '8-12', 'AMRAP'). Ignored when set_scheme is provided."),
          rest_seconds: z.number().min(0).max(600).optional().describe('Rest between sets in seconds (simple mode). Defaults to 90.'),
          notes: z.string().optional().describe('Special instructions for this exercise'),
          exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().describe('Role of this exercise in the session. Defaults to main.'),
          method_key: z.enum(['standard', 'custom', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).optional().describe('Training method label. Use with set_scheme.'),
          set_scheme: z.array(setSchemaZod).min(1).optional().describe('Advanced per-set prescription (overrides sets/reps/rest). For drop-set/cluster pass ONE round here and set rounds>1.'),
          rounds: z.number().min(1).max(20).optional().describe('Rounds the set_scheme repeats (compound methods). Defaults to 1.'),
          superset: z.array(z.object({
            exercise_id: z.string().uuid().describe('Exercise ID from the catalog'),
            sets: z.number().min(1).max(20).describe('Number of rounds/sets for this exercise'),
            reps: z.string().describe("Reps prescription (e.g., '10', '8-12')"),
            rest_seconds: z.number().min(0).max(600).optional().describe('Rest after THIS exercise within the round. Default: 0 for intermediates, the item rest_seconds for the last one.'),
            exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional(),
            notes: z.string().optional(),
          })).min(2).optional().describe('When present, this item is a superset (≥2 exercises performed back-to-back). exercise_id and set_scheme are ignored for this item; rest_seconds is the rest after each round (carried by the LAST exercise — execution uses per-exercise rest).'),
        })).describe('Ordered list of exercises/supersets in this session.'),
      })).min(1).describe('Ordered list of workout sessions in the template.'),
    },
    { title: 'Criar template de programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ name, description, duration_weeks, sessions }) => {
      const supabaseAdmin = createAdminClient()

      // Gather every referenced exercise id and validate against the catalog up front.
      const exerciseIds = new Set<string>()
      for (const s of sessions) {
        for (const it of s.items) {
          if (it.superset) for (const c of it.superset) exerciseIds.add(c.exercise_id)
          else if (it.exercise_id) exerciseIds.add(it.exercise_id)
        }
      }
      if (exerciseIds.size > 0) {
        // Escopo por owner: só sistema (owner_id null) ou do próprio treinador
        // — exercício privado de outro treinador cai como "não encontrado".
        const { data: found } = await supabaseAdmin
          .from('exercises')
          .select('id')
          .in('id', Array.from(exerciseIds))
          .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
        const known = new Set((found ?? []).map(e => e.id))
        const missing = Array.from(exerciseIds).find(id => !known.has(id))
        if (missing) {
          return mcpError(`Exercício ${missing} não encontrado no catálogo.`)
        }
      }

      // Build the jsonb tree the RPC expects.
      const workouts: Array<Record<string, unknown>> = []
      for (let wi = 0; wi < sessions.length; wi++) {
        const s = sessions[wi]
        const sortedDays = s.scheduled_days
          ? Array.from(new Set(s.scheduled_days)).sort((a, b) => a - b)
          : undefined

        const items: Array<Record<string, unknown>> = []
        for (let ii = 0; ii < s.items.length; ii++) {
          const it = s.items[ii]

          if (it.superset) {
            // Superset container + children (children carry no set_scheme in
            // V1). R7: rest por FILHO — intermediários 0, o último carrega o
            // descanso da rodada; o container espelha o último filho.
            const childRest = (c: { rest_seconds?: number }, ci: number) =>
              c.rest_seconds ?? (ci === it.superset!.length - 1 ? (it.rest_seconds ?? 60) : 0)
            items.push({
              item_type: 'superset',
              order_index: ii,
              exercise_id: null,
              sets: null,
              reps: null,
              rest_seconds: childRest(it.superset[it.superset.length - 1], it.superset.length - 1),
              method_key: null,
              rounds: 1,
              children: it.superset.map((c, ci) => ({
                item_type: 'exercise',
                order_index: ci,
                exercise_id: c.exercise_id,
                sets: c.sets,
                reps: c.reps,
                rest_seconds: childRest(c, ci),
                notes: c.notes ?? null,
                exercise_function: c.exercise_function ?? 'main',
              })),
            })
            continue
          }

          if (!it.exercise_id) {
            return mcpError(`Item ${ii + 1} da sessão "${s.name}" precisa de exercise_id ou de um superset.`)
          }

          // Resolve prescription: advanced (set_scheme) or simple (sets/reps).
          let aggregates: { sets: number; reps: string; rest_seconds: number }
          let setRows: Array<Record<string, unknown>> = []
          let effectiveRounds = 1

          if (it.set_scheme && it.set_scheme.length > 0) {
            const roundsError = validateRoundsForMethod(it.rounds, it.method_key)
            if (roundsError) return mcpError(`Sessão "${s.name}": ${roundsError}`)
            const built = buildSetScheme(it.set_scheme)
            if ('error' in built) return mcpError(`Sessão "${s.name}": ${built.error}`)
            const m = materializeScheme(built.scheme, it.rounds)
            aggregates = m.aggregates
            setRows = m.rows
            effectiveRounds = m.rounds
          } else {
            if (it.sets === undefined || it.reps === undefined) {
              return mcpError(`Item ${ii + 1} da sessão "${s.name}": informe sets e reps (simples) ou set_scheme (avançado).`)
            }
            aggregates = { sets: it.sets, reps: it.reps, rest_seconds: it.rest_seconds ?? 90 }
          }

          items.push({
            item_type: 'exercise',
            order_index: ii,
            exercise_id: it.exercise_id,
            sets: aggregates.sets,
            reps: aggregates.reps,
            rest_seconds: aggregates.rest_seconds,
            notes: it.notes ?? null,
            exercise_function: it.exercise_function ?? 'main',
            method_key: it.method_key ?? null,
            rounds: effectiveRounds,
            set_rows: setRows,
          })
        }

        workouts.push({
          name: s.name,
          order_index: wi,
          frequency: sortedDays !== undefined ? sortedDays.map(d => DAY_INT_TO_STR[d]) : [],
          items,
        })
      }

      const payload = {
        program: {
          name,
          description: description ?? null,
          duration_weeks: duration_weeks ?? null,
        },
        workouts,
      }

      // Passa o trainer por parâmetro: o MCP grava com service-role (sem JWT),
      // então current_trainer_id() seria NULL no banco. Cast do nome até
      // `npm run gen:types` incluir o RPC (mesma convenção de save_assigned_program_tree).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabaseAdmin.rpc('create_program_template_tree' as any, {
        p_trainer_id: trainerId,
        p_payload: payload,
      })

      if (error || !data) {
        return mcpError(`Erro ao criar template: ${error?.message ?? 'desconhecido'}`)
      }

      const result = data as { program_template_id: string; workout_count: number; item_count: number }
      return mcpSuccess({
        program: { id: result.program_template_id, name, type: 'template' },
        workout_count: result.workout_count,
        item_count: result.item_count,
        message: `Template "${name}" criado na biblioteca com ${result.workout_count} sessões e ${result.item_count} itens. Use kinevo_assign_program (action 'assign_template') para atribuí-lo a um aluno.`,
      })
    }
  )

  server.tool(
    'kinevo_create_student_draft_program',
    "Create a COMPLETE workout program as a DRAFT assigned directly to a SPECIFIC student, in ONE transactional call: the program plus all its workout sessions, exercises, supersets and per-set schemes. The draft is INVISIBLE to the student and lands on the student's profile (\"Rascunho criado pelo assistente\") for the trainer to review and then ACTIVATE — or discard. Prefer this over kinevo_create_program_template (which creates a REUSABLE library template, not tied to a student) and over kinevo_create_program + N add_session (incremental, NOT transactional) whenever you've designed a program FOR THIS STUDENT. It does NOT activate the program — the trainer activates from the profile (or via kinevo_assign_program action 'activate_draft'). All exercise_id values must exist in the catalog (kinevo_list_exercises).",
    {
      student_id: z.string().uuid().describe('The student this draft program is for. Must belong to this trainer.'),
      name: z.string().min(2).describe("Program name (e.g., 'Hipertrofia - Fase 1')"),
      description: z.string().optional().describe('Program description and goals'),
      duration_weeks: z.number().min(1).max(52).optional().describe('Program duration in weeks'),
      sessions: z.array(z.object({
        name: z.string().describe("Session name (e.g., 'Treino A - Peito e Tríceps')"),
        scheduled_days: z.array(z.number().int().min(0).max(6)).optional()
          .describe('Weekdays this session is scheduled, as integers (0=Sunday … 6=Saturday). Drives the student calendar and reminders. E.g. [1,4] = Mon/Thu. Always set these.'),
        items: z.array(z.object({
          exercise_id: z.string().uuid().optional().describe('Exercise ID from the catalog. Required unless this item is a superset.'),
          sets: z.number().min(1).max(20).optional().describe('Number of sets (simple mode). Ignored when set_scheme is provided.'),
          reps: z.string().optional().describe("Reps prescription (simple mode, e.g., '12', '8-12', 'AMRAP'). Ignored when set_scheme is provided."),
          rest_seconds: z.number().min(0).max(600).optional().describe('Rest between sets in seconds (simple mode). Defaults to 90.'),
          notes: z.string().optional().describe('Special instructions for this exercise'),
          exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional().describe('Role of this exercise in the session. Defaults to main.'),
          method_key: z.enum(['standard', 'custom', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).optional().describe('Training method label. Use with set_scheme.'),
          set_scheme: z.array(setSchemaZod).min(1).optional().describe('Advanced per-set prescription (overrides sets/reps/rest). For drop-set/cluster pass ONE round here and set rounds>1.'),
          rounds: z.number().min(1).max(20).optional().describe('Rounds the set_scheme repeats (compound methods). Defaults to 1.'),
          superset: z.array(z.object({
            exercise_id: z.string().uuid().describe('Exercise ID from the catalog'),
            sets: z.number().min(1).max(20).describe('Number of rounds/sets for this exercise'),
            reps: z.string().describe("Reps prescription (e.g., '10', '8-12')"),
            rest_seconds: z.number().min(0).max(600).optional().describe('Rest after THIS exercise within the round. Default: 0 for intermediates, the item rest_seconds for the last one.'),
            exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional(),
            notes: z.string().optional(),
          })).min(2).optional().describe('When present, this item is a superset (≥2 exercises performed back-to-back). exercise_id and set_scheme are ignored for this item; rest_seconds is the rest after each round (carried by the LAST exercise — execution uses per-exercise rest).'),
        })).describe('Ordered list of exercises/supersets in this session.'),
      })).min(1).describe('Ordered list of workout sessions in the program.'),
    },
    { title: 'Criar rascunho de programa do aluno', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ student_id, name, description, duration_weeks, sessions }) => {
      const supabaseAdmin = createAdminClient()

      // Posse do aluno: o draft só pode ser criado para um aluno deste treinador.
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()
      if (!student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      // Reúne os exercícios referenciados; valida no catálogo E resolve o snapshot
      // denormalizado (nome, grupo muscular, equipamento) — mesma origem que o
      // builder usa ao gravar (muscleGroupOf). A RPC grava esse snapshot.
      const exerciseIds = new Set<string>()
      for (const s of sessions) {
        for (const it of s.items) {
          if (it.superset) for (const c of it.superset) exerciseIds.add(c.exercise_id)
          else if (it.exercise_id) exerciseIds.add(it.exercise_id)
        }
      }
      const snapById = new Map<string, { name: string; muscle_group: string | null; equipment: string | null }>()
      if (exerciseIds.size > 0) {
        const { data: found } = await supabaseAdmin
          .from('exercises')
          .select('id, name, equipment, exercise_muscle_groups(muscle_groups(name))')
          .in('id', Array.from(exerciseIds))
          .or(`owner_id.is.null,owner_id.eq.${trainerId}`)
        for (const e of found ?? []) {
          const emgs = e.exercise_muscle_groups as unknown as Array<{ muscle_groups: { name: string } | null }>
          const mg = emgs?.map(x => x.muscle_groups?.name).find((n): n is string => !!n) ?? null
          snapById.set(e.id, { name: e.name, muscle_group: mg, equipment: e.equipment ?? null })
        }
        const missing = Array.from(exerciseIds).find(id => !snapById.has(id))
        if (missing) {
          return mcpError(`Exercício ${missing} não encontrado no catálogo.`)
        }
      }
      const snap = (id: string) => {
        const s = snapById.get(id)
        return {
          exercise_name: s?.name ?? null,
          exercise_muscle_group: s?.muscle_group ?? null,
          exercise_equipment: s?.equipment ?? null,
        }
      }

      // Monta a árvore que a RPC espera. Diferença vs. template: scheduled_days é
      // int[] (não frequency text[]) e cada item carrega o snapshot do exercício.
      const workouts: Array<Record<string, unknown>> = []
      for (let wi = 0; wi < sessions.length; wi++) {
        const s = sessions[wi]
        const scheduledDays = s.scheduled_days
          ? Array.from(new Set(s.scheduled_days)).sort((a, b) => a - b)
          : []

        const items: Array<Record<string, unknown>> = []
        for (let ii = 0; ii < s.items.length; ii++) {
          const it = s.items[ii]

          if (it.superset) {
            // R7: rest por FILHO — intermediários 0, o último carrega o
            // descanso da rodada; o container espelha o último filho.
            const childRest = (c: { rest_seconds?: number }, ci: number) =>
              c.rest_seconds ?? (ci === it.superset!.length - 1 ? (it.rest_seconds ?? 60) : 0)
            items.push({
              item_type: 'superset',
              order_index: ii,
              exercise_id: null,
              sets: null,
              reps: null,
              rest_seconds: childRest(it.superset[it.superset.length - 1], it.superset.length - 1),
              method_key: null,
              rounds: 1,
              children: it.superset.map((c, ci) => ({
                item_type: 'exercise',
                order_index: ci,
                exercise_id: c.exercise_id,
                sets: c.sets,
                reps: c.reps,
                rest_seconds: childRest(c, ci),
                notes: c.notes ?? null,
                // A RPC (migr 234) persiste exercise_function — mas este caminho
                // não o enviava no payload e TODO item de draft caía como NULL
                // (o template path sempre enviou). Mesmo default do template.
                exercise_function: c.exercise_function ?? 'main',
                ...snap(c.exercise_id),
              })),
            })
            continue
          }

          if (!it.exercise_id) {
            return mcpError(`Item ${ii + 1} da sessão "${s.name}" precisa de exercise_id ou de um superset.`)
          }

          // Resolve prescrição: avançada (set_scheme) ou simples (sets/reps).
          let aggregates: { sets: number; reps: string; rest_seconds: number }
          let setRows: Array<Record<string, unknown>> = []
          let effectiveRounds = 1

          if (it.set_scheme && it.set_scheme.length > 0) {
            const roundsError = validateRoundsForMethod(it.rounds, it.method_key)
            if (roundsError) return mcpError(`Sessão "${s.name}": ${roundsError}`)
            const built = buildSetScheme(it.set_scheme)
            if ('error' in built) return mcpError(`Sessão "${s.name}": ${built.error}`)
            const m = materializeScheme(built.scheme, it.rounds)
            aggregates = m.aggregates
            setRows = m.rows
            effectiveRounds = m.rounds
          } else {
            if (it.sets === undefined || it.reps === undefined) {
              return mcpError(`Item ${ii + 1} da sessão "${s.name}": informe sets e reps (simples) ou set_scheme (avançado).`)
            }
            aggregates = { sets: it.sets, reps: it.reps, rest_seconds: it.rest_seconds ?? 90 }
          }

          items.push({
            item_type: 'exercise',
            order_index: ii,
            exercise_id: it.exercise_id,
            sets: aggregates.sets,
            reps: aggregates.reps,
            rest_seconds: aggregates.rest_seconds,
            notes: it.notes ?? null,
            exercise_function: it.exercise_function ?? 'main',
            method_key: it.method_key ?? null,
            rounds: effectiveRounds,
            set_rows: setRows,
            ...snap(it.exercise_id),
          })
        }

        workouts.push({
          name: s.name,
          order_index: wi,
          scheduled_days: scheduledDays,
          items,
        })
      }

      const payload = {
        program: {
          name,
          description: description ?? null,
          duration_weeks: duration_weeks ?? null,
        },
        workouts,
      }

      // Passa trainer + aluno por parâmetro: o MCP grava com service-role (sem JWT).
      // Cast do nome até `npm run gen:types` incluir o RPC (mesma convenção de
      // create_program_template_tree / save_assigned_program_tree).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabaseAdmin.rpc('create_assigned_program_tree' as any, {
        p_trainer_id: trainerId,
        p_student_id: student_id,
        p_payload: payload,
      })

      if (error || !data) {
        return mcpError(`Erro ao criar rascunho: ${error?.message ?? 'desconhecido'}`)
      }

      const result = data as { assigned_program_id: string; workout_count: number; item_count: number }
      return mcpSuccess({
        program: { id: result.assigned_program_id, name, type: 'assigned_draft', status: 'draft' },
        student_id, // a UI do chat usa p/ montar o link de revisão do rascunho
        workout_count: result.workout_count,
        item_count: result.item_count,
        message: `Rascunho "${name}" criado no perfil do aluno com ${result.workout_count} sessões e ${result.item_count} itens. Ele NÃO está ativo — o treinador revisa no perfil do aluno e ativa quando aprovar (ou use kinevo_assign_program com action 'activate_draft').`,
      })
    }
  )

  server.tool(
    'kinevo_assign_program',
    'Assign an existing program template to a student, creating a copy. Or activate a draft assigned program by setting its start date.',
    {
      program_id: z.string().uuid().describe('The program template ID (to copy) or assigned program ID (to activate)'),
      student_id: z.string().uuid().optional().describe('Required when assigning a template. The student to assign to.'),
      start_date: z.string().optional().describe('YYYY-MM-DD. Omitted/today/past = activates immediately (starts now). FUTURE date = schedules the program (status scheduled; auto-activated on that day).'),
      action: z.enum(['assign_template', 'activate_draft']).describe("'assign_template' copies a template to a student, 'activate_draft' activates an existing draft program"),
    },
    { title: 'Atribuir programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ program_id, student_id, start_date, action }) => {
      const supabaseAdmin = createAdminClient()
      const todayStr = new Date().toISOString().split('T')[0]
      const isScheduled = !!start_date && start_date > todayStr

      if (action === 'assign_template') {
        if (!student_id) {
          return mcpError('student_id é obrigatório para assign_template.')
        }

        // Validate ownership of template and student
        const [templateResult, studentResult] = await Promise.all([
          supabaseAdmin
            .from('program_templates')
            .select('id')
            .eq('id', program_id)
            .eq('trainer_id', trainerId)
            .single(),
          supabaseAdmin
            .from('students')
            .select('id')
            .eq('id', student_id)
            .eq('coach_id', trainerId)
            .single(),
        ])

        if (!templateResult.data) {
          return mcpError('Template não encontrado ou não pertence a este treinador.')
        }
        if (!studentResult.data) {
          return mcpError('Aluno não encontrado ou não pertence a este treinador.')
        }

        // R4: usa a RPC transacional COMPLETA (migration 184) — a mesma do
        // web. Copia séries por fase (set templates), method_key/rounds,
        // frequency→scheduled_days, seta expires_at e COMPLETA o programa
        // vigente. A RPC legada (203) não copiava nada disso e deixava o
        // vigente 'paused' para sempre. service_role passa direto no check
        // interno da 184; ownership de aluno/template revalidado lá dentro.
        const { data: assignedProgramId, error: rpcError } = await supabaseAdmin.rpc(
          'assign_program_from_template',
          {
            p_trainer_id: trainerId,
            p_student_id: student_id,
            p_template_id: program_id,
            p_is_scheduled: isScheduled,
            p_scheduled_start_date: isScheduled ? start_date : undefined,
            p_workout_schedule: null,
            p_prescription_generation_id: undefined,
          }
        )

        if (rpcError) {
          return mcpError(`Erro ao atribuir programa: ${rpcError.message}`)
        }

        const { data: program } = await supabaseAdmin
          .from('assigned_programs')
          .select('id, name, status, started_at, scheduled_start_date, expires_at')
          .eq('id', assignedProgramId as string)
          .single()

        if (!program) {
          return mcpError('Programa atribuído mas não encontrado ao buscar detalhes.')
        }

        const programName = program.name ?? 'Novo programa'

        // Notificação ao aluno fora da RPC (fire-and-forget) — paridade com a
        // server action do web. Agendado notifica na ativação (via cron).
        if (!isScheduled) {
          insertStudentNotification({
            studentId: student_id,
            trainerId,
            type: 'program_assigned',
            title: 'Novo programa de treino!',
            subtitle: `${programName} está disponível no seu app.`,
            payload: { program_id: program.id, program_name: programName },
          }).then((inboxItemId) => {
            sendStudentPush({
              studentId: student_id!,
              title: 'Novo programa de treino!',
              body: `${programName} está disponível no seu app.`,
              inboxItemId: inboxItemId ?? undefined,
              data: { type: 'program_assigned', program_id: program.id },
            })
          }).catch(() => {})
        }

        return mcpSuccess({
          assigned_program: program,
          message: isScheduled
            ? `Programa "${programName}" agendado para ${start_date} — será ativado automaticamente nesse dia. Prescrição completa (séries por fase, métodos) e agenda semanal copiadas do modelo.`
            : `Programa "${programName}" atribuído e ATIVO — aluno notificado. Prescrição completa e agenda semanal copiadas do modelo; programa vigente anterior (se havia) foi concluído.`,
        })
      }

      // activate_draft — R8: usa o núcleo compartilhado de ativação (o mesmo
      // do web e do cron): valida agenda dos treinos, COMPLETA o programa
      // vigente (sem estourar o índice de 1-ativo-por-aluno), seta expires_at
      // e notifica o aluno. O UPDATE cru anterior não fazia nada disso.
      if (isScheduled) {
        // Data futura → agenda em vez de ativar; o cron ativa no dia.
        const { data: scheduled, error: schedError } = await supabaseAdmin
          .from('assigned_programs')
          .update({ status: 'scheduled', scheduled_start_date: start_date, started_at: null })
          .eq('id', program_id)
          .eq('trainer_id', trainerId)
          .eq('status', 'draft')
          .select('id, name, status, scheduled_start_date')
          .single()
        if (schedError || !scheduled) {
          return mcpError('Programa rascunho não encontrado ou não pertence a este treinador.')
        }
        return mcpSuccess({
          assigned_program: scheduled,
          message: `Programa "${scheduled.name}" agendado para ${start_date} — será ativado automaticamente nesse dia.`,
        })
      }

      const result = await activateAssignedProgram({
        assignedProgramId: program_id,
        trainerId,
        source: 'manual',
      })

      if (!result.success) {
        if (result.reason === 'missing_scheduled_days') {
          return mcpError(`O programa tem treinos sem dias da semana agendados (${(result.workoutNames ?? []).join(', ')}). Defina scheduled_days nesses treinos via kinevo_update_workout_session antes de ativar.`)
        }
        if (result.reason === 'not_found') {
          return mcpError('Programa não encontrado ou não pertence a este treinador.')
        }
        return mcpError(`Erro ao ativar programa: ${result.error ?? result.reason ?? 'desconhecido'}`)
      }

      const { data } = await supabaseAdmin
        .from('assigned_programs')
        .select('id, name, status, started_at, expires_at')
        .eq('id', program_id)
        .single()

      return mcpSuccess({
        assigned_program: data,
        message: result.activated
          ? `Programa "${result.programName}" ativado — aluno notificado; programa vigente anterior (se havia) foi concluído.`
          : `Programa "${result.programName}" já estava ativo.`,
      })
    }
  )

  server.tool(
    'kinevo_expire_program',
    "Manually expire/deactivate an active program. The program's data is preserved but it will no longer appear as the student's current program.",
    {
      program_id: z.string().uuid().describe('The assigned program ID to expire'),
    },
    { title: 'Expirar programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ program_id }) => {
      const supabaseAdmin = createAdminClient()

      const { data, error } = await supabaseAdmin
        .from('assigned_programs')
        .update({
          status: 'expired',
          completed_at: new Date().toISOString(),
        })
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .in('status', ['active', 'scheduled', 'paused'])
        .select('id, name, status')
        .single()

      if (error || !data) {
        return mcpError('Programa ativo não encontrado ou não pertence a este treinador.')
      }

      return mcpSuccess({
        program: data,
        message: `Programa "${data.name}" expirado.`,
      })
    }
  )

  server.tool(
    'kinevo_delete_program',
    "Permanently DELETE (discard) a DRAFT assigned program of a student — e.g. an AI-authored draft the trainer decided not to use. Works ONLY on drafts (status='draft'); the program and its workouts are removed. This is for WORKOUT PROGRAMS, not billing: to cancel a contract/subscription use kinevo_cancel_contract instead. To END an ACTIVE program while preserving the student's training history, use kinevo_expire_program — NOT this tool (deleting an active program is not allowed here).",
    {
      program_id: z.string().uuid().describe('The DRAFT assigned program ID to discard.'),
    },
    { title: 'Excluir rascunho de programa', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ program_id }) => {
      const supabaseAdmin = createAdminClient()

      const { data: prog } = await supabaseAdmin
        .from('assigned_programs')
        .select('id, name, status')
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .maybeSingle()

      if (!prog) {
        return mcpError('Programa não encontrado ou não pertence a este treinador.')
      }
      if (prog.status !== 'draft') {
        return mcpError(
          'Só rascunhos (status draft) podem ser excluídos por aqui. Para encerrar um programa ativo preservando o histórico do aluno, use kinevo_expire_program.'
        )
      }

      const { error } = await supabaseAdmin
        .from('assigned_programs')
        .delete()
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .eq('status', 'draft')

      if (error) {
        return mcpError(`Erro ao excluir rascunho: ${error.message}`)
      }

      return mcpSuccess({
        program: { id: prog.id, name: prog.name },
        message: `Rascunho "${prog.name}" excluído.`,
      })
    }
  )

  server.tool(
    'kinevo_duplicate_program',
    "Duplicate an existing program in one call: copy an ASSIGNED program (any status — great for \"same program for another student\" or \"next cycle\") or a library TEMPLATE into a new STUDENT DRAFT (target='student_draft', requires student_id) or a new library TEMPLATE (target='template'). Copies sessions, schedules, exercises, supersets, per-set schemes, pre-configured substitutes and notes. The copy is created INERT (draft/template) — nothing changes for any student until the trainer activates it. Use kinevo_list_programs / kinevo_get_program to pick the source.",
    {
      source_program_id: z.string().uuid().describe('The program to copy.'),
      source_type: z.enum(['assigned', 'template']).default('assigned').describe("Whether source_program_id is an assigned program or a library template."),
      target: z.enum(['student_draft', 'template']).describe("What to create: a draft on a student's profile or a reusable library template."),
      student_id: z.string().uuid().optional().describe("Required when target='student_draft': the student receiving the draft copy."),
      new_name: z.string().min(2).optional().describe('Name for the copy. Defaults to "<source name> (cópia)".'),
    },
    { title: 'Duplicar programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ source_program_id, source_type, target, student_id, new_name }) => {
      const supabaseAdmin = createAdminClient()

      if (target === 'student_draft' && !student_id) {
        return mcpError("target='student_draft' exige student_id.")
      }

      // ── Lê a árvore CRUA da origem (com posse) ──
      interface RawSetRow {
        set_number: number; set_type: string | null; reps: string | null; rest_seconds: number | null
        weight_target_kg: number | null; weight_target_pct1rm: number | null
        rir: number | null; tempo: string | null; notes: string | null; round_number: number | null
      }
      interface RawTreeItem {
        id: string; parent_item_id: string | null; item_type: string; order_index: number
        exercise_id: string | null; substitute_exercise_ids: string[] | null
        sets: number | null; reps: string | null; rest_seconds: number | null
        notes: string | null; item_config: unknown; method_key: string | null; rounds: number | null
        exercise_function: string | null
        exercise_name?: string | null; exercise_muscle_group?: string | null; exercise_equipment?: string | null
        set_rows?: RawSetRow[]
      }
      interface RawTreeWorkout {
        name: string; order_index: number
        scheduled_days?: number[] | null; frequency?: string[] | null
        items: RawTreeItem[]
      }

      let sourceName = ''
      let sourceDescription: string | null = null
      let sourceDuration: number | null = null
      let workoutsRaw: RawTreeWorkout[] = []

      if (source_type === 'assigned') {
        const { data, error } = await supabaseAdmin
          .from('assigned_programs')
          .select(`
            id, name, description, duration_weeks,
            assigned_workouts(
              name, order_index, scheduled_days,
              assigned_workout_items(
                id, parent_item_id, item_type, order_index, exercise_id,
                substitute_exercise_ids, sets, reps, rest_seconds, notes,
                item_config, method_key, rounds, exercise_function,
                exercise_name, exercise_muscle_group, exercise_equipment,
                assigned_workout_item_sets(
                  set_number, set_type, reps, rest_seconds, weight_target_kg,
                  weight_target_pct1rm, rir, tempo, notes, round_number
                )
              )
            )
          `)
          .eq('id', source_program_id)
          .eq('trainer_id', trainerId)
          .single()
        if (error || !data) return mcpError('Programa não encontrado ou não pertence a este treinador.')
        sourceName = data.name
        sourceDescription = data.description
        sourceDuration = data.duration_weeks
        workoutsRaw = ((data.assigned_workouts as unknown as Array<Record<string, unknown>>) ?? []).map((w) => ({
          name: w.name as string,
          order_index: w.order_index as number,
          scheduled_days: (w.scheduled_days as number[] | null) ?? [],
          items: ((w.assigned_workout_items as Array<Record<string, unknown>>) ?? []).map((i) => ({
            ...(i as unknown as RawTreeItem),
            set_rows: (i.assigned_workout_item_sets as RawSetRow[] | undefined) ?? [],
          })),
        }))
      } else {
        const { data, error } = await supabaseAdmin
          .from('program_templates')
          .select(`
            id, name, description, duration_weeks,
            workout_templates(
              name, order_index, frequency,
              workout_item_templates(
                id, parent_item_id, item_type, order_index, exercise_id,
                substitute_exercise_ids, sets, reps, rest_seconds, notes,
                item_config, method_key, rounds, exercise_function,
                workout_item_set_templates(
                  set_number, set_type, reps, rest_seconds, weight_target_kg,
                  weight_target_pct1rm, rir, tempo, notes, round_number
                )
              )
            )
          `)
          .eq('id', source_program_id)
          .eq('trainer_id', trainerId)
          .single()
        if (error || !data) return mcpError('Template não encontrado ou não pertence a este treinador.')
        sourceName = data.name
        sourceDescription = data.description
        sourceDuration = data.duration_weeks
        workoutsRaw = ((data.workout_templates as unknown as Array<Record<string, unknown>>) ?? []).map((w) => ({
          name: w.name as string,
          order_index: w.order_index as number,
          frequency: (w.frequency as string[] | null) ?? [],
          items: ((w.workout_item_templates as Array<Record<string, unknown>>) ?? []).map((i) => ({
            ...(i as unknown as RawTreeItem),
            set_rows: (i.workout_item_set_templates as RawSetRow[] | undefined) ?? [],
          })),
        }))
      }

      workoutsRaw.sort((a, b) => a.order_index - b.order_index)

      // Snapshot denormalizado (nome/grupo/equipamento) para o alvo student_draft:
      // a origem assigned já carrega; a origem template resolve do catálogo.
      const needSnapshots = target === 'student_draft' && source_type === 'template'
      const snapById = new Map<string, { name: string; muscle_group: string | null; equipment: string | null }>()
      if (needSnapshots) {
        const ids = new Set<string>()
        for (const w of workoutsRaw) for (const i of w.items) if (i.exercise_id) ids.add(i.exercise_id)
        if (ids.size > 0) {
          const { data: found } = await supabaseAdmin
            .from('exercises')
            .select('id, name, equipment, exercise_muscle_groups(muscle_groups(name))')
            .in('id', Array.from(ids))
          for (const e of found ?? []) {
            const emgs = e.exercise_muscle_groups as unknown as Array<{ muscle_groups: { name: string } | null }>
            const mg = emgs?.map(x => x.muscle_groups?.name).find((n): n is string => !!n) ?? null
            snapById.set(e.id, { name: e.name, muscle_group: mg, equipment: e.equipment ?? null })
          }
        }
      }
      const snapOf = (i: RawTreeItem) => {
        if (source_type === 'assigned') {
          return {
            exercise_name: i.exercise_name ?? null,
            exercise_muscle_group: i.exercise_muscle_group ?? null,
            exercise_equipment: i.exercise_equipment ?? null,
          }
        }
        const s = i.exercise_id ? snapById.get(i.exercise_id) : undefined
        return {
          exercise_name: s?.name ?? null,
          exercise_muscle_group: s?.muscle_group ?? null,
          exercise_equipment: s?.equipment ?? null,
        }
      }

      // DAY_STR_TO_INT local (inverso do DAY_INT_TO_STR importado).
      const dayStrToInt: Record<string, number> = {}
      for (const [k, v] of Object.entries(DAY_INT_TO_STR)) dayStrToInt[v] = Number(k)

      const mapItem = (i: RawTreeItem, orderIndex: number, children: RawTreeItem[]): Record<string, unknown> => ({
        item_type: i.item_type,
        order_index: orderIndex,
        exercise_id: i.exercise_id,
        substitute_exercise_ids: i.substitute_exercise_ids ?? [],
        sets: i.sets,
        reps: i.reps,
        rest_seconds: i.rest_seconds,
        notes: i.notes,
        item_config: i.item_config ?? {},
        method_key: i.method_key,
        rounds: i.rounds ?? 1,
        exercise_function: i.exercise_function,
        set_rows: (i.set_rows ?? [])
          .slice()
          .sort((a, b) => (a.round_number ?? 1) - (b.round_number ?? 1) || a.set_number - b.set_number),
        ...(target === 'student_draft' ? snapOf(i) : {}),
        children: children
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((c, ci) => ({
            item_type: c.item_type,
            order_index: ci,
            exercise_id: c.exercise_id,
            substitute_exercise_ids: c.substitute_exercise_ids ?? [],
            sets: c.sets,
            reps: c.reps,
            rest_seconds: c.rest_seconds,
            notes: c.notes,
            item_config: c.item_config ?? {},
            exercise_function: c.exercise_function,
            ...(target === 'student_draft' ? snapOf(c) : {}),
          })),
      })

      const workouts = workoutsRaw.map((w, wi) => {
        const top = w.items.filter((i) => !i.parent_item_id).sort((a, b) => a.order_index - b.order_index)
        const days: number[] =
          source_type === 'assigned'
            ? (w.scheduled_days ?? [])
            : ((w.frequency ?? []).map((d) => dayStrToInt[d]).filter((n): n is number => n !== undefined))
        return {
          name: w.name,
          order_index: wi,
          ...(target === 'student_draft'
            ? { scheduled_days: days }
            : { frequency: days.map((d) => DAY_INT_TO_STR[d]).filter(Boolean) }),
          items: top.map((i, ii) => mapItem(i, ii, w.items.filter((c) => c.parent_item_id === i.id))),
        }
      })

      const name = new_name ?? `${sourceName} (cópia)`
      const rpcPayload = {
        program: { name, description: sourceDescription, duration_weeks: sourceDuration },
        workouts,
      }

      if (target === 'student_draft') {
        // Posse do aluno-alvo (o RPC re-checa, mas o erro daqui é mais claro).
        const { data: student } = await supabaseAdmin
          .from('students')
          .select('id, name')
          .eq('id', student_id as string)
          .eq('coach_id', trainerId)
          .single()
        if (!student) return mcpError('Aluno de destino não encontrado ou não pertence a este treinador.')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabaseAdmin.rpc('create_assigned_program_tree' as any, {
          p_trainer_id: trainerId,
          p_student_id: student_id,
          p_payload: rpcPayload,
        })
        if (error || !data) return mcpError(`Erro ao duplicar: ${error?.message ?? 'desconhecido'}`)
        const result = data as { assigned_program_id: string; workout_count: number; item_count: number }
        return mcpSuccess({
          program: { id: result.assigned_program_id, name, type: 'assigned_draft', status: 'draft' },
          student_id,
          source: { id: source_program_id, name: sourceName, type: source_type },
          workout_count: result.workout_count,
          item_count: result.item_count,
          message: `Cópia "${name}" criada como RASCUNHO no perfil de ${student.name} (${result.workout_count} sessões, ${result.item_count} itens). Não está ativa — o treinador revisa e ativa (ou kinevo_assign_program action 'activate_draft').`,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabaseAdmin.rpc('create_program_template_tree' as any, {
        p_trainer_id: trainerId,
        p_payload: rpcPayload,
      })
      if (error || !data) return mcpError(`Erro ao duplicar: ${error?.message ?? 'desconhecido'}`)
      const result = data as { program_template_id: string; workout_count: number; item_count: number }
      return mcpSuccess({
        program: { id: result.program_template_id, name, type: 'template' },
        source: { id: source_program_id, name: sourceName, type: source_type },
        workout_count: result.workout_count,
        item_count: result.item_count,
        message: `Cópia "${name}" criada na Biblioteca de Programas (${result.workout_count} sessões, ${result.item_count} itens).`,
      })
    }
  )
}
