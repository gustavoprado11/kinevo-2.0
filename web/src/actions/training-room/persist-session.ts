'use server'

// ============================================================================
// T3 (auditoria 11/jul): persistência incremental da Sala de Treino.
// ============================================================================
// Antes, a sessão da Sala vivia 100% no localStorage até o "Concluir" —
// crash/aba fechada/troca de máquina no meio do treino perdia TUDO. Este
// módulo espelha o padrão do mobile: sessão in_progress criada no servidor e
// séries persistidas incrementalmente (upsert idempotente pela mesma unique
// do finish). O "Concluir" continua passando pela RPC transacional da
// migração 245 — que REATA esta mesma sessão (find in_progress <12h) e faz o
// catch-up de todas as séries; ou seja, falha de persistência incremental
// se auto-corrige no finish. O cron da migração 243 abandona sessões órfãs.
//
// ensureTrainingRoomSession é find-or-create E recuperação: se já existe uma
// sessão in_progress recente (criada pela Sala antes do crash, ou pelo próprio
// aluno no celular), devolve os set_logs dela para o cliente rehidratar.
// ============================================================================

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'

interface EnsureResult {
    sessionId: string | null
    /** Séries já persistidas na sessão (recuperação pós-crash / vindas do aluno). */
    existingSetLogs: Array<{
        assigned_workout_item_id: string
        set_number: number
        weight: number
        reps_completed: number
        is_completed: boolean
    }>
    error: string | null
}

async function authorizeTrainerForStudent(studentId: string): Promise<{ trainerId: string } | { error: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { error: 'Treinador não encontrado' }

    // Escopo: responsável (solo) OU membro do estúdio do aluno — a Sala de Treino
    // funciona no aluno de qualquer treinador do estúdio.
    const scope = await getStudentScope(trainer.id)
    const student = await assertStudentAccess(supabase, scope, studentId)
    if (!student) return { error: 'Aluno não encontrado' }

    return { trainerId: trainer.id }
}

export async function ensureTrainingRoomSession(input: {
    studentId: string
    assignedWorkoutId: string
    assignedProgramId: string | null
}): Promise<EnsureResult> {
    const auth = await authorizeTrainerForStudent(input.studentId)
    if ('error' in auth) return { sessionId: null, existingSetLogs: [], error: auth.error }

    // Find: sessão in_progress RECENTE (<12h) deste aluno para este treino —
    // mesma janela do reattach do finish (migração 245). Pode ter sido criada
    // pela própria Sala (antes de um crash) ou pelo aluno no celular.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabaseAdmin
        .from('workout_sessions')
        .select('id')
        .eq('student_id', input.studentId)
        .eq('assigned_workout_id', input.assignedWorkoutId)
        .eq('status', 'in_progress')
        .gt('started_at', twelveHoursAgo)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    let sessionId = existing?.id ?? null
    let existingSetLogs: EnsureResult['existingSetLogs'] = []

    if (sessionId) {
        const { data: logs } = await supabaseAdmin
            .from('set_logs')
            .select('assigned_workout_item_id, set_number, weight, reps_completed, is_completed')
            .eq('workout_session_id', sessionId)
        existingSetLogs = (logs ?? []) as EnsureResult['existingSetLogs']
    } else {
        const { data: created, error: insertError } = await supabaseAdmin
            .from('workout_sessions')
            .insert({
                student_id: input.studentId,
                trainer_id: auth.trainerId,
                assigned_workout_id: input.assignedWorkoutId,
                assigned_program_id: input.assignedProgramId,
                status: 'in_progress',
                started_at: new Date().toISOString(),
                sync_status: 'pending',
            })
            .select('id')
            .single()
        if (insertError || !created) {
            return { sessionId: null, existingSetLogs: [], error: insertError?.message ?? 'Erro ao criar sessão' }
        }
        sessionId = created.id
    }

    return { sessionId, existingSetLogs, error: null }
}

export async function upsertTrainingRoomSetLog(input: {
    sessionId: string
    studentId: string
    setLog: {
        assigned_workout_item_id: string
        planned_exercise_id: string
        executed_exercise_id: string
        swap_source: string
        exercise_id: string
        set_number: number
        weight: number
        reps_completed: number
    }
}): Promise<{ success: boolean }> {
    const auth = await authorizeTrainerForStudent(input.studentId)
    if ('error' in auth) return { success: false }

    // A sessão precisa ser DESTE aluno e ainda estar aberta — não gravamos em
    // sessão concluída (o Watch/aluno pode ter finalizado em paralelo).
    const { data: session } = await supabaseAdmin
        .from('workout_sessions')
        .select('id')
        .eq('id', input.sessionId)
        .eq('student_id', input.studentId)
        .eq('status', 'in_progress')
        .maybeSingle()
    if (!session) return { success: false }

    const { error } = await supabaseAdmin
        .from('set_logs')
        .upsert({
            workout_session_id: input.sessionId,
            ...input.setLog,
            is_completed: true,
            completed_at: new Date().toISOString(),
            weight_unit: 'kg',
        }, { onConflict: 'workout_session_id,assigned_workout_item_id,set_number' })

    if (error) {
        console.error('[training-room] upsert set_log falhou (finish faz catch-up):', error.message)
        return { success: false }
    }
    return { success: true }
}

export async function deleteTrainingRoomSetLog(input: {
    sessionId: string
    studentId: string
    assignedWorkoutItemId: string
    setNumber: number
}): Promise<{ success: boolean }> {
    const auth = await authorizeTrainerForStudent(input.studentId)
    if ('error' in auth) return { success: false }

    const { error } = await supabaseAdmin
        .from('set_logs')
        .delete()
        .eq('workout_session_id', input.sessionId)
        .eq('assigned_workout_item_id', input.assignedWorkoutItemId)
        .eq('set_number', input.setNumber)

    if (error) {
        console.error('[training-room] delete set_log falhou:', error.message)
        return { success: false }
    }
    return { success: true }
}
