'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['new', 'read', 'contacted', 'converted', 'archived'] as const
type LeadStatus = typeof VALID_STATUSES[number]

interface Result {
    success: boolean
    message?: string
}

/**
 * Atualiza o status de um lead. Apenas o trainer dono do lead pode alterar
 * (RLS bloqueia o resto, mas validamos auth aqui antes pra evitar query inútil).
 */
export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Result> {
    if (!VALID_STATUSES.includes(status)) {
        return { success: false, message: 'Status inválido.' }
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, message: 'Sessão expirada.' }
    }

    const { error } = await supabase
        .from('trainer_leads')
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq('id', leadId)

    if (error) {
        console.error('[updateLeadStatus] error:', error)
        return { success: false, message: 'Não foi possível atualizar.' }
    }

    revalidatePath('/leads')
    return { success: true }
}
