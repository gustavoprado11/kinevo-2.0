import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'
import {
    assignFromSnapshot,
    GenerationNotFoundError,
    GenerationAlreadyApprovedError,
    GenerationSnapshotMissingError,
    GenerationSnapshotAllItemsInvalidError,
    type OutputSnapshot,
} from '@/lib/ai-prescription/assign-from-snapshot'

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
            generationId,
            startDate,
            isScheduled = false,
            workoutSchedule,
            prescriptionGenerationId,
            outputSnapshot,
            isEdited = false,
        } = body

        if (!studentId || (!templateId && !generationId)) {
            return NextResponse.json(
                { error: 'studentId and one of: templateId | generationId are required' },
                { status: 400 },
            )
        }

        if (!UUID_RE.test(studentId)) {
            return NextResponse.json({ error: 'Invalid studentId format' }, { status: 400 })
        }

        if (templateId && !UUID_RE.test(templateId)) {
            return NextResponse.json({ error: 'Invalid templateId format' }, { status: 400 })
        }

        if (generationId && !UUID_RE.test(generationId)) {
            return NextResponse.json({ error: 'Invalid generationId format' }, { status: 400 })
        }

        if (prescriptionGenerationId && !UUID_RE.test(prescriptionGenerationId)) {
            return NextResponse.json({ error: 'Invalid prescriptionGenerationId format' }, { status: 400 })
        }

        // If both provided, templateId wins (preserves the unchanged web branch)
        // while flagging the call so we can find callers that sent both.
        if (templateId && generationId) {
            console.warn(
                '[programs/assign] both templateId and generationId provided, preferring templateId',
                { trainerId: null, studentId },
            )
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

        // Branch: generationId path (mobile AI-approved flow).
        //
        // Default behavior (isEdited !== true): the helper re-fetches the
        // snapshot from the DB and ignores any `outputSnapshot` in the body.
        //
        // Edited behavior (isEdited === true && outputSnapshot supplied):
        // before passing the snapshot to the helper, the route runs three
        // validations server-side. None of these may be skipped — see the
        // header comment in `lib/ai-prescription/assign-from-snapshot.ts`
        // (Fase 2.5.4 §5 revisado) for the security contract.
        if (!templateId && generationId) {
            let editedSnapshot: OutputSnapshot | undefined
            if (isEdited === true) {
                if (!outputSnapshot) {
                    return NextResponse.json(
                        { error: 'isEdited=true requer outputSnapshot no body.' },
                        { status: 400 },
                    )
                }
                // Validation 1 of 3: shape. Reasoning fields are intentionally
                // permissive (empty strings / 0 score allowed) — see Fase 2b
                // notes; the strong checks are shape and catalog membership,
                // not reasoning quality.
                const shapeResult = validateOutputSnapshotShape(outputSnapshot)
                if (!shapeResult.ok) {
                    return NextResponse.json(
                        { error: `Snapshot inválido: ${shapeResult.error}` },
                        { status: 400 },
                    )
                }
                editedSnapshot = shapeResult.value

                // Validation 2 of 3: ownership of generationId. The helper
                // does this too, but failing fast here gives a clean 403 on
                // cross-trainer payload tampering before we hit the catalog
                // query. RLS already filters but we double-check explicitly.
                const { data: ownership } = await supabase
                    .from('prescription_generations')
                    .select('id')
                    .eq('id', generationId)
                    .eq('trainer_id', trainer.id)
                    .eq('student_id', studentId)
                    .single()
                if (!ownership) {
                    return NextResponse.json(
                        { error: 'Acesso negado: você não é dono desta geração.' },
                        { status: 403 },
                    )
                }

                // Validation 3 of 3: every exercise_id in the snapshot must
                // resolve to an exercise the trainer can use (system-owned
                // owner_id IS NULL or owned by this trainer). The helper
                // re-applies a filter as defense in depth, but we validate
                // here so the trainer gets a descriptive 400 with the offending
                // ID instead of a silently-trimmed snapshot.
                const allExerciseIds = new Set<string>()
                for (const w of editedSnapshot.workouts) {
                    for (const it of w.items) {
                        if (it.exercise_id && typeof it.exercise_id === 'string') {
                            allExerciseIds.add(it.exercise_id)
                        }
                    }
                }
                if (allExerciseIds.size > 0) {
                    const { data: catalogRows, error: catalogErr } = await supabase
                        .from('exercises')
                        .select('id, owner_id')
                        .in('id', Array.from(allExerciseIds))
                    if (catalogErr) {
                        console.error('[programs/assign] catalog lookup failed', { trainerId: trainer.id, generationId, err: catalogErr })
                        return NextResponse.json(
                            { error: 'Erro ao validar catálogo de exercícios.' },
                            { status: 500 },
                        )
                    }
                    const accessible = new Set<string>()
                    for (const row of catalogRows ?? []) {
                        const r = row as { id: string; owner_id: string | null }
                        if (r.owner_id === null || r.owner_id === trainer.id) {
                            accessible.add(r.id)
                        }
                    }
                    for (const id of allExerciseIds) {
                        if (!accessible.has(id)) {
                            return NextResponse.json(
                                { error: `Exercício fora do catálogo: ${id}` },
                                { status: 400 },
                            )
                        }
                    }
                }
            }

            try {
                const { programId } = await assignFromSnapshot(supabase, {
                    generationId,
                    trainerId: trainer.id,
                    studentId,
                    startDate: startDate ?? null,
                    isScheduled,
                    workoutSchedule,
                    editedSnapshot,
                })
                console.log('[programs/assign] generation persisted', {
                    trainerId: trainer.id,
                    studentId,
                    generationId,
                    wasEdited: !!editedSnapshot,
                })
                return NextResponse.json({ success: true, programId })
            } catch (err) {
                if (err instanceof GenerationNotFoundError) {
                    return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
                }
                if (err instanceof GenerationAlreadyApprovedError) {
                    return NextResponse.json({ error: 'Generation already approved' }, { status: 409 })
                }
                if (err instanceof GenerationSnapshotMissingError) {
                    return NextResponse.json({ error: 'Generation has no snapshot' }, { status: 422 })
                }
                if (err instanceof GenerationSnapshotAllItemsInvalidError) {
                    return NextResponse.json(
                        { error: 'A prescrição gerada contém dados inválidos. Regere o programa e tente novamente.' },
                        { status: 422 },
                    )
                }
                throw err
            }
        }

        // 3. Get template (filter by trainer_id to prevent assigning other trainers' templates)
        const { data: template } = await supabase
            .from('program_templates')
            .select('*')
            .eq('id', templateId)
            .eq('trainer_id', trainer.id)
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
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_function: item.exercise_function || null,
                                item_config: item.item_config || {},
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

                        const { error: childError } = await supabase
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
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_function: item.exercise_function || null,
                                item_config: item.item_config || {},
                                parent_item_id: parentAssignedId
                            })

                        if (childError) throw childError
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

