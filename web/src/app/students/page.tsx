import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { StudentsClient } from './students-client'

export default async function StudentsPage() {
    const { trainer } = await getTrainerWithSubscription()

    const supabase = await createClient()
    const { data: students } = await supabase
        .from('students')
        .select('id, name, email, phone, status, modality, avatar_url, created_at, is_trainer_profile')
        .order('created_at', { ascending: false })

    return <StudentsClient trainer={trainer} initialStudents={students || []} />
}
