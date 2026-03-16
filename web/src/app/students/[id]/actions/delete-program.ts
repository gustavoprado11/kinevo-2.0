'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteProgram(programId: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) throw new Error('Unauthorized')

        // Get program and verify trainer ownership
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id, status, trainer_id')
            .eq('id', programId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!program) throw new Error('Program not found')

        // Delete the program
        const { error } = await supabase
            .from('assigned_programs')
            .delete()
            .eq('id', programId)
            .eq('trainer_id', trainer.id)

        if (error) throw error

        revalidatePath(`/students/${program.student_id}`)
        return { success: true }
    } catch (error) {
        console.error('Error deleting program:', error)
        return { success: false, error: 'Failed to delete program' }
    }
}
