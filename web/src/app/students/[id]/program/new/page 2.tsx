import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgramBuilderClient, type Exercise } from '@/components/programs'

export default async function CreateProgramForStudentPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id: studentId } = await params
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
        .select('id, name')
        .eq('id', studentId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!student) redirect('/students')

    // Fetch exercises
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

    const mappedExercises: Exercise[] = (exercises || []).map(e => ({
        id: e.id,
        name: e.name,
        // Loop over junction to flatten
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
        />
    )
}
