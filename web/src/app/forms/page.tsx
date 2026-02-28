import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FormsDashboardClient } from './forms-dashboard-client'

export default async function FormsPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Templates
    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, category, version, schema_json, created_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    // All submissions (submitted + reviewed)
    const { data: rawSubmissions } = await supabaseAdmin
        .from('form_submissions')
        .select('id, status, submitted_at, feedback_sent_at, created_at, student_id, form_template_id')
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])
        .order('submitted_at', { ascending: false })

    // Students
    const { data: students } = await supabase
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainer.id)
        .order('name')

    // Map for enrichment
    const studentsMap = new Map((students || []).map(s => [s.id, s]))
    const templatesMap = new Map((templates || []).map(t => [t.id, t]))

    // Enriched submissions
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

    // Count responses per template
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
    }))

    // For AssignFormModal
    const formTemplates = (templates || []).map(t => ({
        id: t.id,
        title: t.title,
        version: t.version || 1,
    }))

    const studentsList = (students || []).map(s => ({
        id: s.id,
        name: s.name,
        avatar_url: s.avatar_url,
    }))

    return (
        <FormsDashboardClient
            trainer={trainer}
            submissions={submissions}
            templates={enrichedTemplates}
            formTemplates={formTemplates}
            students={studentsList}
        />
    )
}
