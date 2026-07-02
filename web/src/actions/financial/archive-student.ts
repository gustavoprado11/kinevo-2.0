'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    archiveStudentCore,
    type ArchiveAppointmentDecision,
} from './archive-student-core'

export type { ArchiveAppointmentDecision }

export interface ArchiveStudentResult {
    success?: boolean
    error?: string
    /**
     * Quando presente, o trainer precisa decidir o que fazer com as rotinas
     * ativas do aluno antes de prosseguir. UI mostra diálogo e re-chama
     * `archiveStudent` passando `appointmentDecision: 'keep' | 'cancel'`.
     */
    needsAppointmentDecision?: boolean
    activeRoutinesCount?: number
}

export async function archiveStudent({
    studentId,
    appointmentDecision,
}: {
    studentId: string
    appointmentDecision?: ArchiveAppointmentDecision
}): Promise<ArchiveStudentResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { error: 'Treinador não encontrado' }
    }

    // Se trainer optou por cancelar as rotinas, dispara o bulk ANTES do core.
    // Reusa a action existente (ownership + push AGREGADO + Google sync) — 1
    // notificação consolidada pro aluno em vez de N. O core então roda com
    // 'keep' (não há mais rotina ativa para ele tratar).
    let decisionForCore = appointmentDecision
    if (appointmentDecision === 'cancel') {
        try {
            const { cancelAllAppointmentsForStudent } = await import(
                '@/actions/appointments/cancel-all-for-student'
            )
            await cancelAllAppointmentsForStudent({ studentId })
        } catch (err) {
            console.error('[archive-student] cancel appointments error:', err)
            // Não bloqueia o archive — é best-effort. Aluno ainda é arquivado.
        }
        decisionForCore = 'keep'
    }

    const result = await archiveStudentCore({
        trainerId: trainer.id,
        trainerName: trainer.name,
        studentId,
        appointmentDecision: decisionForCore,
    })

    if (result.needsAppointmentDecision) {
        return {
            needsAppointmentDecision: true,
            activeRoutinesCount: result.activeRoutinesCount ?? 0,
        }
    }
    if (result.error) return { error: result.error }

    // Revalidate all relevant paths
    revalidatePath('/dashboard')
    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')
    revalidatePath('/students')
    revalidatePath(`/students/${studentId}`)

    return { success: true }
}
