import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramBuilderClient, type Exercise } from '@/components/programs'
import { getFormTemplatesForTriggers } from '@/actions/programs/get-form-templates-for-triggers'

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Get program with workouts and items
    const { data: program } = await supabase
        .from('program_templates')
        .select(`
            id,
            name,
            description,
            duration_weeks,
            workout_templates (
                id,
                name,
                order_index,
                frequency,
                workout_item_templates (
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
                    exercise_function,
                    item_config
                )
            )
        `)
        .eq('id', id)
        .single()

    if (!program) {
        redirect('/programs')
    }

    // Get exercises for the exercise picker
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

    // Map to Exercise type with backward compatibility
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

    // Fetch form templates and existing triggers for this program
    const [triggerResult, { data: existingTriggers }] = await Promise.all([
        getFormTemplatesForTriggers(),
        supabase
            .from('program_form_triggers')
            .select('trigger_type, form_template_id, form_templates(title, category)')
            .eq('program_template_id', id)
            .eq('is_active', true),
    ])

    const preTrigger = existingTriggers?.find((t: any) => t.trigger_type === 'pre_workout')
    const postTrigger = existingTriggers?.find((t: any) => t.trigger_type === 'post_workout')

    const initialFormTriggers = {
        preWorkout: preTrigger ? {
            formTemplateId: preTrigger.form_template_id,
            formTitle: (preTrigger as any).form_templates?.title || '',
            formCategory: (preTrigger as any).form_templates?.category || '',
        } : null,
        postWorkout: postTrigger ? {
            formTemplateId: postTrigger.form_template_id,
            formTitle: (postTrigger as any).form_templates?.title || '',
            formCategory: (postTrigger as any).form_templates?.category || '',
        } : null,
    }

    return (
        <ProgramBuilderClient
            trainer={trainer}
            program={program}
            exercises={mappedExercises}
            formTriggerTemplates={triggerResult.templates || []}
            initialFormTriggers={initialFormTriggers}
        />
    )
}
