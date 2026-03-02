'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ContractEvent } from '@/types/financial'

export async function getStudentEvents(studentId: string): Promise<ContractEvent[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return []
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return []
    }

    // Validate student belongs to this trainer
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return []
    }

    const { data, error } = await supabaseAdmin
        .from('contract_events')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('[get-student-events] Error:', error.message)
        return []
    }

    return (data ?? []) as ContractEvent[]
}
