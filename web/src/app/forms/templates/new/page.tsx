import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { BuilderClient } from './builder-client'
import { AssessmentBuilderPageClient } from './assessment-builder-page-client'
import { AppLayout } from '@/components/layout'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'

interface Props {
    searchParams: Promise<{ edit?: string; category?: string }>
}

export default async function BuilderPage({ searchParams }: Props) {
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

    // Assessment branch — uses the dedicated AssessmentBuilderCanvas (M4).
    // Triggered by either ?category=assessment OR by editing an existing
    // template whose category is 'assessment'.
    const isAssessment =
        params.category === 'assessment'
        || (existingTemplate?.category === 'assessment')

    if (isAssessment) {
        const seed: AssessmentTemplateSchema =
            (existingTemplate?.schema_json as AssessmentTemplateSchema | null) ?? {
                schema_version: '1.0',
                sections: [],
            }
        return (
            <AppLayout
                trainerName={trainer.name}
                trainerEmail={trainer.email}
                trainerAvatarUrl={trainer.avatar_url}
                trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            >
                <AssessmentBuilderPageClient
                    templateId={existingTemplate?.id ?? null}
                    initialTitle={existingTemplate?.title ?? 'Avaliação Presencial'}
                    initialDescription={existingTemplate?.description ?? null}
                    initialSchema={seed}
                />
            </AppLayout>
        )
    }

    return (
        <BuilderClient
            trainer={trainer}
            existingTemplate={existingTemplate}
        />
    )
}
