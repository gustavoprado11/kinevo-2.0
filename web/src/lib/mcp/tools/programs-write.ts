import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'

export function registerProgramWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_create_program',
    'Create a new training program template. This creates an empty program structure that can then have workout sessions and exercises added to it. Optionally assign it directly to a student.',
    {
      name: z.string().min(2).describe("Program name (e.g., 'Hipertrofia - Fase 1')"),
      description: z.string().optional().describe('Program description and goals'),
      duration_weeks: z.number().min(1).max(52).optional().describe('Program duration in weeks'),
      student_id: z.string().uuid().optional().describe("If provided, creates the program as already assigned to this student (status: 'draft')"),
    },
    { readOnlyHint: false, destructiveHint: false },
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
    'kinevo_assign_program',
    'Assign an existing program template to a student, creating a copy. Or activate a draft assigned program by setting its start date.',
    {
      program_id: z.string().uuid().describe('The program template ID (to copy) or assigned program ID (to activate)'),
      student_id: z.string().uuid().optional().describe('Required when assigning a template. The student to assign to.'),
      start_date: z.string().optional().describe('Start date in YYYY-MM-DD format. Defaults to today.'),
      action: z.enum(['assign_template', 'activate_draft']).describe("'assign_template' copies a template to a student, 'activate_draft' activates an existing draft program"),
    },
    { readOnlyHint: false, destructiveHint: false },
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
            p_template_id: program_id,
            p_student_id: student_id,
            p_start_date: startDateValue,
          }
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
    { readOnlyHint: false, destructiveHint: false },
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
