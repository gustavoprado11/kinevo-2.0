import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramBuilderClient } from '@/components/programs/program-builder-client'
import type { Exercise } from '@/types/exercise'

interface PageProps {
    params: Promise<{
        id: string
    }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function NewStudentProgramPage({ params, searchParams }: PageProps) {
    const { id: studentId } = await params
    const resolvedSearchParams = await searchParams
    const isScheduled = resolvedSearchParams.scheduled === 'true'

    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Get student data for context
    const { data: student } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', studentId)
        .single()

    if (!student) {
        redirect('/students')
    }

    // Get exercises for the library
    const { data: exercises } = await supabase
        .from('exercises')
        .select(`
            id, 
            name, 
            equipment, 
            owner_id, 
            original_system_id, 
            video_url,
            exercise_muscle_groups (
                muscle_groups (
                    id,
                    name,
                    owner_id,
                    created_at
                )
            )
        `)
        .order('name')

    // Map to Exercise type
    const mappedExercises: Exercise[] = (exercises || []).map(e => ({
        id: e.id,
        name: e.name,
        muscle_groups: e.exercise_muscle_groups?.map((emg: any) => emg.muscle_groups) || [],
        equipment: e.equipment,
        owner_id: e.owner_id,
        original_system_id: e.original_system_id,
        video_url: e.video_url || null,
        thumbnail_url: null,
        instructions: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }))

    return (
        <ProgramBuilderClient
            trainer={trainer}
            program={null}
            exercises={mappedExercises}
            studentContext={{
                id: student.id,
                name: student.name
            }}
            initialAssignmentType={isScheduled ? 'scheduled' : 'immediate'}
        />
    )
}
