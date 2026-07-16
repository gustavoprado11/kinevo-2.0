'use server'

import { isStudentManagementLockedForTrainer, STUDENT_MANAGEMENT_LOCKED_ERROR } from '@/lib/limits/student-readonly'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'
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

        if (await isStudentManagementLockedForTrainer(trainer.id)) {
            throw new Error(STUDENT_MANAGEMENT_LOCKED_ERROR)
        }

        // Estúdios: o programa pode ter sido criado por OUTRO coach do estúdio
        // — a autorização é pelo ALUNO (responsável OU membro da org), não pelo
        // trainer_id do programa. Espelha extend/complete-program.
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id, status, trainer_id')
            .eq('id', programId)
            .single()

        if (!program) throw new Error('Program not found')

        const scope = await getStudentScope(trainer.id)
        if (!(await assertStudentAccess(supabase, scope, program.student_id))) {
            throw new Error('Program not found')
        }

        // DELETE via admin: não há policy org de DELETE em assigned_programs
        // (por design da 252) — a autorização é o guard acima.
        const { error } = await supabaseAdmin
            .from('assigned_programs')
            .delete()
            .eq('id', programId)

        if (error) throw error

        revalidatePath(`/students/${program.student_id}`)
        return { success: true }
    } catch (error) {
        console.error('Error deleting program:', error)
        return { success: false, error: 'Failed to delete program' }
    }
}
