'use server'

import { createClient } from '@/lib/supabase/server'

export interface WorkoutTriggerData {
    formTemplateId: string
    title: string
    schemaJson: any
}

export interface WorkoutTriggersResult {
    preWorkout: WorkoutTriggerData | null
    postWorkout: WorkoutTriggerData | null
}

export async function getWorkoutFormTriggers(
    assignedProgramId: string,
): Promise<{ success: boolean; data?: WorkoutTriggersResult; error?: string }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data, error } = await supabase.rpc('get_active_workout_triggers', {
        p_assigned_program_id: assignedProgramId,
    })

    if (error) return { success: false, error: error.message }

    const result = data as { ok: boolean; triggers: any[] }
    if (!result?.ok) return { success: false, error: 'Erro ao buscar triggers' }

    const triggers = result.triggers || []
    const pre = triggers.find((t: any) => t.trigger_type === 'pre_workout')
    const post = triggers.find((t: any) => t.trigger_type === 'post_workout')

    return {
        success: true,
        data: {
            preWorkout: pre
                ? { formTemplateId: pre.form_template_id, title: pre.form_title, schemaJson: pre.schema_json }
                : null,
            postWorkout: post
                ? { formTemplateId: post.form_template_id, title: post.form_title, schemaJson: post.schema_json }
                : null,
        },
    }
}
