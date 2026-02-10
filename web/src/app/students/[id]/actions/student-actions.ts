'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteStudent(studentId: string) {
    const supabase = await createClient()

    try {
        // Since we have foreign key constraints (likely), deleting from 'students' 
        // should ideally trigger cascades or we might need to delete related data.
        // For now, focus on the 'students' table as requested.
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId)

        if (error) {
            console.error('Error deleting student:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/students')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error deleting student:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao excluir o aluno' }
    }
}
