import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { InboxClient } from './inbox-client'

export default async function InboxPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Fetch submissions (submitted + reviewed)
    const { data: submissions } = await supabaseAdmin
        .from('form_submissions')
        .select('id, form_template_id, student_id, trainer_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
        .eq('trainer_id', trainer.id)
        .in('status', ['submitted', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(100)

    // Fetch students for names/avatars
    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, avatar_url, status')
        .eq('coach_id', trainer.id)

    // Fetch templates for titles
    const { data: templates } = await supabase
        .from('form_templates')
        .select('id, title, version, category')
        .eq('trainer_id', trainer.id)

    return (
        <InboxClient
            trainer={trainer}
            submissions={submissions || []}
            students={students || []}
            templates={templates || []}
        />
    )
}
