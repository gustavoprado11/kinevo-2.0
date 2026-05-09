import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BuilderClient } from './builder-client'

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

    // M8/B2 — assessments têm sua rota dedicada. Redireciona casos legados:
    // 1) ?category=assessment (já coberto por next.config redirects, mas
    //    como guarda extra preservamos o redirect aqui caso o redirect
    //    global mude no futuro)
    // 2) ?edit=<id> de um template cuja categoria é assessment
    const isAssessment =
        params.category === 'assessment'
        || (existingTemplate?.category === 'assessment')

    if (isAssessment) {
        const target = params.edit
            ? `/avaliacoes/templates/new?edit=${params.edit}`
            : '/avaliacoes/templates/new'
        redirect(target)
    }

    return (
        <BuilderClient
            trainer={trainer}
            existingTemplate={existingTemplate}
        />
    )
}
