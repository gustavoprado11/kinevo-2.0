'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

        // Verify trainer owns this student
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()
        if (!student) return { success: false, error: 'Aluno não encontrado' }

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
