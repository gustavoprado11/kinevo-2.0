'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { activateAssignedProgram } from '@/lib/programs/activate-assigned-program'

export async function activateProgram(assignedProgramId: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Get trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) throw new Error('Trainer not found')

        // 2. Get program details — with trainer_id ownership filter
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id')
            .eq('id', assignedProgramId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!program) throw new Error('Program not found')

        const studentId = program.student_id

        // 3. Verify trainer owns this student
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()
        if (!student) throw new Error('Student not found')

        // 4. Activate using shared logic so manual and automatic flows stay in sync.
        const result = await activateAssignedProgram({
            assignedProgramId,
            trainerId: trainer.id,
            source: 'manual',
        })

        if (!result.success) {
            if (result.reason === 'missing_scheduled_days') {
                return { success: false, error: 'O programa possui treinos sem dia agendado.' }
            }
            throw new Error(result.error || 'Failed to activate program')
        }

        revalidatePath(`/students/${studentId}`)
        return { success: true }

    } catch (error) {
        console.error('Error activating program:', error)
        return { success: false, error: 'Failed to activate program' }
    }
}
