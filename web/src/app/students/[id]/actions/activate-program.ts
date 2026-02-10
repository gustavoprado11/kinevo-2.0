'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function activateProgram(assignedProgramId: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Get program details to know the student
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('student_id, status')
            .eq('id', assignedProgramId)
            .single()

        if (!program) throw new Error('Program not found')

        // Prevent re-activating an already active program
        if (program.status === 'active') {
            return { success: true }
        }

        const studentId = program.student_id

        // 2. Archive/Complete current active program
        // We do this BEFORE activating the new one to avoid unique constraint violation
        // (idx_assigned_programs_active_unique WHERE status = 'active')
        await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('status', 'active')

        // 3. Activate the new program
        const { error: updateError } = await supabase
            .from('assigned_programs')
            .update({
                status: 'active',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', assignedProgramId)

        if (updateError) throw updateError

        revalidatePath(`/students/${studentId}`)
        return { success: true }

    } catch (error) {
        console.error('Error activating program:', error)
        return { success: false, error: 'Failed to activate program' }
    }
}
