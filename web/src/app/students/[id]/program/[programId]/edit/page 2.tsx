import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditAssignedProgramClient, type Exercise } from '@/components/programs'

export default async function EditAssignedProgramPage({
    params
}: {
    params: Promise<{ id: string; programId: string }>
}) {
    const { id: studentId, programId } = await params
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Trainer check
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) redirect('/dashboard')

    // Verify student belongs to trainer
    const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!student) redirect('/students')

    // Fetch Assigned Program with Workouts and Items
    const { data: program } = await supabase
        .from('assigned_programs')
        .select(`
            id,
            name,
            description,
            duration_weeks,
            assigned_workouts (
                id,
                name,
                order_index,
                assigned_workout_items (
                    id,
                    item_type,
                    order_index,
                    parent_item_id,
                    exercise_id,
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

    if (!program) redirect(`/students/${studentId}`)

    // Fetch Exercises for Picker
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

    // Map Exercises
    const mappedExercises: Exercise[] = (exercises || []).map(e => ({
        id: e.id,
        name: e.name,
        muscle_groups: e.exercise_muscle_groups?.map((emg: any) => emg.muscle_groups) || [],
        equipment: e.equipment,
        owner_id: e.owner_id,
        original_system_id: e.original_system_id,
        video_url: e.video_url || null,
        // Default values for other properties
        thumbnail_url: null,
        instructions: null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }))

    return (
        <EditAssignedProgramClient
            trainer={trainer}
            program={program}
            exercises={mappedExercises}
            studentId={studentId}
        />
    )
}
