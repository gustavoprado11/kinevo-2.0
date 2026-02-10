'use server'

import { createClient } from '@/lib/supabase/server'

export async function completeProgram(programId: string, studentId: string) {
    const supabase = await createClient()

    try {
        const { error } = await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', programId)
            .eq('student_id', studentId)

        if (error) {
            console.error('Error completing program:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error('Unexpected error completing program:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao concluir o programa' }
    }
}
