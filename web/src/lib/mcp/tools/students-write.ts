import crypto from 'crypto'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
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
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ name, email, phone, objective, modality, training_level, medical_restrictions }) => {
      const supabaseAdmin = createAdminClient()

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
        } as Record<string, unknown>)
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
          } as Record<string, unknown>)
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
    { readOnlyHint: false, destructiveHint: false },
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
}
