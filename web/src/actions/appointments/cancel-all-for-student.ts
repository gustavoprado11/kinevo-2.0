'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'
import { buildImmediateInboxItem } from '@/lib/appointments/scheduled-notifications'
import {
    cancelAllForStudentInputSchema,
    type CancelAllForStudentInput,
} from './schemas'

export interface CancelAllForStudentResult {
    success: boolean
    error?: string
    data?: { canceledCount: number }
}

function todayDateKey(): string {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * Encerra todas as rotinas ativas de um aluno de uma vez (caso "aluno
 * parou de treinar"). Reusa a mesma mecânica de `cancelRecurringAppointment`
 * mas em lote: 1 UPDATE agregado + 1 push consolidado pro aluno +
 * N `syncDeleteAppointment` fire-and-forget.
 *
 * Linhas de pacote (group_id != null) são encerradas individualmente —
 * o "grupo" pode ter rotinas de outros alunos (não acontece hoje, mas
 * defensivo) que permanecem intactas. Se todas as linhas do grupo forem
 * deste aluno, fim equivalente a `cancelRecurringGroup`.
 */
export async function cancelAllAppointmentsForStudent(
    input: CancelAllForStudentInput,
): Promise<CancelAllForStudentResult> {
    const parsed = cancelAllForStudentInputSchema.safeParse(input)
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        }
    }
    const payload = parsed.data

    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // Ownership: garantir que o aluno pertence ao trainer antes de iterar.
    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id')
        .eq('id', payload.studentId)
        .single()
    if (!student) return { success: false, error: 'Aluno não encontrado' }
    if (student.coach_id !== trainer.id) {
        return { success: false, error: 'Sem permissão' }
    }

    const { data: rules } = await supabase
        .from('recurring_appointments')
        .select('id')
        .eq('student_id', payload.studentId)
        .eq('trainer_id', trainer.id)
        .eq('status', 'active')

    if (!rules || rules.length === 0) {
        // Nada pra cancelar é sucesso — UX pode mostrar "0 rotinas".
        return { success: true, data: { canceledCount: 0 } }
    }

    const endsOn = payload.endsOn ?? todayDateKey()
    const ruleIds = rules.map((r) => r.id)

    const { error: updateError } = await supabaseAdmin
        .from('recurring_appointments')
        .update({ status: 'canceled', ends_on: endsOn })
        .in('id', ruleIds)

    if (updateError) {
        console.error('[cancelAllForStudent] DB error:', updateError)
        return { success: false, error: 'Erro ao encerrar rotinas' }
    }

    // Cancelar lembretes pendentes + 1 push agregado pro aluno.
    try {
        const { error: cancelReminderError } = await supabaseAdmin
            .from('scheduled_notifications')
            .update({ status: 'canceled' })
            .in('recurring_appointment_id', ruleIds)
            .eq('source', 'appointment_reminder')
            .eq('status', 'pending')
        if (cancelReminderError) {
            console.error(
                '[cancelAllForStudent] cancel reminders error:',
                cancelReminderError,
            )
        }

        const trainerName = trainer.name ?? 'seu treinador'
        const msg = appointmentMessages.pacoteCancelado(trainerName)
        const inbox = buildImmediateInboxItem(
            payload.studentId,
            trainer.id,
            msg,
            {
                student_id: payload.studentId,
                rule_ids: ruleIds,
                event: 'todas_rotinas_encerradas',
            },
        )
        const { error: inboxError } = await supabase
            .from('student_inbox_items')
            .insert(inbox)
        if (inboxError) {
            console.error('[cancelAllForStudent] inbox insert error:', inboxError)
        }
    } catch (err) {
        console.error('[cancelAllForStudent] notifications error:', err)
    }

    // Google Calendar sync — DELETE em cada rotina (fire-and-forget).
    void (async () => {
        const { syncDeleteAppointment } = await import(
            '@/lib/google-calendar/sync-service'
        )
        for (const id of ruleIds) {
            await syncDeleteAppointment(id).catch((err) => {
                console.error('[cancelAllForStudent] google sync error:', err)
            })
        }
    })()

    revalidatePath('/dashboard')
    revalidatePath(`/students/${payload.studentId}`)

    return { success: true, data: { canceledCount: ruleIds.length } }
}
