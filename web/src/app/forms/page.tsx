import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FormsDashboardClient } from './forms-dashboard-client'

export default async function FormsPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Templates count
    const { count: templatesCount } = await supabase
        .from('form_templates')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer.id)

    // Total submissions (submitted + reviewed)
    const { count: submissionsCount } = await supabaseAdmin
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])

    // Pending feedback (submitted but no feedback yet)
    const { count: pendingFeedbackCount } = await supabaseAdmin
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainer.id)
        .eq('status', 'submitted')

    // Recent submissions
    const { data: rawSubmissions } = await supabaseAdmin
        .from('form_submissions')
        .select('id, status, submitted_at, feedback_sent_at, created_at, student_id, form_template_id')
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(10)

    // Fetch students and templates for display names
    const { data: students } = await supabase
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainer.id)

    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title')
        .eq('trainer_id', trainer.id)

    const studentsMap = new Map((students || []).map(s => [s.id, s]))
    const templatesMap = new Map((templates || []).map(t => [t.id, t]))

    const recentSubmissions = (rawSubmissions || []).map(sub => {
        const student = studentsMap.get(sub.student_id)
        const template = templatesMap.get(sub.form_template_id)
        return {
            id: sub.id,
            status: sub.status,
            submitted_at: sub.submitted_at,
            created_at: sub.created_at,
            feedback_sent_at: sub.feedback_sent_at,
            student_name: student?.name || null,
            student_avatar: student?.avatar_url || null,
            template_title: template?.title || null,
        }
    })

    return (
        <FormsDashboardClient
            trainer={trainer}
            templatesCount={templatesCount ?? 0}
            submissionsCount={submissionsCount ?? 0}
            pendingFeedbackCount={pendingFeedbackCount ?? 0}
            recentSubmissions={recentSubmissions}
        />
    )
}
