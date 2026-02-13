'use server'

import { revalidatePath } from 'next/cache'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface UpdateFormTemplateInput {
    templateId: string
    title: string
    description?: string
    category: 'anamnese' | 'checkin' | 'survey'
    schemaJson: string
}

export async function updateFormTemplate(input: UpdateFormTemplateInput) {
    const { trainer } = await getTrainerWithSubscription()

    const title = input.title?.trim()
    if (!title) return { success: false, error: 'Título é obrigatório' }

    if (!['anamnese', 'checkin', 'survey'].includes(input.category)) {
        return { success: false, error: 'Categoria inválida' }
    }

    let parsedSchema: any
    try {
        parsedSchema = JSON.parse(input.schemaJson)
    } catch {
        return { success: false, error: 'JSON do schema inválido' }
    }

    if (!parsedSchema || typeof parsedSchema !== 'object' || Array.isArray(parsedSchema)) {
        return { success: false, error: 'Schema deve ser um objeto JSON' }
    }

    if (!Array.isArray(parsedSchema.questions) || parsedSchema.questions.length === 0) {
        return { success: false, error: 'Schema precisa conter ao menos uma pergunta' }
    }

    // Validate ownership and get current version
    const { data: existing } = await supabaseAdmin
        .from('form_templates')
        .select('id, version')
        .eq('id', input.templateId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!existing) return { success: false, error: 'Template não encontrado' }

    const { error } = await supabaseAdmin
        .from('form_templates')
        .update({
            title,
            description: input.description?.trim() || null,
            category: input.category,
            schema_json: parsedSchema,
            version: (existing.version || 1) + 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', input.templateId)
        .eq('trainer_id', trainer.id)

    if (error) {
        console.error('[updateFormTemplate] error:', error)
        return { success: false, error: 'Erro ao atualizar template' }
    }

    revalidatePath('/forms')
    revalidatePath('/forms/templates')
    return { success: true }
}
