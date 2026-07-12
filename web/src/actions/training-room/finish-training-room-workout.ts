'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection'
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
    preWorkoutSubmissionId: string | null
    postWorkoutSubmissionId: string | null
    scheduledDays?: number[] | null // workout's scheduled_days for scheduled_date calculation
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

    // Determine scheduled_date: set to today if this workout is scheduled for today's day-of-week
    const todayDow = new Date().getDay()
    const isScheduledToday = payload.scheduledDays?.includes(todayDow)
    const scheduledDate = isScheduledToday ? new Date().toISOString().split('T')[0] : null

    // Compute program_week from program dates
    let programWeek = 1
    if (payload.assignedProgramId) {
        const { data: prog } = await supabaseAdmin
            .from('assigned_programs')
            .select('started_at, duration_weeks')
            .eq('id', payload.assignedProgramId)
            .single()
        if (prog?.started_at) {
            programWeek = getProgramWeek(new Date(), prog.started_at, prog.duration_weeks) ?? 1
        }
    }

    // 1. Build set_logs — only completed sets (workout_session_id é preenchido
    // pela RPC, que decide entre reatar a sessão do aluno ou criar uma nova)
    const setLogs: any[] = []

    for (const exercise of payload.exercises) {
        // Cardio items: persist a single set_log with config data in notes
        if (exercise.item_type === 'cardio' && exercise.setsData.length > 0 && exercise.setsData[0].completed) {
            const config = exercise.item_config || {}
            const notesJson = JSON.stringify({
                mode: config.mode || 'continuous',
                equipment: config.equipment,
                duration_minutes: config.duration_minutes,
                distance_km: config.distance_km,
                intensity: config.intensity,
                intervals: config.intervals,
            })
            setLogs.push({
                assigned_workout_item_id: exercise.id,
                planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                executed_exercise_id: exercise.exercise_id,
                swap_source: exercise.swap_source || 'none',
                exercise_id: exercise.exercise_id,
                set_number: 1,
                weight: 0,
                reps_completed: 1,
                is_completed: true,
                completed_at: new Date().toISOString(),
                weight_unit: 'kg',
                notes: notesJson,
            })
            continue
        }

        // Warmup items: visual-only, no persistence
        if (exercise.item_type === 'warmup') continue

        for (let i = 0; i < exercise.setsData.length; i++) {
            const set = exercise.setsData[i]
            if (set.completed) {
                setLogs.push({
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

    // 2. T2+T4 (migração 245): RPC TRANSACIONAL — sessão + séries num commit
    // só (sem sessão-fantasma nem duplicata no retry) e, se o aluno tem uma
    // sessão in_progress recente (<12h) deste treino no celular, o finish REATA
    // essa sessão em vez de criar outra (histórico único; séries que só o aluno
    // logou são preservadas, colisões a Sala vence).
    const { data: sessionId, error: rpcError } = await supabaseAdmin.rpc(
        'finish_training_room_session' as never,
        {
            p_trainer_id: payload.trainerId,
            p_student_id: payload.studentId,
            p_assigned_workout_id: payload.assignedWorkoutId,
            p_assigned_program_id: payload.assignedProgramId,
            p_started_at: new Date(payload.startedAt).toISOString(),
            p_rpe: payload.rpe,
            p_feedback: payload.feedback,
            p_pre_submission_id: payload.preWorkoutSubmissionId,
            p_post_submission_id: payload.postWorkoutSubmissionId,
            p_scheduled_date: scheduledDate,
            p_program_week: programWeek,
            p_set_logs: setLogs,
        } as never,
    )

    if (rpcError || !sessionId) {
        return { sessionId: null, error: rpcError?.message || 'Erro ao concluir treino' }
    }

    return { sessionId: sessionId as unknown as string, error: null }
}
