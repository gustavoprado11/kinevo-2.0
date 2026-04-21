import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Materializes `assigned_programs` + `assigned_workouts` + `assigned_workout_items`
 * from a `prescription_generations.output_snapshot`. Used by POST /api/programs/assign
 * when the mobile caller provides `generationId` instead of a pre-saved `templateId`.
 *
 * Security contract:
 *   - The generation is ALWAYS re-fetched from the DB with a triple filter
 *     (id + trainer_id + student_id) for ownership + status check. The
 *     `trainer_id` comes from the authenticated Bearer token upstream — never
 *     from user input.
 *   - By default the snapshot used to materialize the program also comes from
 *     the DB row (`output_snapshot` column) — any `outputSnapshot` the client
 *     may have sent is ignored.
 *
 * Fase 2.5.4 §5 (revisado em Fase 3.x — unificação mobile):
 *   The route MAY pass `input.editedSnapshot` so the mobile builder can
 *   persist a snapshot the trainer edited locally. This bypasses the DB
 *   re-fetch of `output_snapshot` ONLY. It does NOT bypass:
 *     1. Ownership of `generationId` (trainer + student) — re-checked here
 *        regardless.
 *     2. Idempotency (`status === 'approved'` short-circuit) — re-checked here.
 *     3. Catalog filter (every `exercise_id` must resolve to an exercise the
 *        trainer can use: system-owned `owner_id IS NULL` or owned by this
 *        trainer) — re-applied to the supplied snapshot.
 *   The CALLER must additionally have validated the snapshot shape (program /
 *   workouts / items) and the catalog membership before passing
 *   `editedSnapshot` here. Without those upstream checks, do NOT pass
 *   `editedSnapshot`. This helper performs catalog filtering as defense in
 *   depth but does NOT reject malformed shapes — they would crash the insert.
 *
 * Atomicity:
 *   Supabase JS does not expose explicit transactions. If any write after the
 *   `assigned_programs` insert fails, the helper best-effort deletes the
 *   partially-created program row. FKs `assigned_workouts.assigned_program_id`
 *   and `assigned_workout_items.assigned_workout_id` have ON DELETE CASCADE
 *   (verified against information_schema on 2026-04-20), so a single delete
 *   on `assigned_programs` cleans up the whole tree.
 */

export class GenerationNotFoundError extends Error {
    constructor() {
        super('Generation not found')
        this.name = 'GenerationNotFoundError'
    }
}

export class GenerationAlreadyApprovedError extends Error {
    constructor() {
        super('Generation already approved')
        this.name = 'GenerationAlreadyApprovedError'
    }
}

export class GenerationSnapshotMissingError extends Error {
    constructor() {
        super('Generation snapshot missing')
        this.name = 'GenerationSnapshotMissingError'
    }
}

export class GenerationSnapshotAllItemsInvalidError extends Error {
    constructor() {
        super('Generation snapshot has no valid exercise items after filtering')
        this.name = 'GenerationSnapshotAllItemsInvalidError'
    }
}

export interface AssignFromSnapshotInput {
    generationId: string
    trainerId: string
    studentId: string
    /** ISO timestamp. `null` means "now" for immediate assignments. */
    startDate: string | null
    isScheduled: boolean
    /** Optional override: workout order_index -> days of week (0-6). */
    workoutSchedule?: Record<number, number[]>
    /**
     * Trainer-edited snapshot. When present, replaces the DB-stored
     * `output_snapshot` as the source of program/workouts/items materialized
     * into `assigned_*`. The caller MUST have validated shape and catalog
     * membership upstream (see header comment Fase 2.5.4 §5 revisado).
     * Catalog filtering is re-applied here as defense in depth.
     */
    editedSnapshot?: OutputSnapshot
}

export interface AssignFromSnapshotResult {
    programId: string
}

export interface SnapshotItem {
    item_type: string
    order_index: number
    exercise_id: string | null
    exercise_name: string | null
    exercise_muscle_group: string | null
    exercise_equipment: string | null
    exercise_function: string | null
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    notes: string | null
    substitute_exercise_ids?: string[]
    item_config?: Record<string, unknown>
}

export interface SnapshotWorkout {
    name: string
    order_index: number
    scheduled_days?: number[]
    items: SnapshotItem[]
}

export interface SnapshotProgram {
    name: string
    description?: string | null
    duration_weeks?: number | null
}

export interface OutputSnapshot {
    program: SnapshotProgram
    workouts: SnapshotWorkout[]
}

