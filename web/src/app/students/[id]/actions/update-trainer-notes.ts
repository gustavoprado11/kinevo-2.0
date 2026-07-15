'use server'

import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'

export async function updateTrainerNotes(studentId: string, notes: string) {
    try {
        const { trainer } = await getTrainerWithSubscription()
        if (await isStudentManagementLockedForTrainer(trainer.id)) {
            return { success: false, error: STUDENT_MANAGEMENT_LOCKED_ERROR }
        }
        const supabase = await createClient()

        // Escopo: dono (solo) OU membro do estúdio do aluno.
        const scope = await getStudentScope(trainer.id)
        const student = await assertStudentAccess(supabase, scope, studentId)
        if (!student) {
            return { success: false, error: 'Student not found' }
        }

        const { error } = await supabase
            .from('students')
            .update({ trainer_notes: notes })
            .eq('id', studentId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: 'Failed to update notes' }
    }
}
