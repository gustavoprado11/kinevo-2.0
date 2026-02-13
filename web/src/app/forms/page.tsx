import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { FormsClient } from './forms-client'

export default async function FormsPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, description, category, version, is_active, created_source, schema_json, created_at, updated_at')
        .eq('trainer_id', trainer.id)
        .order('created_at', { ascending: false })

    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, status')
        .eq('coach_id', trainer.id)
        .order('name', { ascending: true })

    const { data: submissions } = await supabase
        .from('form_submissions')
        .select('id, form_template_id, student_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(100)

    return (
        <FormsClient
            trainer={trainer}
            templates={templates || []}
            students={students || []}
            submissions={submissions || []}
        />
    )
}
