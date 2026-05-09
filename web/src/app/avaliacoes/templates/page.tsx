import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { TemplatesClient } from '@/app/forms/templates/templates-client'

// M8/B2 — /avaliacoes/templates: lista só templates com category='assessment'.
// Reusa o componente de listing de /forms/templates via prop `mode`.
export default async function AssessmentTemplatesPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at, trainer_id')
        .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
        .eq('category', 'assessment')
        .order('created_at', { ascending: false })

    // Count assessment sessions per template (status != 'cancelled')
    const { data: sessions } = await supabase
        .from('assessment_sessions')
        .select('template_id, status')
        .eq('trainer_id', trainer.id)

    const sessionCounts = new Map<string, number>()
    for (const s of sessions || []) {
        if (s.status === 'cancelled' || !s.template_id) continue
        sessionCounts.set(s.template_id, (sessionCounts.get(s.template_id) || 0) + 1)
    }

    const enriched = (templates || []).map(t => ({
        ...t,
        responseCount: 0, // assessments não têm form_submissions
        sessionCount: sessionCounts.get(t.id) || 0,
    }))

    return (
        <TemplatesClient
            trainer={trainer}
            templates={enriched}
            mode="assessments"
        />
    )
}
