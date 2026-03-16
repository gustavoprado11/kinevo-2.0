import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { BuilderClient } from './builder-client'

interface Props {
    searchParams: Promise<{ edit?: string }>
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

    return (
        <BuilderClient
            trainer={trainer}
            existingTemplate={existingTemplate}
        />
    )
}
