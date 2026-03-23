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

        // 2. Get program details — with trainer_id ownership filter
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id, status, name, trainer_id, duration_weeks')
            .eq('id', assignedProgramId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!program) throw new Error('Program not found')

        // Prevent re-activating an already active program
        if (program.status === 'active') {
            return { success: true }
        }

        const studentId = program.student_id

        // 3. Verify trainer owns this student
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()
        if (!student) throw new Error('Student not found')

        // 4. Archive/Complete current active or expired program (scoped to trainer)
        await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('trainer_id', trainer.id)
            .in('status', ['active', 'expired'])

        // 5. Activate the new program
        const now = new Date()
        const durationWeeks = (program as any).duration_weeks as number | null
        const expiresAt = durationWeeks
            ? new Date(now.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString()
            : null

        const { error: updateError } = await supabase
            .from('assigned_programs')
            .update({
                status: 'active',
                started_at: now.toISOString(),
                updated_at: now.toISOString(),
                expires_at: expiresAt,
            })
            .eq('id', assignedProgramId)
            .eq('trainer_id', trainer.id)

        if (updateError) throw updateError

        // 6. Notify student (fire-and-forget)
        const programName = program.name ?? 'Novo programa'
        insertStudentNotification({
            studentId,
            trainerId: trainer.id,
            type: 'program_assigned',
            title: 'Novo programa de treino!',
            subtitle: `${programName} está disponível no seu app.`,
            payload: { program_id: assignedProgramId, program_name: programName },
        }).then((inboxItemId) => {
            sendStudentPush({
                studentId,
                title: 'Novo programa de treino!',
                body: `${programName} está disponível no seu app.`,
                inboxItemId: inboxItemId ?? undefined,
                data: { type: 'program_assigned', program_id: assignedProgramId },
            })
        })

        revalidatePath(`/students/${studentId}`)
        return { success: true }

    } catch (error) {
        console.error('Error activating program:', error)
        return { success: false, error: 'Failed to activate program' }
    }
}
