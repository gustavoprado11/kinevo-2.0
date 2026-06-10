'use server'

import { revalidatePath } from 'next/cache'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'
import type { Json } from '@kinevo/shared/types/database'

interface UpdateAssessmentTemplateInput {
    templateId: string
    title: string
    description?: string | null
    schema: AssessmentTemplateSchema
}

interface CreateAssessmentTemplateInput {
    title: string
    description?: string | null
    schema: AssessmentTemplateSchema
}

/**
 * Light validation of an assessment template schema. The full schema is rich
 * (sections + tests of multiple shapes) — we only enforce the invariants the
 * builder cannot recover from at runtime: schema_version, at least one
 * section, unique metric_keys across all tests.
 */
function validateSchema(schema: AssessmentTemplateSchema): { ok: true } | { ok: false; error: string } {
    if (!schema || typeof schema !== 'object') {
        return { ok: false, error: 'Schema inválido' }
    }
    if (!schema.schema_version || typeof schema.schema_version !== 'string') {
        return { ok: false, error: 'schema_version é obrigatório' }
    }
    if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
        return { ok: false, error: 'Template precisa de ao menos uma seção' }
    }

    const seen = new Set<string>()
    for (const section of schema.sections) {
        if (!Array.isArray(section.tests)) {
            return { ok: false, error: `Seção "${section.title ?? '?'}" sem testes` }
        }
        for (const test of section.tests) {
            const key = (test as { metric_key?: string }).metric_key
            if (!key) continue
            if (seen.has(key)) {
                return { ok: false, error: `metric_key duplicado: "${key}"` }
            }
            seen.add(key)
        }
    }

    return { ok: true }
}

export async function updateAssessmentTemplate(input: UpdateAssessmentTemplateInput) {
    const { trainer } = await getTrainerWithSubscription()

    const title = input.title?.trim()
    if (!title) return { success: false, error: 'Título é obrigatório' }

    const validation = validateSchema(input.schema)
    if (!validation.ok) return { success: false, error: validation.error }

    const [ownedRes, systemRes] = await Promise.all([
        supabaseAdmin
            .from('form_templates')
            .select('id, version, trainer_id, category')
            .eq('id', input.templateId)
            .eq('trainer_id', trainer.id)
            .maybeSingle(),
        supabaseAdmin
            .from('form_templates')
            .select('id, version, trainer_id, category')
            .eq('id', input.templateId)
            .is('trainer_id', null)
            .maybeSingle(),
    ])
    const existing = ownedRes.data ?? systemRes.data

    if (!existing) return { success: false, error: 'Template não encontrado' }
    if (existing.category !== 'assessment') {
        return { success: false, error: 'Template não é uma avaliação presencial' }
    }

    // Cloning system templates as trainer-owned mirrors form templates' UX.
    if (existing.trainer_id === null) {
        const { data: cloned, error: cloneErr } = await supabaseAdmin
            .from('form_templates')
            .insert({
                trainer_id: trainer.id,
                title,
                description: input.description?.trim() || null,
                category: 'assessment',
                // jsonb na fronteira: AssessmentTemplateSchema é estruturalmente compatível com Json
                schema_json: input.schema as unknown as Json,
                created_source: 'manual',
            })
            .select('id')
            .single()

        if (cloneErr) {
            console.error('[updateAssessmentTemplate] clone error:', cloneErr)
            return { success: false, error: 'Erro ao salvar cópia do template' }
        }

        revalidatePath('/forms')
        revalidatePath('/forms/templates')
        return { success: true, clonedId: cloned.id }
    }

    const { error } = await supabaseAdmin
        .from('form_templates')
        .update({
            title,
            description: input.description?.trim() || null,
            // jsonb na fronteira: AssessmentTemplateSchema é estruturalmente compatível com Json
            schema_json: input.schema as unknown as Json,
            version: (existing.version || 1) + 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', input.templateId)
        .eq('trainer_id', trainer.id)

    if (error) {
        console.error('[updateAssessmentTemplate] error:', error)
        return { success: false, error: 'Erro ao atualizar template' }
    }

    revalidatePath('/forms')
    revalidatePath('/forms/templates')
    return { success: true }
}

export async function createAssessmentTemplate(input: CreateAssessmentTemplateInput) {
    const { trainer } = await getTrainerWithSubscription()

    const title = input.title?.trim()
    if (!title) return { success: false, error: 'Título é obrigatório' }

    const validation = validateSchema(input.schema)
    if (!validation.ok) return { success: false, error: validation.error }

    const { data, error } = await supabaseAdmin
        .from('form_templates')
        .insert({
            trainer_id: trainer.id,
            title,
            description: input.description?.trim() || null,
            category: 'assessment',
            // jsonb na fronteira: AssessmentTemplateSchema é estruturalmente compatível com Json
            schema_json: input.schema as unknown as Json,
            created_source: 'manual',
        })
        .select('id')
        .single()

    if (error) {
        console.error('[createAssessmentTemplate] error:', error)
        return { success: false, error: 'Erro ao criar template' }
    }

    revalidatePath('/forms')
    revalidatePath('/forms/templates')
    return { success: true, templateId: data.id }
}
