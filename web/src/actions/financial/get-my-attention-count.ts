'use server'

import { createClient } from '@/lib/supabase/server'
import { getFinancialAttentionCount } from './get-attention-count'

export async function getMyAttentionCount(): Promise<number> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return 0

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) return 0

        return await getFinancialAttentionCount(trainer.id)
    } catch {
        return 0
    }
}
