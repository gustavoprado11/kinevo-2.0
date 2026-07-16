import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FormsDashboardClient } from './forms-dashboard-client'

export default async function FormsPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // M8/D1 — /forms é forms-only. Templates de category='assessment' vivem em /avaliacoes.
    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, category, version, schema_json, created_at, trainer_id')
        // Estúdios (265): o RLS já limita a own + sistema + COLEGAS do estúdio
        // — o or-filter antigo excluía os templates da equipe.
        .or('system_key.is.null,system_key.neq.prescription_questionnaire')
        .neq('category', 'assessment')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    // Estúdios (decisão 16/jul): o inbox mostra as respostas dos alunos do
    // ESTÚDIO (de qualquer coach da equipe), além das próprias. Client de
    // sessão + RLS (form_submissions own + org_select da 252) fazem o corte.
    const { data: rawSubmissions } = await supabase
        .from('form_submissions')
        .select('id, status, submitted_at, feedback_sent_at, created_at, student_id, form_template_id')
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at', { ascending: false })

    const { data: rawPendingSent } = await supabaseAdmin
        .from('form_submissions')
        .select('id, status, created_at, student_id, form_template_id')
        .eq('trainer_id', trainer.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })

    // Alunos p/ o picker + resolução de nomes do inbox: no estúdio inclui os
    // compartilhados (enviar form a aluno de colega é permitido desde a 255).
    // RLS (students own + org_select) faz o corte; o filtro explícito antigo
    // escondia os nomes dos alunos de colegas no inbox.
    const { data: students } = await supabase
        .from('students')
        .select('id, name, avatar_url, coach_id, is_trainer_profile')
        .order('name')

    const studentsMap = new Map((students || []).map(s => [s.id, s]))
    const templatesMap = new Map((templates || []).map(t => [t.id, t]))

    const submissions = (rawSubmissions || []).map(sub => {
        const student = studentsMap.get(sub.student_id)
        const template = templatesMap.get(sub.form_template_id)
        return {
            id: sub.id,
            status: sub.status as 'submitted' | 'reviewed',
            submitted_at: sub.submitted_at,
            created_at: sub.created_at,
            feedback_sent_at: sub.feedback_sent_at,
            student_name: student?.name || null,
            student_avatar: student?.avatar_url || null,
            template_title: template?.title || null,
        }
    })

    const pendingSent = (rawPendingSent || []).map(sub => {
        const student = studentsMap.get(sub.student_id)
        const template = templatesMap.get(sub.form_template_id)
        return {
            id: sub.id,
            created_at: sub.created_at,
            student_name: student?.name || null,
            student_avatar: student?.avatar_url || null,
            template_title: template?.title || null,
        }
    })

    const responseCounts = new Map<string, number>()
    for (const sub of rawSubmissions || []) {
        responseCounts.set(sub.form_template_id, (responseCounts.get(sub.form_template_id) || 0) + 1)
    }

    const enrichedTemplates = (templates || []).map(t => ({
        id: t.id,
        title: t.title,
        category: t.category as string,
        responseCount: responseCounts.get(t.id) || 0,
        questionCount: (t.schema_json as any)?.questions?.length || 0,
        trainer_id: t.trainer_id,
    }))

    const formTemplates = (templates || []).map(t => ({
        id: t.id,
        title: t.title,
        version: t.version || 1,
    }))

    // Picker: sem os perfis "Eu" de COLEGAS (o próprio continua, como antes).
    const studentsList = (students || [])
        .filter(s => !(s.is_trainer_profile && s.coach_id !== trainer.id))
        .map(s => ({
            id: s.id,
            name: s.name,
            avatar_url: s.avatar_url,
        }))

    return (
        <FormsDashboardClient
            trainer={trainer}
            submissions={submissions}
            pendingSent={pendingSent}
            templates={enrichedTemplates}
            formTemplates={formTemplates}
            students={studentsList}
            onboardingState={trainer.onboarding_state ?? null}
        />
    )
}
