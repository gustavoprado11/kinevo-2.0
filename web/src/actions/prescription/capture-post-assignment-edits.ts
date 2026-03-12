'use server'

import { createClient } from '@/lib/supabase/server'
import { computeEditsDiff, convertAssignedToGeneratedWorkouts } from '@/lib/prescription/edits-diff'
import { refreshTrainerPatterns } from '@/lib/prescription/trainer-patterns'

// ============================================================================
// Capture Post-Assignment Edits for AI Learning
// ============================================================================
// When a trainer edits an active AI-generated program, this action:
//   1. Looks up the linked prescription_generation
//   2. Re-computes the diff (original AI output vs current state)
//   3. Updates trainer_edits_diff on the generation record
//   4. Refreshes trainer patterns for future AI prescriptions
//
// This is fire-and-forget — failures never affect program editing.
// Non-AI programs exit immediately after the generation lookup.

export async function capturePostAssignmentEdits(
    programId: string,
): Promise<void> {
    try {
        const supabase = await createClient()

        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 2. Trainer lookup
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) return

        // 3. Check if program is AI-generated
        const { data: program } = await supabase
            .from('assigned_programs')
            .select('prescription_generation_id')
            .eq('id', programId)
            .single()

        const generationId = (program as any)?.prescription_generation_id
        if (!generationId) return // Not AI-generated — nothing to learn

        // 4. Fetch original AI output + existing diff
        // @ts-ignore — table from migration 035
        const { data: generation } = await supabase
            .from('prescription_generations')
            .select('output_snapshot, trainer_edits_diff')
            .eq('id', generationId)
            .single()

        const outputSnapshot = (generation as any)?.output_snapshot
        if (!outputSnapshot) return // No snapshot to compare against

        // 5. Fetch current program structure
        const { data: workoutRows } = await supabase
            .from('assigned_workouts')
            .select('id, name, order_index, scheduled_days')
            .eq('assigned_program_id', programId)
            .order('order_index')

        if (!workoutRows || workoutRows.length === 0) return

        const workoutIds = workoutRows.map((w: any) => w.id)

        const { data: itemRows } = await supabase
            .from('assigned_workout_items')
            .select('id, assigned_workout_id, exercise_id, exercise_name, exercise_muscle_group, exercise_equipment, sets, reps, rest_seconds, notes, order_index, item_type')
            .in('assigned_workout_id', workoutIds)
            .order('order_index')

        if (!itemRows) return

        // 6. Convert to GeneratedWorkout[] format
        const currentWorkouts = convertAssignedToGeneratedWorkouts(
            workoutRows as any,
            itemRows as any,
        )

        // 7. Compute diff against original AI output
        const newDiff = computeEditsDiff(outputSnapshot, currentWorkouts)

        // 8. Skip write if diff hasn't changed
        const existingDiff = (generation as any)?.trainer_edits_diff
        if (
            existingDiff &&
            existingDiff.total_edits === newDiff.total_edits &&
            existingDiff.item_edits?.length === newDiff.item_edits?.length
        ) {
            return // Diff unchanged — no write needed
        }

        // 9. Update prescription_generations with new diff
        // @ts-ignore — trainer_edits_diff from migration 064
        await supabase
            .from('prescription_generations')
            .update({ trainer_edits_diff: newDiff })
            .eq('id', generationId)

        // 10. Log capture
        console.info('[AI_LEARNING_CAPTURED]', {
            programId,
            generationId,
            edits: newDiff.total_edits,
            volumeChanges: newDiff.volume_changes.length,
        })

        // 11. Refresh trainer patterns (fire-and-forget)
        refreshTrainerPatterns(supabase, trainer.id).catch(err =>
            console.error('[AI_PATTERN_REFRESH_FAILED]', err),
        )
    } catch (err) {
        // 12. Never let this affect program editing
        console.error('[AI_LEARNING_CAPTURE_FAILED]', err)
    }
}
