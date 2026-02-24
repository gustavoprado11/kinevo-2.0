'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function checkTrainerEmail(email: string) {
    try {
        const supabaseAdmin = createAdminClient()

        const { data, error } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('email', email)
            .single()

        if (error || !data) {
            return { exists: false }
        }

        return { exists: true }
    } catch (err) {
        console.error('Error checking trainer email:', err)
        return { exists: false }
    }
}
