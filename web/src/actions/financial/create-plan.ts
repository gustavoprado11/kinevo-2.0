'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { createPlanCore, type CreatePlanInput } from './plans-core'

export async function createPlan(input: CreatePlanInput) {
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

    const result = await createPlanCore(supabaseAdmin, trainer.id, input)
    if (result.error) {
        return { error: result.error }
    }

    revalidatePath('/financial')
    revalidatePath('/financial/plans')
    return { success: true }
}
