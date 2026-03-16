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

    // Get the assigned program with its workouts, items, and source template
    const { data: program } = await supabase
        .from('assigned_programs')
        .select(`
            id,
            name,
            description,
            duration_weeks,
            started_at,
            scheduled_start_date,
            source_template_id,
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
                    notes,
                    item_config
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

    // Fetch form triggers from source template (read-only)
    let formTriggers: { preWorkout: any; postWorkout: any } | undefined
    const sourceTemplateId = (program as any).source_template_id

    if (sourceTemplateId) {
        const { data: triggers } = await supabase
            .from('program_form_triggers')
            .select('trigger_type, form_template_id, form_templates(title, category)')
            .eq('program_template_id', sourceTemplateId)
            .eq('is_active', true)

        if (triggers && triggers.length > 0) {
            const pre = triggers.find((t: any) => t.trigger_type === 'pre_workout')
            const post = triggers.find((t: any) => t.trigger_type === 'post_workout')

            formTriggers = {
                preWorkout: pre ? {
                    formTemplateId: pre.form_template_id,
                    formTitle: (pre as any).form_templates?.title || '',
                    formCategory: (pre as any).form_templates?.category || '',
                } : null,
                postWorkout: post ? {
                    formTemplateId: post.form_template_id,
                    formTitle: (post as any).form_templates?.title || '',
                    formCategory: (post as any).form_templates?.category || '',
                } : null,
            }
        }
    }

    return (
        <EditAssignedProgramClient
            trainer={trainer}
            program={program as any}
            exercises={mappedExercises}
            studentId={studentId}
            formTriggers={formTriggers}
        />
    )
}
