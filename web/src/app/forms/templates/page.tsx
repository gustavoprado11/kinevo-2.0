import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { TemplatesClient } from './templates-client'

export default async function TemplatesPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    return (
        <TemplatesClient
            trainer={trainer}
            templates={templates || []}
        />
    )
}
