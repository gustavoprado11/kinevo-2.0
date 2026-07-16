import crypto from 'crypto'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { assertCanCreateStudent, StudentCapError } from '@/lib/limits/student-cap'
import { archiveStudentCore } from '@/actions/financial/archive-student-core'
import { mcpSuccess, mcpError } from '../types'

export function registerStudentWriteTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_create_student',
    'Register a new student for this trainer. Creates the student profile with Supabase Auth account and optionally sets clinical/training preferences.',
    {
      name: z.string().min(2).describe("Student's full name"),
      email: z.string().email().describe("Student's email address"),
      phone: z.string().optional().describe("Student's phone number"),
      objective: z.string().optional().describe("Student's training objective (e.g., 'Hipertrofia', 'Emagrecimento', 'Qualidade de vida')"),
      modality: z.enum(['online', 'presential']).default('online').describe('Training modality'),
      training_level: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe("Student's training experience level"),
      medical_restrictions: z
        .array(z.object({ condition: z.string(), notes: z.string().optional() }))
        .optional()
        .describe('Medical conditions or restrictions (e.g., knee injury, herniated disc)'),
      is_private: z
        .boolean()
        .optional()
        .describe(
          "Studio coaches only: true = personal client OUTSIDE the studio (invisible to colleagues/manager, does not count toward the studio tier). Requires the coach's own PAID solo plan. Irrelevant for solo trainers.",
        ),
    },
    { title: 'Criar aluno', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ name, email, phone, objective, modality, training_level, medical_restrictions, is_private }) => {
      const supabaseAdmin = createAdminClient()

      // 0. Gate de limite de alunos por tier (Free = 1; pago = ilimitado).
      // Particular (estúdio): exige plano solo pago do coach.
      try {
        const tier = await getAiTierForTrainer(supabaseAdmin, trainerId)
        await assertCanCreateStudent(supabaseAdmin, trainerId, tier, { isPrivate: is_private })
      } catch (capError) {
        if (capError instanceof StudentCapError) {
          return mcpError(capError.message)
        }
        throw capError
      }

      // 1. Create auth user
      const password = crypto.randomBytes(8).toString('base64url')
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { name: name.trim(), phone: phone ?? null, role: 'student' },
      })

      if (authError) {
        return mcpError(`Erro ao criar conta do aluno: ${authError.message}`)
      }

      // 2. Insert student record
      const { data: student, error: dbError } = await supabaseAdmin
        .from('students')
        .insert({
          auth_user_id: authUser.user.id,
          coach_id: trainerId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ?? null,
          modality,
          objective: objective ?? null,
          status: 'active',
          is_private: is_private === true,
        })
        .select('id, name, email, status')
        .single()

      if (dbError) {
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        return mcpError(`Erro ao salvar aluno: ${dbError.message}`)
      }

      // 3. Create prescription profile if training_level or medical_restrictions provided
      if (training_level || medical_restrictions) {
        await supabaseAdmin
          .from('student_prescription_profiles')
          .insert({
            student_id: student.id,
            trainer_id: trainerId,
            training_level: training_level ?? 'beginner',
            medical_restrictions: medical_restrictions ?? [],
          })
          .then()
      }

      return mcpSuccess({
        student: { id: student.id, name: student.name, email: student.email, status: student.status },
        message: `Aluno ${student.name} cadastrado com sucesso.`,
      })
    }
  )

  server.tool(
    'kinevo_update_student',
    "Update an existing student's profile data such as name, phone, objective, modality, notes, or training level.",
    {
      student_id: z.string().uuid().describe("The student's UUID"),
      name: z.string().min(2).optional().describe('Updated name'),
      phone: z.string().optional().describe('Updated phone number'),
      objective: z.string().optional().describe('Updated training objective'),
      modality: z.enum(['online', 'presential']).optional().describe('Updated modality'),
      trainer_notes: z.string().optional().describe("Trainer's private notes about this student"),
      status: z.enum(['active', 'inactive']).optional().describe('Set student as active or inactive'),
    },
    { title: 'Atualizar aluno', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ student_id, name, phone, objective, modality, trainer_notes, status }) => {
      const supabaseAdmin = createAdminClient()

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (name) updates.name = name
      if (phone !== undefined) updates.phone = phone
      if (objective !== undefined) updates.objective = objective
      if (modality) updates.modality = modality
      if (trainer_notes !== undefined) updates.trainer_notes = trainer_notes
      if (status) updates.status = status

      const { data, error } = await supabaseAdmin
        .from('students')
        .update(updates)
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .select('id, name, status')
        .single()

      if (error || !data) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      return mcpSuccess({
        student: data,
        message: `Dados do aluno ${data.name} atualizados.`,
      })
    }
  )

  server.tool(
    'kinevo_archive_student',
    "Archive (offboard) a student who stopped training: cancels their active contracts/subscriptions (including Stripe), optionally ends their recurring appointment routines, ends the trainer-student link and notifies the student. The workout HISTORY is preserved, but the student leaves the roster and re-linking requires a new invite — treat as IRREVERSIBLE. This is NOT the same as kinevo_update_student status='inactive' (which just marks the student inactive, keeping contracts and the link). Without confirm=true it only returns a PREVIEW (contracts/routines that would be affected). If the student has active appointment routines and appointment_decision was not given, it returns needs_appointment_decision — ask the trainer whether to cancel or keep them, then call again.",
    {
      student_id: z.string().uuid().describe('The student to archive (from kinevo_list_students).'),
      appointment_decision: z.enum(['keep', 'cancel']).optional()
        .describe("What to do with the student's ACTIVE recurring appointments: 'cancel' ends the routines, 'keep' leaves them in the calendar."),
      confirm: z.boolean().default(false)
        .describe('Set true ONLY after the trainer explicitly confirmed the archive.'),
    },
    { title: 'Arquivar aluno', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ student_id, appointment_decision, confirm }) => {
      const supabaseAdmin = createAdminClient()

      // Posse + contexto do preview (contratos e rotinas ativos).
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name')
        .eq('id', student_id)
        .eq('coach_id', trainerId)
        .single()
      if (!student) {
        return mcpError('Aluno não encontrado ou não pertence a este treinador.')
      }

      const [{ count: contractsCount }, { count: routinesCount }] = await Promise.all([
        supabaseAdmin
          .from('student_contracts')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', student_id)
          .eq('trainer_id', trainerId)
          .in('status', ['active', 'pending', 'past_due']),
        supabaseAdmin
          .from('recurring_appointments')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', student_id)
          .eq('trainer_id', trainerId)
          .eq('status', 'active'),
      ])

      if (!confirm) {
        return mcpSuccess({
          preview: true,
          student: { id: student.id, name: student.name },
          active_contracts: contractsCount ?? 0,
          active_routines: routinesCount ?? 0,
          message: `PRÉ-VISUALIZAÇÃO — nada foi executado. Arquivar ${student.name} vai cancelar ${contractsCount ?? 0} contrato(s) ativo(s), ${appointment_decision === 'cancel' ? `encerrar ${routinesCount ?? 0} rotina(s) de agenda` : `manter ${routinesCount ?? 0} rotina(s) de agenda`}, encerrar o vínculo e notificar o aluno. O histórico de treinos é preservado. Confirme com o treinador e repita com confirm=true.`,
        })
      }

      const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('name')
        .eq('id', trainerId)
        .single()

      const result = await archiveStudentCore({
        trainerId,
        trainerName: trainer?.name ?? null,
        studentId: student_id,
        appointmentDecision: appointment_decision,
      })

      if (result.needsAppointmentDecision) {
        return mcpSuccess({
          needs_appointment_decision: true,
          active_routines: result.activeRoutinesCount ?? 0,
          message: `${student.name} tem ${result.activeRoutinesCount ?? 0} rotina(s) de agenda ativa(s). Pergunte ao treinador se quer cancelá-las ou mantê-las e chame de novo com appointment_decision='cancel' ou 'keep'.`,
        })
      }
      if (result.error) return mcpError(result.error)

      return mcpSuccess({
        archived: true,
        student: { id: student.id, name: student.name },
        canceled_contracts: result.canceledContractsCount ?? 0,
        message: `Aluno ${student.name} arquivado: ${result.canceledContractsCount ?? 0} contrato(s) cancelado(s), vínculo encerrado e aluno notificado. O histórico de treinos foi preservado.`,
      })
    }
  )
}
