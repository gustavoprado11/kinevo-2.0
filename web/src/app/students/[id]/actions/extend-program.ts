'use server'

import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'

export async function extendProgram(programId: string, studentId: string, additionalWeeks: number) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // Verify caller is a trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Treinador não encontrado' }
        if (await isStudentManagementLockedForTrainer(trainer.id)) {
            return { success: false, error: STUDENT_MANAGEMENT_LOCKED_ERROR }
        }

        // Escopo: responsável (solo) OU membro do estúdio do aluno.
        const scope = await getStudentScope(trainer.id)
        if (!(await assertStudentAccess(supabase, scope, studentId))) {
            return { success: false, error: 'Aluno não encontrado' }
        }

        // Get current program data
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('id, status, duration_weeks, expires_at')
            .eq('id', programId)
            .eq('student_id', studentId)
            .single()

        if (!program) return { success: false, error: 'Programa não encontrado' }

        const currentDuration = (program as any).duration_weeks ?? 0
        const currentExpiresAt = (program as any).expires_at

        // Calculate new values
        const newDuration = currentDuration + additionalWeeks
        const additionalMs = additionalWeeks * 7 * 24 * 60 * 60 * 1000
        const newExpiresAt = currentExpiresAt
            ? new Date(new Date(currentExpiresAt).getTime() + additionalMs).toISOString()
            : null

        // Extend the program: update duration, expires_at, and reactivate if expired
        const { error } = await supabase
            .from('assigned_programs')
            .update({
                duration_weeks: newDuration,
                expires_at: newExpiresAt,
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', programId)
            .eq('student_id', studentId)

        if (error) {
            console.error('Error extending program:', error)
            return { success: false, error: 'Erro ao prorrogar o programa' }
        }

        revalidatePath(`/students/${studentId}`)
        return { success: true, newDuration }
    } catch (error) {
        console.error('Unexpected error extending program:', error)
        return { success: false, error: 'Ocorreu um erro inesperado' }
    }
}
