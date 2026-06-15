'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { markAsPaidCore } from './contracts-core'

export async function markAsPaid({ contractId }: { contractId: string }) {
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

    const result = await markAsPaidCore(supabaseAdmin, trainer.id, { contractId })
    if (result.error) {
        return { error: result.error }
    }

    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')
    revalidatePath('/dashboard')
    return { success: true }
}
