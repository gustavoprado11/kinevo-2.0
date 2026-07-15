'use server'

import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'

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

        if (await isStudentManagementLockedForTrainer(trainer.id)) {
            throw new Error(STUDENT_MANAGEMENT_LOCKED_ERROR)
        }

        // Só para o revalidatePath — a autorização (dono OU membro do estúdio do
        // aluno) e a existência do programa são resolvidas dentro de
        // activateAssignedProgram, agora org-aware.
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id')
            .eq('id', assignedProgramId)
            .single()
        const studentId = program?.student_id

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
