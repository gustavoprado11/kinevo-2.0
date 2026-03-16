'use server'

import { createClient } from '@/lib/supabase/server'

export interface FormTemplateOption {
    id: string
    title: string
    category: string
    questionCount: number
}

export async function getFormTemplatesForTriggers(): Promise<{
    success: boolean
    templates?: FormTemplateOption[]
    error?: string
}> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Trainer não encontrado' }

    // Fetch active checkin/survey templates (anamnese excluded — not relevant for pre/post workout)
    const { data: templates, error } = await supabase
        .from('form_templates')
        .select('id, title, category, schema_json')
        .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
        .in('category', ['checkin', 'survey'])
        .eq('is_active', true)
        .order('title')

    if (error) return { success: false, error: error.message }

    const mapped: FormTemplateOption[] = (templates || []).map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        questionCount: Array.isArray((t.schema_json as any)?.questions)
            ? (t.schema_json as any).questions.length
            : 0,
    }))

    return { success: true, templates: mapped }
}
