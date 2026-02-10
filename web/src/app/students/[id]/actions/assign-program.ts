'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface AssignProgramParams {
    studentId: string
    templateId: string
    startDate: string
    isScheduled: boolean
    workoutSchedule?: Record<number, number[]> // order_index -> days (0-6)
}

export async function assignProgram({ studentId, templateId, startDate, isScheduled, workoutSchedule }: AssignProgramParams) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Get trainer ID
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) throw new Error('Trainer not found')

        // 2. Validate student ownership
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('trainer_id', trainer.id)
            .single()

        if (!student) throw new Error('Student not found or unauthorized')

        // 3. Get template data
        const { data: template } = await supabase
            .from('program_templates')
            .select('*')
            .eq('id', templateId)
            .single()

        if (!template) throw new Error('Template not found')

        // 4. Handle "Immediate" vs "Scheduled"
        let status = 'active'
        let scheduledStartDate = null
        let startedAt: string | null = new Date().toISOString()

        if (isScheduled) {
            status = 'scheduled'
            scheduledStartDate = startDate
            startedAt = null // Will be set when activated
        } else {
            // Immediate assignment: Complete current active program
            // Use 'completed' as requested by user logic
            await supabase
                .from('assigned_programs')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('student_id', studentId)
                .eq('status', 'active')
        }

        // 5. Create Assigned Program
        const { data: assignedProgram, error: programError } = await supabase
            .from('assigned_programs')
            .insert({
                student_id: studentId,
                trainer_id: trainer.id,
                source_template_id: templateId,
                name: template.name,
                description: template.description,
                duration_weeks: template.duration_weeks,
                status: status,
                started_at: startedAt,
                scheduled_start_date: scheduledStartDate,
                current_week: 1
            })
            .select('id')
            .single()

        if (programError) throw programError

        // 6. Copy Workouts and Items
        // Fetch original workouts
        const { data: workouts } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('program_template_id', templateId)
            .order('order_index')

        if (workouts) {
            for (const workout of workouts) {
                // Determine scheduled days
                let scheduledDays: number[] = []

                // Priority 1: Direct schedule override (if provided)
                if (workoutSchedule?.[workout.order_index]) {
                    scheduledDays = workoutSchedule[workout.order_index]
                }
                // Priority 2: Template frequency
                else if (workout.frequency && Array.isArray(workout.frequency)) {
                    const dayMap: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                    scheduledDays = workout.frequency
                        .map((d: string) => dayMap[d.toLowerCase()])
                        .filter((d: number) => d !== undefined)
                }

                // Insert assigned workout
                const { data: assignedWorkout, error: workoutError } = await supabase
                    .from('assigned_workouts')
                    .insert({
                        assigned_program_id: assignedProgram.id,
                        source_template_id: workout.id,
                        name: workout.name,
                        order_index: workout.order_index,
                        scheduled_days: scheduledDays
                    })
                    .select('id')
                    .single()

                if (workoutError) throw workoutError

                // Fetch items for this workout
                // We fetch all items and reconstruct hierarchy
                const { data: items } = await supabase
                    .from('workout_item_templates')
                    .select(`
                        *,
                        exercises (
                            id, name, equipment,
                            exercise_muscle_groups (
                                muscle_groups (name)
                            )
                        )
                    `)
                    .eq('workout_template_id', workout.id)
                    .order('order_index')

                if (items) {
                    // Map to handle parent-child relationships (supersets)
                    const parentMap = new Map<string, string>()

                    // First pass: Items without parents (Exercises or Superset containers)
                    const rootItems = items.filter(i => !i.parent_item_id)

                    for (const item of rootItems) {
                        const exerciseName = item.exercises?.name || null
                        const exerciseEquipment = item.exercises?.equipment || null

                        // Extract muscle groups string
                        let exerciseMuscleGroup = null
                        if (item.exercises?.exercise_muscle_groups) {
                            const groups = item.exercises.exercise_muscle_groups
                                .map((emg: any) => emg.muscle_groups?.name)
                                .filter(Boolean)
                            if (groups.length > 0) exerciseMuscleGroup = groups.join(', ')
                        }

                        const { data: assignedItem, error: itemError } = await supabase
                            .from('assigned_workout_items')
                            .insert({
                                assigned_workout_id: assignedWorkout.id,
                                source_template_id: item.id,
                                item_type: item.item_type,
                                order_index: item.order_index,
                                exercise_id: item.exercise_id,
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_name: exerciseName,
                                exercise_muscle_group: exerciseMuscleGroup,
                                exercise_equipment: exerciseEquipment,
                                sets: item.sets,
                                reps: item.reps,
                                rest_seconds: item.rest_seconds,
                                notes: item.notes,
                                parent_item_id: null
                            })
                            .select('id')
                            .single()

                        if (itemError) throw itemError

                        parentMap.set(item.id, assignedItem.id)
                    }

                    // Second pass: Child items (items inside supersets)
                    const childItems = items.filter(i => i.parent_item_id)

                    for (const item of childItems) {
                        const parentAssignedId = parentMap.get(item.parent_item_id!)
                        if (!parentAssignedId) continue // Should not happen if data is consistent

                        const exerciseName = item.exercises?.name || null
                        const exerciseEquipment = item.exercises?.equipment || null
                        let exerciseMuscleGroup = null
                        if (item.exercises?.exercise_muscle_groups) {
                            const groups = item.exercises.exercise_muscle_groups
                                .map((emg: any) => emg.muscle_groups?.name)
                                .filter(Boolean)
                            if (groups.length > 0) exerciseMuscleGroup = groups.join(', ')
                        }

                        await supabase
                            .from('assigned_workout_items')
                            .insert({
                                assigned_workout_id: assignedWorkout.id,
                                source_template_id: item.id,
                                item_type: item.item_type,
                                order_index: item.order_index,
                                exercise_id: item.exercise_id,
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_name: exerciseName,
                                exercise_muscle_group: exerciseMuscleGroup,
                                exercise_equipment: exerciseEquipment,
                                sets: item.sets,
                                reps: item.reps,
                                rest_seconds: item.rest_seconds,
                                notes: item.notes,
                                parent_item_id: parentAssignedId
                            })
                    }
                }
            }
        }

        revalidatePath(`/students/${studentId}`)
        return { success: true, programId: assignedProgram.id }

    } catch (error) {
        console.error('Error assigning program:', error)
        return { success: false, error: 'Failed to assign program' }
    }
}
