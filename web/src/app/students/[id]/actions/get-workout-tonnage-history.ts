'use server'

import { createClient } from '@/lib/supabase/server'

export interface WorkoutTonnagePoint {
    sessionId: string
    completedAt: string
    tonnage: number
    exerciseBreakdown: { name: string; tonnage: number }[]
}

export interface WorkoutTonnageHistory {
    workoutId: string
    workoutName: string
    points: WorkoutTonnagePoint[]
    /** Percent change from first to last point */
    overallChange: number | null
    /** Percent change between the last two sessions */
    lastChange: number | null
}

export async function getWorkoutTonnageHistory(
    programId: string,
): Promise<{ success: boolean; data?: WorkoutTonnageHistory[]; error?: string }> {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        // 1. Get all assigned workouts for this program
        const { data: workouts } = await supabase
            .from('assigned_workouts')
            .select('id, name')
            .eq('assigned_program_id', programId)
            .order('name')

        if (!workouts || workouts.length === 0) return { success: true, data: [] }

        const result: WorkoutTonnageHistory[] = []

        for (const workout of workouts) {
            // 2. Get last 8 completed sessions for this workout
            const { data: sessions } = await supabase
                .from('workout_sessions')
                .select('id, completed_at')
                .eq('assigned_workout_id', workout.id)
                .eq('assigned_program_id', programId)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(8)

            if (!sessions || sessions.length === 0) continue

            // Reverse to chronological order
            const chronoSessions = [...sessions].reverse()

            // 3. For each session, calculate tonnage with exercise breakdown
            const points: WorkoutTonnagePoint[] = []

            for (const session of chronoSessions) {
                // Get set logs with exercise names
                const { data: logs } = await supabase
                    .from('set_logs')
                    .select('weight, reps_completed, assigned_workout_items!inner(exercise_name)')
                    .eq('workout_session_id', session.id)

                if (!logs || logs.length === 0) {
                    points.push({
                        sessionId: session.id,
                        completedAt: session.completed_at!,
                        tonnage: 0,
                        exerciseBreakdown: [],
                    })
                    continue
                }

                // Group by exercise name
                const exerciseMap = new Map<string, number>()
                let totalTonnage = 0

                for (const log of logs) {
                    const w = log.weight || 0
                    const r = log.reps_completed || 0
                    const t = w * r
                    totalTonnage += t

                    const name = (log.assigned_workout_items as any)?.exercise_name || 'Sem nome'
                    exerciseMap.set(name, (exerciseMap.get(name) || 0) + t)
                }

                // Sort exercises by tonnage descending
                const breakdown = Array.from(exerciseMap.entries())
                    .map(([name, tonnage]) => ({ name, tonnage }))
                    .sort((a, b) => b.tonnage - a.tonnage)

                points.push({
                    sessionId: session.id,
                    completedAt: session.completed_at!,
                    tonnage: totalTonnage,
                    exerciseBreakdown: breakdown,
                })
            }

            // Only include workouts with at least 1 session that has tonnage > 0
            const validPoints = points.filter(p => p.tonnage > 0)
            if (validPoints.length === 0) continue

            // 4. Calculate changes
            let overallChange: number | null = null
            let lastChange: number | null = null

            if (validPoints.length >= 2) {
                const first = validPoints[0].tonnage
                const last = validPoints[validPoints.length - 1].tonnage
                if (first > 0) {
                    overallChange = ((last - first) / first) * 100
                }

                const prev = validPoints[validPoints.length - 2].tonnage
                if (prev > 0) {
                    lastChange = ((last - prev) / prev) * 100
                }
            }

            result.push({
                workoutId: workout.id,
                workoutName: workout.name,
                points: validPoints,
                overallChange,
                lastChange,
            })
        }

        return { success: true, data: result }
    } catch (error: any) {
        console.error('Error fetching workout tonnage history:', error)
        return { success: false, error: 'Erro ao buscar histórico de carga' }
    }
}
