import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { getAssessmentSessionList } from '@/actions/assessments/get-session-list'
import { AvaliacoesClient } from './avaliacoes-client'

export default async function AvaliacoesPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Templates de assessment (trainer-owned + system)
    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, category, version, schema_json, created_at, trainer_id')
        .or(`trainer_id.eq.${trainer.id},trainer_id.is.null`)
        .eq('category', 'assessment')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    // Students
    const { data: students } = await supabase
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainer.id)
        .order('name')

    // Sessions per template count (for templates listing in M8/B2; aqui não usado
    // diretamente, mas mantemos a forma futura).
    const { data: sessionsForCount } = await supabase
        .from('assessment_sessions')
        .select('template_id, status')
        .eq('trainer_id', trainer.id)

    const sessionCounts = new Map<string, number>()
    for (const s of sessionsForCount || []) {
        if (s.status === 'cancelled' || !s.template_id) continue
        sessionCounts.set(s.template_id, (sessionCounts.get(s.template_id) || 0) + 1)
    }

    const enrichedTemplates = (templates || []).map(t => ({
        id: t.id,
        title: t.title,
        sectionCount: (t.schema_json as any)?.sections?.length || 0,
        sessionCount: sessionCounts.get(t.id) || 0,
        trainer_id: t.trainer_id,
    }))

    // Sessions list (M4)
    const assessmentRes = await getAssessmentSessionList({ filter: 'all', limit: 100 })
    const assessmentSessions = assessmentRes.success ? (assessmentRes.data ?? []) : []

    const assessmentTemplates = (templates || []).map(t => ({ id: t.id, title: t.title }))

    return (
        <AvaliacoesClient
            trainer={trainer}
            students={(students || []).map(s => ({ id: s.id, name: s.name, avatar_url: s.avatar_url }))}
            templates={enrichedTemplates}
            assessmentTemplates={assessmentTemplates}
            assessmentSessions={assessmentSessions}
            onboardingState={trainer.onboarding_state ?? null}
        />
    )
}
