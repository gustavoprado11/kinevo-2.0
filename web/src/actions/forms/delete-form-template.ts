'use server'

import { revalidatePath } from 'next/cache'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function deleteFormTemplate({ templateId }: { templateId: string }) {
    const { trainer } = await getTrainerWithSubscription()

    // Validate ownership
    const { data: template } = await supabaseAdmin
        .from('form_templates')
        .select('id')
        .eq('id', templateId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!template) return { success: false, error: 'Template não encontrado' }

    const { error } = await supabaseAdmin
        .from('form_templates')
        .delete()
        .eq('id', templateId)
        .eq('trainer_id', trainer.id)

    if (error) {
        console.error('[deleteFormTemplate] error:', error)
        return { success: false, error: 'Erro ao excluir template' }
    }

    revalidatePath('/forms')
    revalidatePath('/forms/templates')
    return { success: true }
}
