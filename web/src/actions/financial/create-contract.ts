'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { createContractCore, type CreateContractInput } from './contracts-core'

export async function createContract(input: CreateContractInput) {
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

    const result = await createContractCore(supabaseAdmin, trainer.id, input)
    if (result.error) {
        return { error: result.error }
    }

    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')
    return { success: true }
}