export async function assignFromSnapshot(
    supabase: SupabaseClient,
    input: AssignFromSnapshotInput,
): Promise<AssignFromSnapshotResult> {
    // 1. Re-fetch generation with triple filter (defense in depth vs. RLS).
    //    This step is mandatory regardless of editedSnapshot — it's the
    //    ownership + status gate.
    const { data: generation } = await supabase
        .from('prescription_generations')
        .select('id, status, output_snapshot, student_id, trainer_id, trainer_edits_count')
        .eq('id', input.generationId)
        .eq('trainer_id', input.trainerId)
        .eq('student_id', input.studentId)
        .single()

    if (!generation) {
        throw new GenerationNotFoundError()
    }

    // 2. Idempotency: prevent double-assign from double-tap on mobile.
    if ((generation as { status: string }).status === 'approved') {
        throw new GenerationAlreadyApprovedError()
    }

    // 3. Snapshot source: editedSnapshot (validated upstream by the route)
    //    overrides the DB row when supplied; otherwise re-fetch from the row.
    let snapshot: OutputSnapshot
    if (input.editedSnapshot) {
        snapshot = input.editedSnapshot
        // Even though the route is expected to have validated shape, we
        // double-check the bare-minimum invariants the materialization step
        // depends on. A malformed shape here would crash the insert further
        // down with a less actionable message.
        if (!snapshot.program?.name || !Array.isArray(snapshot.workouts)) {
            throw new GenerationSnapshotMissingError()
        }
    } else {
        const rawSnapshot = (generation as { output_snapshot: unknown }).output_snapshot
        if (!rawSnapshot || typeof rawSnapshot !== 'object') {
            throw new GenerationSnapshotMissingError()
        }
        snapshot = rawSnapshot as OutputSnapshot
        if (!snapshot.program?.name || !Array.isArray(snapshot.workouts)) {
            throw new GenerationSnapshotMissingError()
        }
    }

    // 3.1. Validate exercise_ids against the trainer's pool (system + owned).
    //      The LLM sometimes emits UUIDs that aren't in `exercises` at all
    //      — see Fase 2.5.4 §6.5 class B. Items whose exercise_id is ghost
    //      are dropped silently with a warn. Workouts that end up with 0
    //      items are dropped. If the whole snapshot is empty after filtering
    //      we abort before any write.
    const allExerciseIds = new Set<string>()
    for (const workout of snapshot.workouts) {
        if (!Array.isArray(workout.items)) continue
        for (const item of workout.items) {
            if (item.exercise_id && typeof item.exercise_id === 'string') {
                allExerciseIds.add(item.exercise_id)
            }
        }
    }

    const validExerciseIds = new Set<string>()
    if (allExerciseIds.size > 0) {
        const { data: existingExercises, error: poolError } = await supabase
            .from('exercises')
            .select('id, owner_id')
            .in('id', Array.from(allExerciseIds))
        if (poolError) {
            throw poolError
        }
        for (const row of existingExercises ?? []) {
            const r = row as { id: string; owner_id: string | null }
            if (r.owner_id === null || r.owner_id === input.trainerId) {
                validExerciseIds.add(r.id)
            }
        }
    }

    const filteredWorkouts: Array<{ workout: SnapshotWorkout; items: SnapshotItem[] }> = []
    let totalKeptItems = 0
    for (const workout of snapshot.workouts) {
        const items = Array.isArray(workout.items) ? workout.items : []
        const keptItems: SnapshotItem[] = []
        const droppedIds: string[] = []
        for (const item of items) {
            if (typeof item.exercise_id === 'string' && validExerciseIds.has(item.exercise_id)) {
                keptItems.push(item)
            } else {
                droppedIds.push(item.exercise_id ?? '<null>')
            }
        }
        if (droppedIds.length > 0) {
            console.warn('[assignFromSnapshot] dropping items with ghost exercise_id', {
                generationId: input.generationId,
                workoutOrderIndex: workout.order_index,
                droppedExerciseIds: droppedIds,
                kept: keptItems.length,
            })
        }
        if (keptItems.length === 0) {
            console.warn('[assignFromSnapshot] dropping entire workout (no valid items)', {
                generationId: input.generationId,
                workoutOrderIndex: workout.order_index,
                originalItemCount: items.length,
            })
            continue
        }
        filteredWorkouts.push({ workout, items: keptItems })
        totalKeptItems += keptItems.length
    }

    if (totalKeptItems === 0) {
        console.warn('[assignFromSnapshot] aborting: snapshot has zero valid items across all workouts', {
            generationId: input.generationId,
            originalWorkoutCount: snapshot.workouts.length,
        })
        throw new GenerationSnapshotAllItemsInvalidError()
    }

    // 4. Immediate vs. scheduled — mirrors web server action at
    //    web/src/app/students/[id]/actions/assign-program.ts:55-74.
    let status: 'active' | 'scheduled' = 'active'
    let scheduledStartDate: string | null = null
    let startedAt: string | null = new Date().toISOString()

    if (input.isScheduled) {
        status = 'scheduled'
        scheduledStartDate = input.startDate
        startedAt = null
    } else {
        await supabase
            .from('assigned_programs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('student_id', input.studentId)
            .in('status', ['active', 'expired'])
    }

    // 5. Program metadata. duration_weeks stays null when the snapshot omits
    //    it — see 2.5.4 log §5 for the reasoning (NULL beats a fabricated 4).
    const programName = snapshot.program.name
    const programDescription = snapshot.program.description ?? null
    const durationWeeks =
        typeof snapshot.program.duration_weeks === 'number' && snapshot.program.duration_weeks > 0
            ? snapshot.program.duration_weeks
            : null

    const expiresAt =
        startedAt && durationWeeks
            ? new Date(new Date(startedAt).getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString()
            : null

    // 6. Create assigned_programs row.
    const { data: assignedProgram, error: programError } = await supabase
        .from('assigned_programs')
        .insert({
            student_id: input.studentId,
            trainer_id: input.trainerId,
            source_template_id: null,
            name: programName,
            description: programDescription,
            duration_weeks: durationWeeks,
            status,
            started_at: startedAt,
            scheduled_start_date: scheduledStartDate,
            current_week: 1,
            expires_at: expiresAt,
            ai_generated: true,
            prescription_generation_id: input.generationId,
        })
        .select('id')
        .single()

    if (programError || !assignedProgram) {
        throw programError ?? new Error('Failed to insert assigned_programs')
    }

    const programId = (assignedProgram as { id: string }).id

    // 7. Walk workouts + items (filtered). If any write fails, best-effort
    //    delete the assigned_programs row — cascade clears the rest.
    try {
        for (const { workout, items } of filteredWorkouts) {
            const scheduledDays =
                input.workoutSchedule?.[workout.order_index] ??
                workout.scheduled_days ??
                []

            const { data: assignedWorkout, error: workoutError } = await supabase
                .from('assigned_workouts')
                .insert({
                    assigned_program_id: programId,
                    source_template_id: null,
                    name: workout.name,
                    order_index: workout.order_index,
                    scheduled_days: scheduledDays,
                })
                .select('id')
                .single()

            if (workoutError || !assignedWorkout) {
                throw workoutError ?? new Error('Failed to insert assigned_workouts')
            }

            const assignedWorkoutId = (assignedWorkout as { id: string }).id

            // Snapshot v2.5 is flat — no parent/child (supersets). If the LLM
            // starts emitting `parent_item_id`, add a second pass here.
            for (const item of items) {
                const { error: itemError } = await supabase
                    .from('assigned_workout_items')
                    .insert({
                        assigned_workout_id: assignedWorkoutId,
                        source_template_id: null,
                        parent_item_id: null,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        exercise_id: item.exercise_id,
                        exercise_name: item.exercise_name,
                        exercise_muscle_group: item.exercise_muscle_group,
                        exercise_equipment: item.exercise_equipment,
                        exercise_function: item.exercise_function,
                        sets: item.sets,
                        reps: item.reps,
                        rest_seconds: item.rest_seconds,
                        notes: item.notes,
                        substitute_exercise_ids: sanitizeSubstitutes(
                            item.substitute_exercise_ids ?? [],
                            {
                                generationId: input.generationId,
                                workoutOrderIndex: workout.order_index,
                                itemOrderIndex: item.order_index,
                            },
                        ),
                        item_config: item.item_config ?? {},
                    })

                if (itemError) {
                    throw itemError
                }
            }
        }

        // 8. Mark generation as approved + link. When the trainer persisted
        //    an edited snapshot, bump trainer_edits_count by 1 as the audit
        //    signal. We don't (yet) compute trainer_edits_diff here — that
        //    requires a structural diff between original `output_snapshot`
        //    and `editedSnapshot`, which lives in a separate concern.
        //    TODO(unificacao-mobile): compute trainer_edits_diff and persist
        //    when input.editedSnapshot is present.
        const baseUpdate: Record<string, unknown> = {
            status: 'approved',
            approved_at: new Date().toISOString(),
            assigned_program_id: programId,
            updated_at: new Date().toISOString(),
        }
        if (input.editedSnapshot) {
            const prevCount = (generation as { trainer_edits_count?: number | null }).trainer_edits_count ?? 0
            baseUpdate.trainer_edits_count = prevCount + 1
        }
        await supabase
            .from('prescription_generations')
            .update(baseUpdate)
            .eq('id', input.generationId)

        return { programId }
    } catch (err) {
        console.error('[assignFromSnapshot] failure after program insert, rolling back', {
            programId,
            generationId: input.generationId,
            err,
        })
        await supabase.from('assigned_programs').delete().eq('id', programId)
        throw err
    }
}

/**
 * Drop non-UUID entries from an LLM-generated `substitute_exercise_ids` list.
 * The column is `uuid[]`; a single bad entry throws
 * `invalid input syntax for type uuid` and kills the whole funnel. When we
 * drop something, emit a structured warn so the upstream pipeline bug
 * surfaces in logs without blocking the user flow.
 *
 * See Fase 2.5.4 §5.1 for the rationale and §6.5 for the upstream bug.
 */
function sanitizeSubstitutes(
    raw: unknown[],
    ctx: { generationId: string; workoutOrderIndex: number; itemOrderIndex: number },
): string[] {
    const valid: string[] = []
    const invalid: unknown[] = []
    for (const x of raw) {
        if (typeof x === 'string' && UUID_RE.test(x)) {
            valid.push(x)
        } else {
            invalid.push(x)
        }
    }
    if (invalid.length > 0) {
        console.warn('[assignFromSnapshot] dropping invalid substitute_exercise_ids', {
            ...ctx,
            dropped: invalid,
            kept: valid.length,
        })
    }
    return valid
}
