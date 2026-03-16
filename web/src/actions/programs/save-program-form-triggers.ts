'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SaveTriggersInput {
    programTemplateId: string
    preWorkout: string | null   // form_template_id or null to remove
    postWorkout: string | null  // form_template_id or null to remove
}

export async function saveProgramFormTriggers(input: SaveTriggersInput): Promise<{
    success: boolean
    error?: string
}> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Trainer não encontrado' }

    // Verify program ownership
    const { data: program } = await supabase
        .from('program_templates')
        .select('id')
        .eq('id', input.programTemplateId)
        .eq('trainer_id', trainer.id)
        .single()

    if (!program) return { success: false, error: 'Programa não encontrado' }

    const triggerTypes = [
        { type: 'pre_workout' as const, templateId: input.preWorkout },
        { type: 'post_workout' as const, templateId: input.postWorkout },
    ]

    for (const { type, templateId } of triggerTypes) {
        if (templateId) {
            // Upsert trigger
            const { error } = await supabase
                .from('program_form_triggers')
                .upsert(
                    {
                        program_template_id: input.programTemplateId,
                        form_template_id: templateId,
                        trainer_id: trainer.id,
                        trigger_type: type,
                        is_active: true,
                    },
                    { onConflict: 'program_template_id,trigger_type' }
                )

            if (error) return { success: false, error: error.message }
        } else {
            // Delete trigger if it exists
            const { error } = await supabase
                .from('program_form_triggers')
                .delete()
                .eq('program_template_id', input.programTemplateId)
                .eq('trainer_id', trainer.id)
                .eq('trigger_type', type)

            if (error) return { success: false, error: error.message }
        }
    }

    revalidatePath('/programs')
    return { success: true }
}
