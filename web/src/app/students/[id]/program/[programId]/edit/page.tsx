import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { EditAssignedProgramClient } from '@/components/programs/edit-assigned-program-client'
import { getFormTemplatesForTriggers } from '@/actions/programs/get-form-templates-for-triggers'
import { getTrainerExerciseLibrary } from '@/lib/exercises/get-trainer-library'

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

    // Get the assigned program with its workouts, items, and source template.
    // Fase 4.5i: include method_key + rounds and JOIN with assigned_workout_item_sets
    // so the builder can hydrate set_scheme via collapseExpandedScheme on load.
    // Fase 4.5j: surface the Supabase error instead of swallowing it. Silent
    // failures on this query were masking the real cause of "An unexpected
    // response was received from the server" after save (RSC re-fetch via
    // router.refresh produced an inconsistent payload because notFound() was
    // firing on a hidden join failure).
    // Run the heavy program tree query in parallel with the (cached) library
    // fetch — eliminates ~hundreds of ms on the worst-performing route.
    const [
        { data: program, error: programError },
        mappedExercises,
    ] = await Promise.all([
        supabase
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
                        item_config,
                        method_key,
                        rounds,
                        assigned_workout_item_sets (
                            set_number,
                            set_type,
                            reps,
                            rest_seconds,
                            weight_target_kg,
                            weight_target_pct1rm,
                            rir,
                            tempo,
                            notes,
                            round_number
                        )
                    )
                )
            `)
            .eq('id', programId)
            .eq('student_id', studentId)
            .single(),
        getTrainerExerciseLibrary(trainer.id),
    ])

    // Fase 4.5j: log the Supabase error explicitly. If we don't, an RLS
    // rejection or schema mismatch on the LEFT JOIN comes back as a generic
    // "program is null → notFound()" and we have no idea what actually
    // broke. The log lands in the **Next.js dev server terminal** (the
    // window where you ran `npm run dev`), NOT in the browser DevTools
    // console — this is a Server Component running on the Node server.
    if (programError) {
        console.error('[EditProgramPage] Failed to load assigned program:', {
            programId,
            studentId,
            code: programError.code,
            message: programError.message,
            details: programError.details,
            hint: programError.hint,
        })
    }

    if (!program) {
        notFound()
    }

    // Fetch form trigger templates for configuration + existing triggers from source
    const triggerResult = await getFormTemplatesForTriggers()
    let formTriggers: { preWorkout: any; postWorkout: any } | undefined
    const sourceTemplateId: string | null = (program as any).source_template_id ?? null

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
            sourceTemplateId={sourceTemplateId}
            formTriggers={formTriggers}
            formTriggerTemplates={triggerResult.templates || []}
        />
    )
}
