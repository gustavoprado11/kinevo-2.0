import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { activateAssignedProgram } from '@/lib/programs/activate-assigned-program'
import { insertTrainerNotification } from '@/lib/trainer-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function getTodayInSaoPaulo(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

type DueProgramRow = {
    id: string
    student_id: string
    trainer_id: string
    scheduled_start_date: string
    created_at: string
}

async function notifyActivationBlocked(params: {
    trainerId: string
    studentId: string
    programId: string
    workoutNames: string[]
}) {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: existingNotifications, error: existingError } = await supabaseAdmin
        .from('trainer_notifications')
        .select('id')
        .eq('trainer_id', params.trainerId)
        .eq('type', 'program_activation_blocked')
        .contains('data', { program_id: params.programId })
        .gte('created_at', sinceIso)
        .limit(1)

    if (existingError) {
        console.error('[cron:activate-scheduled-programs] Failed to check blocked notification dedupe', {
            programId: params.programId,
            error: existingError,
        })
        return
    }

    if (existingNotifications && existingNotifications.length > 0) {
        return
    }

    const { data: student } = await supabaseAdmin
        .from('students')
        .select('name')
        .eq('id', params.studentId)
        .single()

    await insertTrainerNotification({
        trainerId: params.trainerId,
        type: 'program_activation_blocked',
        title: 'Programa não pôde ser ativado',
        message: `O programa de ${student?.name ?? 'Aluno'} tem workouts sem dias agendados e precisa ser corrigido.`,
        metadata: {
            program_id: params.programId,
            student_id: params.studentId,
            workoutNames: params.workoutNames,
        },
    })
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const today = getTodayInSaoPaulo()

        const { data: duePrograms, error: fetchError } = await supabaseAdmin
            .from('assigned_programs')
            .select('id, student_id, trainer_id, scheduled_start_date, created_at')
            .eq('status', 'scheduled')
            .not('scheduled_start_date', 'is', null)
            .lte('scheduled_start_date', today)
            .order('scheduled_start_date', { ascending: true })
            .order('created_at', { ascending: true })

        if (fetchError) {
            console.error('[cron:activate-scheduled-programs] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        if (!duePrograms || duePrograms.length === 0) {
            return NextResponse.json({
                processed: 0,
                activated: 0,
                skippedDuplicates: 0,
                skippedInvalid: 0,
                failed: 0,
                date: today,
            })
        }

        const earliestDueByStudent = new Map<string, DueProgramRow>()
        for (const program of duePrograms as DueProgramRow[]) {
            if (!earliestDueByStudent.has(program.student_id)) {
                earliestDueByStudent.set(program.student_id, program)
            }
        }

        let activated = 0
        let skippedInvalid = 0
        let failed = 0

        for (const program of earliestDueByStudent.values()) {
            const result = await activateAssignedProgram({
                assignedProgramId: program.id,
                trainerId: program.trainer_id,
                source: 'cron',
            })

            if (result.success && result.activated) {
                activated++
                continue
            }

            if (result.reason === 'missing_scheduled_days') {
                skippedInvalid++
                await notifyActivationBlocked({
                    trainerId: program.trainer_id,
                    studentId: program.student_id,
                    programId: program.id,
                    workoutNames: result.workoutNames ?? [],
                })
                console.warn('[cron:activate-scheduled-programs] Skipped program without scheduled days', {
                    programId: program.id,
                    studentId: program.student_id,
                    workoutNames: result.workoutNames,
                })
                continue
            }

            if (result.reason !== 'already_active') {
                failed++
                console.error('[cron:activate-scheduled-programs] Failed to activate program', {
                    programId: program.id,
                    studentId: program.student_id,
                    reason: result.reason,
                    error: result.error,
                })
            }
        }

        const processed = earliestDueByStudent.size
        const skippedDuplicates = duePrograms.length - processed

        console.log(
            `[cron:activate-scheduled-programs] date=${today} processed=${processed} activated=${activated} skippedDuplicates=${skippedDuplicates} skippedInvalid=${skippedInvalid} failed=${failed}`,
        )

        return NextResponse.json({
            processed,
            activated,
            skippedDuplicates,
            skippedInvalid,
            failed,
            date: today,
        })
    } catch (err) {
        console.error('[cron:activate-scheduled-programs] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
