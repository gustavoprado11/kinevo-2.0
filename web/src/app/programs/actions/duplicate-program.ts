'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function duplicateProgram(templateId: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Trainer not found' }

        // Fetch original template
        const { data: original } = await supabase
            .from('program_templates')
            .select('*')
            .eq('id', templateId)
            .single()
        if (!original) return { success: false, error: 'Template not found' }

        // Create copy
        const { data: newTemplate, error: err } = await supabase
            .from('program_templates')
            .insert({
                trainer_id: trainer.id,
                name: `${original.name} (Cópia)`,
                description: original.description,
                duration_weeks: original.duration_weeks,
                is_template: true,
            })
            .select('id')
            .single()
        if (err || !newTemplate) return { success: false, error: 'Failed to create copy' }

        // Fetch and copy workouts
        const { data: workouts } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('program_template_id', templateId)
            .order('order_index')

        for (const workout of workouts || []) {
            const { data: newWorkout } = await supabase
                .from('workout_templates')
                .insert({
                    program_template_id: newTemplate.id,
                    name: workout.name,
                    order_index: workout.order_index,
                    frequency: workout.frequency,
                })
                .select('id')
                .single()
            if (!newWorkout) continue

            // Fetch and copy items
            const { data: items } = await supabase
                .from('workout_item_templates')
                .select('*')
                .eq('workout_template_id', workout.id)
                .order('order_index')

            const parentMap = new Map<string, string>()

            // Root items first
            for (const item of (items || []).filter(i => !i.parent_item_id)) {
                const { data: newItem } = await supabase
                    .from('workout_item_templates')
                    .insert({
                        workout_template_id: newWorkout.id,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                    })
                    .select('id')
                    .single()
                if (newItem) parentMap.set(item.id, newItem.id)
            }

            // Child items (inside supersets)
            for (const item of (items || []).filter(i => i.parent_item_id)) {
                const newParentId = parentMap.get(item.parent_item_id!)
                if (!newParentId) continue

                await supabase
                    .from('workout_item_templates')
                    .insert({
                        workout_template_id: newWorkout.id,
                        parent_item_id: newParentId,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        exercise_id: item.exercise_id,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                    })
            }
        }

        revalidatePath('/programs')
        return { success: true, newId: newTemplate.id }
    } catch (error) {
        console.error('Error duplicating program:', error)
        return { success: false, error: 'Failed to duplicate' }
    }
}
