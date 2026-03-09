'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteStudent(studentId: string) {
    const supabase = await createClient()

    try {
        // 1. Verify caller identity
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // 2. Get trainer profile
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Treinador não encontrado' }

        // 3. Verify ownership before delete
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()
        if (!student) return { success: false, error: 'Aluno não encontrado' }

        // 4. Delete (RLS also enforces ownership as defense-in-depth)
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId)
            .eq('coach_id', trainer.id)

        if (error) {
            console.error('Error deleting student:', error)
            return { success: false, error: 'Erro ao excluir aluno' }
        }

        revalidatePath('/students')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error deleting student:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao excluir o aluno' }
    }
}
