'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateCheckoutLinkCore } from './generate-checkout-core'
import { revalidatePath } from 'next/cache'

export async function generateCheckoutLink({ studentId, planId }: { studentId: string; planId: string }) {
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

    const result = await generateCheckoutLinkCore(supabaseAdmin, trainer.id, { studentId, planId })

    if (!result.success) {
        return { error: result.error }
    }

    revalidatePath('/financial/subscriptions')
    return { success: true, url: result.url }
}
