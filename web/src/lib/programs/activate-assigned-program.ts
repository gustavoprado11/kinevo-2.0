import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertStudentNotification } from '@/lib/student-notifications'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendStudentPush, sendTrainerPush } from '@/lib/push-notifications'

type AssignedWorkoutSchedule = {
    id: string
    name: string
    scheduled_days: number[] | null
} | null

type ActivationSource = 'manual' | 'cron'

export interface ActivateAssignedProgramResult {
    success: boolean
    activated: boolean
    reason?:
        | 'not_found'
        | 'already_active'
        | 'student_not_found'
        | 'missing_scheduled_days'
        | 'update_failed'
    error?: string
    studentId?: string
    trainerId?: string
    programName?: string
    workoutNames?: string[]
}

type ActivatedRow = { id: string }

function computeExpiresAt(startedAtIso: string, durationWeeks: number | null): string | null {
    if (!durationWeeks) return null
    return new Date(
        new Date(startedAtIso).getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000,
    ).toISOString()
}

function findWorkoutsMissingSchedule(workouts: AssignedWorkoutSchedule[] | null | undefined): string[] {
    return (workouts ?? [])
        .filter((workout): workout is NonNullable<AssignedWorkoutSchedule> => Boolean(workout))
        .filter(workout => !workout.scheduled_days || workout.scheduled_days.length === 0)
        .map(workout => workout.name)
}

export async function activateAssignedProgram(params: {
    assignedProgramId: string
    trainerId: string
    source: ActivationSource
}): Promise<ActivateAssignedProgramResult> {
    const { assignedProgramId, trainerId, source } = params

    const { data: program, error: programError } = await supabaseAdmin
        .from('assigned_programs')
        .select('id, student_id, status, name, trainer_id, duration_weeks, assigned_workouts(id, name, scheduled_days)')
        .eq('id', assignedProgramId)
        .eq('trainer_id', trainerId)
        .single()

    if (programError || !program) {
        return { success: false, activated: false, reason: 'not_found', error: 'Program not found' }
    }

    if (program.status === 'active') {
        return {
            success: true,
            activated: false,
            reason: 'already_active',
            studentId: program.student_id,
            trainerId: program.trainer_id,
            programName: program.name ?? 'Novo programa',
        }
    }

    const missingWorkoutNames = findWorkoutsMissingSchedule(program.assigned_workouts as AssignedWorkoutSchedule[])
    if (missingWorkoutNames.length > 0) {
        return {
            success: false,
            activated: false,
            reason: 'missing_scheduled_days',
            error: 'Program has workouts without scheduled days',
            studentId: program.student_id,
            trainerId: program.trainer_id,
            programName: program.name ?? 'Novo programa',
            workoutNames: missingWorkoutNames,
        }
    }

    const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, name')
        .eq('id', program.student_id)
        .eq('coach_id', trainerId)
        .single()

    if (studentError || !student) {
        return {
            success: false,
            activated: false,
            reason: 'student_not_found',
            error: 'Student not found',
            studentId: program.student_id,
            trainerId: program.trainer_id,
            programName: program.name ?? 'Novo programa',
        }
    }

    const nowIso = new Date().toISOString()
    const expiresAt = computeExpiresAt(nowIso, (program.duration_weeks as number | null) ?? null)

    const {
        data: activatedRows,
        error: updateError,
    } = await supabaseAdmin
        .from('assigned_programs')
        .update({
            status: 'active',
            started_at: nowIso,
            updated_at: nowIso,
            expires_at: expiresAt,
        })
        .eq('id', assignedProgramId)
        .eq('trainer_id', trainerId)
        .eq('status', 'scheduled')
        .select('id')

    if (updateError) {
        return {
            success: false,
            activated: false,
            reason: 'update_failed',
            error: 'Failed to activate program',
            studentId: program.student_id,
            trainerId: program.trainer_id,
            programName: program.name ?? 'Novo programa',
        }
    }

    if (!activatedRows || (activatedRows as ActivatedRow[]).length === 0) {
        return {
            success: true,
            activated: false,
            reason: 'already_active',
            studentId: program.student_id,
            trainerId: program.trainer_id,
            programName: program.name ?? 'Novo programa',
        }
    }

    await supabaseAdmin
        .from('assigned_programs')
        .update({
            status: 'completed',
            completed_at: nowIso,
            updated_at: nowIso,
        })
        .eq('student_id', program.student_id)
        .eq('trainer_id', trainerId)
        .neq('id', assignedProgramId)
        .in('status', ['active', 'expired'])

    const programName = program.name ?? 'Novo programa'

    const inboxItemId = await insertStudentNotification({
        studentId: program.student_id,
        trainerId,
        type: 'program_assigned',
        title: 'Novo programa de treino!',
        subtitle: `${programName} está disponível no seu app.`,
        payload: { program_id: assignedProgramId, program_name: programName },
    })

    sendStudentPush({
        studentId: program.student_id,
        title: 'Novo programa de treino!',
        body: `${programName} está disponível no seu app.`,
        inboxItemId: inboxItemId ?? undefined,
        data: { type: 'program_assigned', program_id: assignedProgramId },
    })

    if (source === 'cron') {
        const trainerNotificationId = await insertTrainerNotification({
            trainerId,
            type: 'program_auto_activated',
            title: 'Programa ativado automaticamente',
            message: `${programName} foi ativado automaticamente para ${student.name ?? 'Aluno'}.`,
            metadata: {
                student_id: program.student_id,
                program_id: assignedProgramId,
                activation_source: 'cron',
            },
        })

        sendTrainerPush({
            trainerId,
            type: 'program_auto_activated',
            title: 'Programa ativado automaticamente',
            body: `${programName} foi ativado automaticamente para ${student.name ?? 'Aluno'}.`,
            notificationId: trainerNotificationId ?? undefined,
            data: {
                type: 'program_auto_activated',
                student_id: program.student_id,
                program_id: assignedProgramId,
            },
        })
    }

    return {
        success: true,
        activated: true,
        studentId: program.student_id,
        trainerId: program.trainer_id,
        programName,
    }
}
