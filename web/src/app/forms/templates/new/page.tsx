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
            .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at')
            .eq('id', params.edit)
            .eq('trainer_id', trainer.id)
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
