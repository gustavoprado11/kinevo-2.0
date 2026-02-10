import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramsClient } from './programs-client'

export default async function ProgramsPage() {
    const { trainer } = await getTrainerWithSubscription()

    const supabase = await createClient()

    // Get program templates with workout count (only reusable templates)
    const { data: programs } = await supabase
        .from('program_templates')
        .select(`
      id,
      name,
      description,
      duration_weeks,
      created_at,
      workout_templates(id)
    `)
        .eq('is_template', true)
        .order('created_at', { ascending: false })

    // Transform to include workout count
    const programsWithCount = programs?.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        duration_weeks: p.duration_weeks,
        created_at: p.created_at,
        workout_count: Array.isArray(p.workout_templates) ? p.workout_templates.length : 0,
    })) || []

    return <ProgramsClient trainer={trainer} programs={programsWithCount} />
}
