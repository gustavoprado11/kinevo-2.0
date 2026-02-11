import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { EditAssignedProgramClient } from '@/components/programs/edit-assigned-program-client'
import type { Exercise } from '@/types/exercise'

interface PageProps {
    params: Promise<{
        id: string
        programId: string
    }>
}

export default async function EditProgramPage({ params }: PageProps) {
    const { id: studentId, programId } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Get the assigned program with its workouts and items
    const { data: program } = await supabase
        .from('assigned_programs')
        .select(`
            id,
            name,
            description,
            duration_weeks,
            started_at,
            scheduled_start_date,
            assigned_workouts (
                id,
                name,
                order_index,
                scheduled_days,
                assigned_workout_items (
                    id,
                    item_type,
                    order_index,
                    parent_item_id,
                    exercise_id,
                    substitute_exercise_ids,
                    sets,
                    reps,
                    rest_seconds,
                    notes
                )
            )
        `)
        .eq('id', programId)
        .eq('student_id', studentId)
        .single()

    if (!program) {
        notFound()
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
        <EditAssignedProgramClient
            trainer={trainer}
            program={program as any}
            exercises={mappedExercises}
            studentId={studentId}
        />
    )
}
