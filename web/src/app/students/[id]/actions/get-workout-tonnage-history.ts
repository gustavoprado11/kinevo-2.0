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

        // 2. Get completed sessions for ALL workouts of the program in one
        // query, then keep the last 8 per workout client-side. (PostgREST não
        // expressa "limit 8 por grupo"; o total de sessões de um programa é
        // pequeno o bastante para filtrar em memória — antes eram até ~36
        // round-trips em loop, N+1.)
        const workoutIds = workouts.map(w => w.id)
        const { data: allSessions } = await supabase
            .from('workout_sessions')
            .select('id, completed_at, assigned_workout_id')
            .in('assigned_workout_id', workoutIds)
            .eq('assigned_program_id', programId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })

        const sessionsByWorkout = new Map<string, { id: string; completed_at: string | null }[]>()
        for (const s of allSessions ?? []) {
            const list = sessionsByWorkout.get(s.assigned_workout_id) ?? []
            if (list.length < 8) {
                list.push({ id: s.id, completed_at: s.completed_at })
                sessionsByWorkout.set(s.assigned_workout_id, list)
            }
        }

        // 3. One query for the set logs of every selected session.
        const selectedSessionIds = Array.from(sessionsByWorkout.values()).flat().map(s => s.id)
        const logsBySession = new Map<string, { weight: number | null; reps_completed: number | null; exerciseName: string }[]>()
        if (selectedSessionIds.length > 0) {
            const { data: allLogs } = await supabase
                .from('set_logs')
                .select('workout_session_id, weight, reps_completed, assigned_workout_items!inner(exercise_name)')
                .in('workout_session_id', selectedSessionIds)
            for (const log of allLogs ?? []) {
                const list = logsBySession.get(log.workout_session_id) ?? []
                list.push({
                    weight: log.weight,
                    reps_completed: log.reps_completed,
                    exerciseName: (log.assigned_workout_items as any)?.exercise_name || 'Sem nome',
                })
                logsBySession.set(log.workout_session_id, list)
            }
        }

        const result: WorkoutTonnageHistory[] = []

        for (const workout of workouts) {
            const sessions = sessionsByWorkout.get(workout.id)
            if (!sessions || sessions.length === 0) continue

            // Reverse to chronological order
            const chronoSessions = [...sessions].reverse()

            const points: WorkoutTonnagePoint[] = []

            for (const session of chronoSessions) {
                const logs = logsBySession.get(session.id)

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
                    exerciseMap.set(log.exerciseName, (exerciseMap.get(log.exerciseName) || 0) + t)
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
