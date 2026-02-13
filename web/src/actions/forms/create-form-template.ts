'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface CreateFormTemplateInput {
    title: string
    description?: string
    category: 'anamnese' | 'checkin' | 'survey'
    schemaJson: string
    createdSource?: 'manual' | 'ai_assisted'
}

export async function createFormTemplate(input: CreateFormTemplateInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

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
        return { success: false, error: 'Schema precisa conter ao menos uma pergunta em questions[]' }
    }

    const { data, error } = await supabase
        .from('form_templates')
        .insert({
            trainer_id: trainer.id,
            title,
            description: input.description?.trim() || null,
            category: input.category,
            schema_json: parsedSchema,
            created_source: input.createdSource || 'manual',
        })
        .select('id')
        .single()

    if (error) {
        console.error('[createFormTemplate] error:', error)
        return { success: false, error: 'Erro ao criar template' }
    }

    revalidatePath('/forms')
    return { success: true, templateId: data.id }
}

