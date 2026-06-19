import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import {
  DAY_INT_TO_STR,
  setSchemaZod,
  buildSetScheme,
  materializeScheme,
} from './workouts-write'

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
            exercise_function: z.enum(['warmup', 'activation', 'main', 'accessory', 'conditioning']).optional(),
            notes: z.string().optional(),
          })).min(2).optional().describe('When present, this item is a superset (≥2 exercises performed back-to-back). exercise_id and set_scheme are ignored for this item; rest_seconds applies after each round.'),
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
            // Superset container + children (children carry no set_scheme in V1).
            items.push({
              item_type: 'superset',
              order_index: ii,
              exercise_id: null,
              sets: null,
              reps: null,
              rest_seconds: it.rest_seconds ?? 60,
              method_key: null,
              rounds: 1,
              children: it.superset.map((c, ci) => ({
                item_type: 'exercise',
                order_index: ci,
                exercise_id: c.exercise_id,
                sets: c.sets,
                reps: c.reps,
                rest_seconds: 0,
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
          method_key: z.enum(['standard', 'custom', 'pyramid_down', 'pyramid_up', 'drop_set', 'top_backoff', '5x5', 'cluster']).optional().describe('Training method label. Use with set_scheme.'),
          set_scheme: z.array(setSchemaZod).min(1).optional().describe('Advanced per-set prescription (overrides sets/reps/rest). For drop-set/cluster pass ONE round here and set rounds>1.'),
          rounds: z.number().min(1).max(20).optional().describe('Rounds the set_scheme repeats (compound methods). Defaults to 1.'),
          superset: z.array(z.object({
            exercise_id: z.string().uuid().describe('Exercise ID from the catalog'),
            sets: z.number().min(1).max(20).describe('Number of rounds/sets for this exercise'),
            reps: z.string().describe("Reps prescription (e.g., '10', '8-12')"),
            notes: z.string().optional(),
          })).min(2).optional().describe('When present, this item is a superset (≥2 exercises performed back-to-back). exercise_id and set_scheme are ignored for this item; rest_seconds applies after each round.'),
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
            items.push({
              item_type: 'superset',
              order_index: ii,
              exercise_id: null,
              sets: null,
              reps: null,
              rest_seconds: it.rest_seconds ?? 60,
              method_key: null,
              rounds: 1,
              children: it.superset.map((c, ci) => ({
                item_type: 'exercise',
                order_index: ci,
                exercise_id: c.exercise_id,
                sets: c.sets,
                reps: c.reps,
                rest_seconds: 0,
                notes: c.notes ?? null,
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
      start_date: z.string().optional().describe('Start date in YYYY-MM-DD format. Defaults to today.'),
      action: z.enum(['assign_template', 'activate_draft']).describe("'assign_template' copies a template to a student, 'activate_draft' activates an existing draft program"),
    },
    { title: 'Atribuir programa', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ program_id, student_id, start_date, action }) => {
      const supabaseAdmin = createAdminClient()

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

        // Call existing RPC
        const startDateValue = start_date
          ? new Date(start_date).toISOString()
          : new Date().toISOString()

        const { data: assignedProgramId, error: rpcError } = await supabaseAdmin.rpc(
          'assign_program_to_student',
          {
            // Overload com p_trainer_id (migration 203): o MCP escreve com
            // service-role, então current_trainer_id() é NULL na versão antiga.
            p_trainer_id: trainerId,
            p_template_id: program_id,
            p_student_id: student_id,
            p_start_date: startDateValue,
          } as never
        )

        if (rpcError) {
          return mcpError(`Erro ao atribuir programa: ${rpcError.message}`)
        }

        const { data: program } = await supabaseAdmin
          .from('assigned_programs')
          .select('id, name, status, started_at')
          .eq('id', assignedProgramId)
          .single()

        if (!program) {
          return mcpError('Programa atribuído mas não encontrado ao buscar detalhes.')
        }

        return mcpSuccess({
          assigned_program: program,
          message: `Programa "${program.name}" atribuído ao aluno com início em ${program.started_at?.slice(0, 10)}.`,
        })
      }

      // activate_draft
      const { data, error } = await supabaseAdmin
        .from('assigned_programs')
        .update({
          status: 'active',
          started_at: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
        })
        .eq('id', program_id)
        .eq('trainer_id', trainerId)
        .eq('status', 'draft')
        .select('id, name, status, started_at')
        .single()

      if (error || !data) {
        return mcpError('Programa rascunho não encontrado ou não pertence a este treinador.')
      }

      return mcpSuccess({
        assigned_program: data,
        message: `Programa "${data.name}" ativado com início em ${data.started_at?.slice(0, 10)}.`,
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
}
