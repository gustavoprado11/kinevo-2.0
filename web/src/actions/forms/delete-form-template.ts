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
        // FK RESTRICT: form_submissions referencia este template. Um template já
        // enviado a alunos (tem submissões/respostas) não pode ser excluído.
        if (error.code === '23503') {
            return {
                success: false,
                error: 'Este template já foi enviado a alunos e tem respostas associadas, por isso não pode ser excluído.',
            }
        }
        return { success: false, error: 'Erro ao excluir template' }
    }

    revalidatePath('/forms')
    revalidatePath('/forms/templates')
    return { success: true }
}
