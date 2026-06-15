'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { cancelContractCore } from './contracts-core'

export async function cancelContract({ contractId, cancelAtPeriodEnd }: { contractId: string; cancelAtPeriodEnd?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { error: 'Treinador não encontrado' }
    }

    const result = await cancelContractCore(supabaseAdmin, trainer.id, { contractId, cancelAtPeriodEnd })
    if (result.error) {
        return { error: result.error }
    }

    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')
    return result.scheduledCancellation ? { success: true, scheduledCancellation: true } : { success: true }
}
