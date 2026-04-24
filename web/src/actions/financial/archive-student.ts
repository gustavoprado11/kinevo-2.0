'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { sendStudentPush } from '@/lib/push-notifications'
import { revalidatePath } from 'next/cache'

export type ArchiveAppointmentDecision = 'keep' | 'cancel'

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

    // Verify student belongs to trainer
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name, coach_id')
        .eq('id', studentId)
        .single()

    if (!student) {
        return { error: 'Aluno não encontrado' }
    }

    if (student.coach_id !== trainer.id) {
        return { error: 'Sem permissão' }
    }

    // Se ainda não há decisão sobre agendamentos, conta rotinas ativas.
    // Caso haja, pede decisão ao trainer antes de prosseguir.
    if (appointmentDecision === undefined) {
        const { count: activeRoutinesCount } = await supabaseAdmin
            .from('recurring_appointments')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('trainer_id', trainer.id)
            .eq('status', 'active')
        if ((activeRoutinesCount ?? 0) > 0) {
            return {
                needsAppointmentDecision: true,
                activeRoutinesCount: activeRoutinesCount ?? 0,
            }
        }
    }

    // Se trainer optou por cancelar, dispara bulk antes de arquivar.
    // Reusa a action existente (ownership + push agregado + Google sync).
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
    }

    try {
        // 1. Cancel all active/pending/past_due contracts for this student
        const { data: activeContracts } = await supabaseAdmin
            .from('student_contracts')
            .select('id, billing_type, stripe_subscription_id, status')
            .eq('student_id', studentId)
            .eq('trainer_id', trainer.id)
            .in('status', ['active', 'pending', 'past_due'])

        if (activeContracts && activeContracts.length > 0) {
            // Get Stripe connect ID once for all contracts
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            for (const contract of activeContracts) {
                // Cancel Stripe subscription if applicable
                if (
                    contract.billing_type === 'stripe_auto' &&
                    contract.stripe_subscription_id &&
                    settings?.stripe_connect_id
                ) {
                    try {
                        await stripe.subscriptions.cancel(
                            contract.stripe_subscription_id,
                            { stripeAccount: settings.stripe_connect_id }
                        )
                    } catch (stripeErr) {
                        console.error('[archive-student] Stripe cancel error:', stripeErr)
                    }
                }

                // Update contract status
                await supabaseAdmin
                    .from('student_contracts')
                    .update({
                        status: 'canceled',
                        cancel_at_period_end: false,
                        canceled_by: 'trainer',
                        canceled_at: new Date().toISOString(),
                    })
                    .eq('id', contract.id)

                await logContractEvent({
                    studentId,
                    trainerId: trainer.id,
                    contractId: contract.id,
                    eventType: 'contract_canceled',
                    metadata: { canceled_by: 'trainer', reason: 'student_archived' },
                })
            }
        }

        // 2. Log the archive event
        await logContractEvent({
            studentId,
            trainerId: trainer.id,
            contractId: null,
            eventType: 'student_archived',
            metadata: {
                trainer_name: trainer.name,
                student_name: student.name,
            },
        })

        // 3. End the trainer-student link
        await supabaseAdmin
            .from('trainer_student_links')
            .update({
                status: 'ended',
                is_current: false,
                end_reason: 'archived',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('student_id', studentId)
            .eq('coach_id', trainer.id)
            .eq('is_current', true)

        // 4. Unlink student from trainer
        await supabaseAdmin
            .from('students')
            .update({
                coach_id: null,
                plan_status: 'canceled',
                current_plan_name: null,
            })
            .eq('id', studentId)

        // 5. Push notification to student (fire and forget)
        sendStudentPush({
            studentId,
            title: 'Atualização de conta',
            body: `Seu vínculo com ${trainer.name} foi encerrado. Seu histórico de treinos continua disponível.`,
            data: { type: 'account_update' },
        }).catch(() => {})

        // 6. Revalidate all relevant paths
        revalidatePath('/dashboard')
        revalidatePath('/financial')
        revalidatePath('/financial/subscriptions')
        revalidatePath('/students')
        revalidatePath(`/students/${studentId}`)

        return { success: true }
    } catch (err) {
        console.error('[archive-student] Error:', err)
        return { error: 'Erro ao arquivar aluno' }
    }
}
