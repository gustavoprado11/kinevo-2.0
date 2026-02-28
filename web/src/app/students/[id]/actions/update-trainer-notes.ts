'use server'

import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'

export async function updateTrainerNotes(studentId: string, notes: string) {
    try {
        const { trainer } = await getTrainerWithSubscription()
        const supabase = await createClient()

        // Verify the student belongs to this trainer
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('trainer_id', trainer.id)
            .single()

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
