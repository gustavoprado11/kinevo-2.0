'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ExerciseData } from '@/stores/training-room-store'

interface FinishPayload {
    studentId: string
    trainerId: string
    assignedWorkoutId: string
    assignedProgramId: string
    startedAt: number // Date.now() timestamp
    exercises: ExerciseData[]
    rpe: number | null
    feedback: string | null
}

interface FinishResult {
    sessionId: string | null
    error: string | null
}

export async function finishTrainingRoomWorkout(payload: FinishPayload): Promise<FinishResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { sessionId: null, error: 'Não autorizado' }

    // Validate trainer ownership
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer || trainer.id !== payload.trainerId) {
        return { sessionId: null, error: 'Treinador não encontrado' }
    }

    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id')
        .eq('id', payload.studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return { sessionId: null, error: 'Aluno não encontrado' }
    }

    // 1. Insert workout_sessions via supabaseAdmin (bypasses RLS)
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('workout_sessions')
        .insert({
            student_id: payload.studentId,
            trainer_id: payload.trainerId,
            assigned_workout_id: payload.assignedWorkoutId,
            assigned_program_id: payload.assignedProgramId,
            status: 'completed',
            started_at: new Date(payload.startedAt).toISOString(),
            completed_at: new Date().toISOString(),
            duration_seconds: Math.floor((Date.now() - payload.startedAt) / 1000),
            sync_status: 'synced',
            rpe: payload.rpe,
            feedback: payload.feedback,
        })
        .select('id')
        .single()

    if (sessionError || !session) {
        return { sessionId: null, error: sessionError?.message || 'Erro ao criar sessão' }
    }

    // 2. Build set_logs — only completed sets
    const setLogs: any[] = []

    for (const exercise of payload.exercises) {
        for (let i = 0; i < exercise.setsData.length; i++) {
            const set = exercise.setsData[i]
            if (set.completed) {
                setLogs.push({
                    workout_session_id: session.id,
                    assigned_workout_item_id: exercise.id,
                    planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                    executed_exercise_id: exercise.exercise_id,
                    swap_source: exercise.swap_source || 'none',
                    exercise_id: exercise.exercise_id,
                    set_number: i + 1,
                    weight: parseFloat(set.weight) || 0,
                    reps_completed: parseInt(set.reps) || 0,
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    weight_unit: 'kg',
                })
            }
        }
    }

    if (setLogs.length > 0) {
        const { error: logsError } = await supabaseAdmin
            .from('set_logs')
            .insert(setLogs)

        if (logsError) {
            return { sessionId: null, error: logsError.message }
        }
    }

    return { sessionId: session.id, error: null }
}
