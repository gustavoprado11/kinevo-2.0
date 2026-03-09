'use server'

import { createClient } from '@/lib/supabase/server'

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

        // Verify trainer owns this student
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()
        if (!student) return { success: false, error: 'Aluno não encontrado' }

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

        return { success: true }
    } catch (error) {
        console.error('Unexpected error completing program:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao concluir o programa' }
    }
}
