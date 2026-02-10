'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface CompleteResult {
    success: boolean
    error?: string
}

export async function completeProgram(programId: string, studentId: string): Promise<CompleteResult> {
    const supabase = await createClient()

    // Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Não autenticado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { success: false, error: 'Treinador não encontrado' }
    }

    // Verify program belongs to trainer and student
    const { data: program } = await supabase
        .from('assigned_programs')
        .select('id, status')
        .eq('id', programId)
        .eq('trainer_id', trainer.id)
        .eq('student_id', studentId)
        .single()

    if (!program) {
        return { success: false, error: 'Programa não encontrado' }
    }

    if (program.status === 'completed') {
        return { success: false, error: 'Programa já foi concluído' }
    }

    // Complete the program
    const { error } = await supabase
        .from('assigned_programs')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', programId)

    if (error) {
        console.error('Error completing program:', error)
        return { success: false, error: 'Erro ao concluir programa' }
    }

    revalidatePath(`/students/${studentId}`)
    return { success: true }
}
