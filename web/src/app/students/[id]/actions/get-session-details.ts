'use server'

import { createClient } from '@/lib/supabase/server'

interface GetSessionDetailsResult {
    success: boolean
    data?: any
    error?: string
}

export async function getSessionDetails(sessionId: string): Promise<GetSessionDetailsResult> {
    const supabase = await createClient()

    try {
        // 1. Get Session Info (including workout name)
        const { data: session, error: sessionError } = await supabase
            .from('workout_sessions')
            .select(`
                id,
                started_at,
                completed_at,
                duration_seconds,
                rpe,
                feedback,
                assigned_workouts ( name )
            `)
            .eq('id', sessionId)
            .single()

        if (sessionError) throw sessionError

        // 2. Get Set Logs (Exercises)
        const { data: logs, error: logsError } = await supabase
            .from('set_logs')
            .select(`
                id,
                set_number,
                weight,
                weight_unit,
                reps_completed,
                rpe,
                completed_at,
                executed_exercise_id,
                exercise_id,
                executed_exercise:exercises!set_logs_executed_exercise_id_fkey ( name ),
                legacy_exercise:exercises!set_logs_exercise_id_fkey ( name )
            `)
            .eq('workout_session_id', sessionId)
            .order('completed_at', { ascending: true })

        if (logsError) throw logsError

        // Group logs by exercise
        const exercisesMap = new Map()

        logs.forEach(log => {
            const exerciseId = log.executed_exercise_id || log.exercise_id
            // Force cast because Supabase types with joins can be tricky to infer automatically here
            const executedExerciseData = log.executed_exercise as any
            const legacyExerciseData = log.legacy_exercise as any

            if (!exercisesMap.has(exerciseId)) {
                exercisesMap.set(exerciseId, {
                    exercise_id: exerciseId,
                    name: executedExerciseData?.name || legacyExerciseData?.name || 'Exercício desconhecido',
                    muscle_group: null,
                    sets: []
                })
            }
            exercisesMap.get(exerciseId).sets.push({
                set_number: log.set_number,
                weight: log.weight,
                reps: log.reps_completed,
                rpe: log.rpe
            })
        })

        // Sort sets by set_number just in case
        exercisesMap.forEach(ex => {
            ex.sets.sort((a: any, b: any) => a.set_number - b.set_number)
        })

        return {
            success: true,
            data: {
                ...session,
                exercises: Array.from(exercisesMap.values())
            }
        }

    } catch (error: any) {
        console.error('Error fetching session details:', error)
        return {
            success: false,
            error: error.message || JSON.stringify(error) || 'Erro desconhecido ao carregar detalhes do treino.'
        }
    }
}
