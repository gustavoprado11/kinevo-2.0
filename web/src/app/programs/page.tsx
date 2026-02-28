import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { ProgramsClient } from './programs-client'

export default async function ProgramsPage() {
    const { trainer } = await getTrainerWithSubscription()
    const supabase = await createClient()

    // Fetch templates with nested workouts, exercises (for muscle groups), and usage count
    const { data: programs } = await supabase
        .from('program_templates')
        .select(`
            id, name, description, duration_weeks, created_at,
            workout_templates(
                id, name, order_index, frequency,
                workout_item_templates(
                    id, item_type,
                    exercises(
                        exercise_muscle_groups(
                            muscle_groups(name)
                        )
                    )
                )
            ),
            assigned_programs(id)
        `)
        .eq('is_template', true)
        .order('created_at', { ascending: false })

    // Enrich each program with computed fields
    const enriched = (programs || []).map((p: any) => {
        const workouts = (p.workout_templates || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((w: any) => ({
                id: w.id,
                name: w.name,
                exerciseCount: (w.workout_item_templates || [])
                    .filter((item: any) => item.item_type === 'exercise').length,
                frequency: w.frequency || null,
            }))

        // Collect unique muscle groups from all exercises across all workouts
        const muscleGroupSet = new Set<string>()
        for (const w of p.workout_templates || []) {
            for (const item of w.workout_item_templates || []) {
                if (item.exercises?.exercise_muscle_groups) {
                    for (const emg of item.exercises.exercise_muscle_groups) {
                        if (emg.muscle_groups?.name) {
                            muscleGroupSet.add(emg.muscle_groups.name)
                        }
                    }
                }
            }
        }

        return {
            id: p.id,
            name: p.name,
            description: p.description,
            duration_weeks: p.duration_weeks,
            created_at: p.created_at,
            workout_count: workouts.length,
            exercise_count: workouts.reduce((sum: number, w: any) => sum + w.exerciseCount, 0),
            muscle_groups: Array.from(muscleGroupSet).sort(),
            usage_count: Array.isArray(p.assigned_programs) ? p.assigned_programs.length : 0,
            workouts,
        }
    })

    return <ProgramsClient trainer={trainer} programs={enriched} />
}
