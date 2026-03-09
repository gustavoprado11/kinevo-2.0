'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertStudentNotification } from '@/lib/student-notifications'
import { sendStudentPush } from '@/lib/push-notifications'

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

        // 2. Get program details to know the student
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id, status, name')
            .eq('id', assignedProgramId)
            .single()

        if (!program) throw new Error('Program not found')

        // Prevent re-activating an already active program
        if (program.status === 'active') {
            return { success: true }
        }

        const studentId = program.student_id

        // 3. Archive/Complete current active program
        await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('status', 'active')

        // 4. Activate the new program
        const { error: updateError } = await supabase
            .from('assigned_programs')
            .update({
                status: 'active',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', assignedProgramId)

        if (updateError) throw updateError

        // 5. Notify student (fire-and-forget)
        const programName = program.name ?? 'Novo programa'
        insertStudentNotification({
            studentId,
            trainerId: trainer.id,
            type: 'program_assigned',
            title: 'Novo programa de treino!',
            subtitle: `${programName} está disponível no seu app.`,
            payload: { program_id: assignedProgramId, program_name: programName },
        })
        sendStudentPush({
            studentId,
            title: 'Novo programa de treino!',
            body: `${programName} está disponível no seu app.`,
            data: { program_id: assignedProgramId },
        })

        revalidatePath(`/students/${studentId}`)
        return { success: true }

    } catch (error) {
        console.error('Error activating program:', error)
        return { success: false, error: 'Failed to activate program' }
    }
}