// ===========================================================================
// outputSnapshot shape validator (Fase 2b)
//
// Manual validator (consistent with the agentState validator in
// /api/prescription/generate). Strong on shape and item-level fields the
// downstream insert depends on; permissive on `reasoning` (empty strings
// and confidence_score=0 are accepted — the trainer-edited snapshot
// produced by the mobile builder may carry empty reasoning when the
// caller didn't preserve the original).
// ===========================================================================

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function validateOutputSnapshotShape(input: unknown): ParseResult<OutputSnapshot> {
    if (!input || typeof input !== 'object') return { ok: false, error: 'snapshot must be an object' }
    const s = input as Record<string, unknown>

    if (!s.program || typeof s.program !== 'object') return { ok: false, error: 'snapshot.program missing' }
    const p = s.program as Record<string, unknown>
    if (typeof p.name !== 'string' || p.name.trim().length === 0) {
        return { ok: false, error: 'snapshot.program.name required' }
    }

    if (!Array.isArray(s.workouts)) return { ok: false, error: 'snapshot.workouts must be an array' }
    if (s.workouts.length === 0) return { ok: false, error: 'snapshot.workouts must contain at least 1 workout' }

    for (let wi = 0; wi < s.workouts.length; wi++) {
        const w = s.workouts[wi] as Record<string, unknown> | null
        if (!w || typeof w !== 'object') return { ok: false, error: `workouts[${wi}] must be an object` }
        if (typeof w.name !== 'string' || w.name.trim().length === 0) {
            return { ok: false, error: `workouts[${wi}].name required` }
        }
        if (typeof w.order_index !== 'number' || !Number.isInteger(w.order_index)) {
            return { ok: false, error: `workouts[${wi}].order_index must be an integer` }
        }
        if (w.scheduled_days !== undefined) {
            if (!Array.isArray(w.scheduled_days) || !w.scheduled_days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)) {
                return { ok: false, error: `workouts[${wi}].scheduled_days must be integers 0..6` }
            }
        }
        if (!Array.isArray(w.items)) return { ok: false, error: `workouts[${wi}].items must be an array` }
        for (let ii = 0; ii < w.items.length; ii++) {
            const it = w.items[ii] as Record<string, unknown> | null
            if (!it || typeof it !== 'object') return { ok: false, error: `workouts[${wi}].items[${ii}] must be an object` }
            if (typeof it.order_index !== 'number' || !Number.isInteger(it.order_index)) {
                return { ok: false, error: `workouts[${wi}].items[${ii}].order_index must be an integer` }
            }
            if (it.exercise_id !== null && typeof it.exercise_id !== 'string') {
                return { ok: false, error: `workouts[${wi}].items[${ii}].exercise_id must be a string or null` }
            }
            if (it.exercise_id && typeof it.exercise_id === 'string' && !UUID_RE.test(it.exercise_id)) {
                return { ok: false, error: `workouts[${wi}].items[${ii}].exercise_id is not a valid UUID` }
            }
            if (it.sets !== null && it.sets !== undefined && typeof it.sets !== 'number') {
                return { ok: false, error: `workouts[${wi}].items[${ii}].sets must be number or null` }
            }
            if (it.reps !== null && it.reps !== undefined && typeof it.reps !== 'string') {
                return { ok: false, error: `workouts[${wi}].items[${ii}].reps must be string or null` }
            }
            if (it.rest_seconds !== null && it.rest_seconds !== undefined && typeof it.rest_seconds !== 'number') {
                return { ok: false, error: `workouts[${wi}].items[${ii}].rest_seconds must be number or null` }
            }
        }
    }

    return { ok: true, value: input as OutputSnapshot }
}
