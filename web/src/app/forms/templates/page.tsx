import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { TemplatesClient } from './templates-client'

export default async function TemplatesPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    // Count responses per template
    const { data: submissions } = await supabaseAdmin
        .from('form_submissions')
        .select('form_template_id')
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])

    const responseCounts = new Map<string, number>()
    for (const sub of submissions || []) {
        responseCounts.set(sub.form_template_id, (responseCounts.get(sub.form_template_id) || 0) + 1)
    }

    const enriched = (templates || []).map(t => ({
        ...t,
        responseCount: responseCounts.get(t.id) || 0,
    }))

    return (
        <TemplatesClient
            trainer={trainer}
            templates={enriched}
        />
    )
}
