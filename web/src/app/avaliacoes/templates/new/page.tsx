import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout'
import { AssessmentBuilderPageClient } from './assessment-builder-page-client'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'

interface Props {
    searchParams: Promise<{ edit?: string }>
}

export default async function NewAssessmentTemplatePage({ searchParams }: Props) {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()
    const params = await searchParams

    let existingTemplate = null
    if (params.edit) {
        const { data } = await supabase
            .from('form_templates')
            .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at, trainer_id')
            .eq('id', params.edit)
            .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
            .single()
        existingTemplate = data
    }

    const seed: AssessmentTemplateSchema =
        (existingTemplate?.schema_json as AssessmentTemplateSchema | null) ?? {
            schema_version: '1.0',
            sections: [],
        }

    // M16 — Step 1 "Partir de Kinevo" lista os seed templates (system).
    // RLS já restringe ao trainer; trainer_id IS NULL é público read-only.
    const { data: kinevoTemplatesRaw } = await supabase
        .from('form_templates')
        .select('id, title, description, schema_json')
        .eq('category', 'assessment')
        .is('trainer_id', null)
        .order('title')

    const kinevoTemplates = (kinevoTemplatesRaw ?? []).map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        schema: (t.schema_json as AssessmentTemplateSchema | null) ?? {
            schema_version: '1.0',
            sections: [],
        },
    }))

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={trainer.onboarding_state ?? null}
        >
            <AssessmentBuilderPageClient
                templateId={existingTemplate?.id ?? null}
                initialTitle={existingTemplate?.title ?? ''}
                initialDescription={existingTemplate?.description ?? null}
                initialSchema={seed}
                kinevoTemplates={kinevoTemplates}
            />
        </AppLayout>
    )
}
