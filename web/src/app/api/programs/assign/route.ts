import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/programs/assign
 *
 * Assigns a program template to a student. Used by the mobile app
 * which authenticates via Supabase JWT (Bearer token).
 *
 * Reuses the same logic as the web server action at
 * web/src/app/students/[id]/actions/assign-program.ts
 */
export async function POST(request: NextRequest) {
    try {
        // Extract Bearer token
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
        }
        const token = authHeader.slice(7)

        // Create Supabase client authenticated as the calling user
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        )

        // Parse body
        const body = await request.json()
        const {
            studentId,
            templateId,
            startDate,
            isScheduled = false,
            workoutSchedule,
            prescriptionGenerationId,
        } = body

        if (!studentId || !templateId) {
            return NextResponse.json({ error: 'studentId and templateId are required' }, { status: 400 })
        }

        if (!UUID_RE.test(studentId) || !UUID_RE.test(templateId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
        }

        if (prescriptionGenerationId && !UUID_RE.test(prescriptionGenerationId)) {
            return NextResponse.json({ error: 'Invalid prescriptionGenerationId format' }, { status: 400 })
        }

        // Validate workoutSchedule structure if provided
        if (workoutSchedule != null) {
            if (typeof workoutSchedule !== 'object' || Array.isArray(workoutSchedule)) {
                return NextResponse.json({ error: 'workoutSchedule must be an object' }, { status: 400 })
            }
            for (const [key, value] of Object.entries(workoutSchedule)) {
                if (isNaN(Number(key))) {
                    return NextResponse.json({ error: 'workoutSchedule keys must be numeric' }, { status: 400 })
                }
                if (!Array.isArray(value) || !(value as number[]).every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)) {
                    return NextResponse.json({ error: 'workoutSchedule values must be arrays of days (0-6)' }, { status: 400 })
                }
            }
        }

        // 1. Auth + trainer lookup
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return NextResponse.json({ error: 'Trainer not found' }, { status: 403 })
        }

        // Rate limit: 10/min, 50/day per trainer
        const rl = checkRateLimit(`programs:assign:${trainer.id}`, { perMinute: 10, perDay: 50 })
        if (!rl.allowed) {
            return NextResponse.json({ error: rl.error }, { status: 429 })
        }
        recordRequest(`programs:assign:${trainer.id}`)

        // 2. Validate student ownership
        const { data: student } = await supabase
            .from('students')
            .select('id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 })
        }

        // 3. Get template
        const { data: template } = await supabase
            .from('program_templates')
            .select('*')
            .eq('id', templateId)
            .single()

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // 4. Handle immediate vs scheduled
        let status = 'active'
        let scheduledStartDate = null
        let startedAt: string | null = new Date().toISOString()

        if (isScheduled) {
            status = 'scheduled'
            scheduledStartDate = startDate
            startedAt = null
        } else {
            // Complete current active program
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

        // 5. Create assigned program
        const insertPayload: Record<string, any> = {
            student_id: studentId,
            trainer_id: trainer.id,
            source_template_id: templateId,
            name: template.name,
            description: template.description,
            duration_weeks: template.duration_weeks,
            status,
            started_at: startedAt,
            scheduled_start_date: scheduledStartDate,
            current_week: 1,
        }

        if (prescriptionGenerationId) {
            insertPayload.ai_generated = true
            insertPayload.prescription_generation_id = prescriptionGenerationId
        }

        const { data: assignedProgram, error: programError } = await supabase
            .from('assigned_programs')
            .insert(insertPayload)
            .select('id')
            .single()

        if (programError) throw programError

        // 6. Copy workouts and items
        const { data: workouts } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('program_template_id', templateId)
            .order('order_index')

        if (workouts) {
            for (const workout of workouts) {
                let scheduledDays: number[] = []

                if (workoutSchedule?.[workout.order_index]) {
                    scheduledDays = workoutSchedule[workout.order_index]
                } else if (workout.frequency && Array.isArray(workout.frequency)) {
                    const dayMap: Record<string, number> = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 }
                    scheduledDays = workout.frequency
                        .map((d: string) => dayMap[d.toLowerCase()])
                        .filter((d: number) => d !== undefined)
                }

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
                    const parentMap = new Map<string, string>()

                    // First pass: root items
                    const rootItems = items.filter((i: any) => !i.parent_item_id)
                    for (const item of rootItems) {
                        const exerciseName = (item as any).exercises?.name || null
                        const exerciseEquipment = (item as any).exercises?.equipment || null
                        let exerciseMuscleGroup = null
                        if ((item as any).exercises?.exercise_muscle_groups) {
                            const groups = (item as any).exercises.exercise_muscle_groups
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

                    // Second pass: child items (supersets)
                    const childItems = items.filter((i: any) => i.parent_item_id)
                    for (const item of childItems) {
                        const parentAssignedId = parentMap.get((item as any).parent_item_id!)
                        if (!parentAssignedId) continue

                        const exerciseName = (item as any).exercises?.name || null
                        const exerciseEquipment = (item as any).exercises?.equipment || null
                        let exerciseMuscleGroup = null
                        if ((item as any).exercises?.exercise_muscle_groups) {
                            const groups = (item as any).exercises.exercise_muscle_groups
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

        // 7. Update prescription generation if AI-generated
        if (prescriptionGenerationId) {
            await supabase
                .from('prescription_generations')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    assigned_program_id: assignedProgram.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', prescriptionGenerationId)
        }

        return NextResponse.json({ success: true, programId: assignedProgram.id })

    } catch (error: any) {
        console.error('[API] Error assigning program:', error)
        return NextResponse.json(
            { error: 'Erro ao atribuir programa.' },
            { status: 500 }
        )
    }
}
