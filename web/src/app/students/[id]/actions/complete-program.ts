'use server'

import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'

import { createClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/reports/program-report-service'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'

export async function completeProgram(programId: string, studentId: string) {
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

        // Complete the program with ownership filter
        const { data, error } = await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', programId)
            .eq('student_id', studentId)
            .select('id')

        if (error) {
            console.error('Error completing program:', error)
            return { success: false, error: 'Erro ao concluir o programa' }
        }

        if (!data || data.length === 0) {
            return { success: false, error: 'Programa não encontrado' }
        }

        // Auto-generate program report (async, non-blocking)
        // Failure here should NOT prevent the program from being completed
        let reportId: string | null = null
        try {
            reportId = await generateReport(supabase, programId)
        } catch (reportError) {
            console.error('[complete-program] Report generation failed (non-blocking):', reportError)
        }

        return { success: true, reportId }
    } catch (error) {
        console.error('Unexpected error completing program:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao concluir o programa' }
    }
}
