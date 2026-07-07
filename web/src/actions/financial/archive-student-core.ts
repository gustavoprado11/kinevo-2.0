/**
 * archiveStudentCore — núcleo compartilhado de "arquivar aluno" (offboarding).
 *
 * Parametrizado por trainerId para servir os DOIS caminhos (mesma convenção de
 * contracts-core/plans-core): a Server Action `archiveStudent` (web, sessão por
 * cookie) e a tool MCP `kinevo_archive_student` (service-role, sem JWT).
 *
 * O que faz, na ordem: (0) trava de gestão (org readonly), (1) posse do aluno,
 * (2) rotinas de agenda ativas — sem decisão, devolve needsAppointmentDecision;
 * com 'cancel', encerra cada rotina via cancelRecurringCore; (3) cancela
 * contratos ativos (inclusive assinatura Stripe), (4) loga eventos, (5) encerra
 * o vínculo trainer↔aluno e desvincula (coach_id = null), (6) push ao aluno.
 * O histórico de treinos do aluno é preservado.
 */

import {
    isStudentManagementLockedForTrainer,
    STUDENT_MANAGEMENT_LOCKED_ERROR,
} from '@/lib/limits/student-readonly'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { cancelAsaasRecurring } from '@/lib/asaas/cancel-recurring'
import { sendStudentPush } from '@/lib/push-notifications'
import { cancelRecurringCore } from '@/actions/appointments/core'

export type ArchiveAppointmentDecision = 'keep' | 'cancel'

export interface ArchiveStudentCoreResult {
    success?: boolean
    error?: string
    /**
     * Quando presente, o chamador precisa decidir o que fazer com as rotinas
     * ativas do aluno antes de prosseguir (re-chamar com appointmentDecision).
     */
    needsAppointmentDecision?: boolean
    activeRoutinesCount?: number
    /** Contratos ativos cancelados no processo (para o resumo da UI/assistente). */
    canceledContractsCount?: number
    studentName?: string
}

export async function archiveStudentCore({
    trainerId,
    trainerName,
    studentId,
    appointmentDecision,
}: {
    trainerId: string
    trainerName: string | null
    studentId: string
    appointmentDecision?: ArchiveAppointmentDecision
}): Promise<ArchiveStudentCoreResult> {
    if (await isStudentManagementLockedForTrainer(trainerId)) {
        return { error: STUDENT_MANAGEMENT_LOCKED_ERROR }
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

    if (student.coach_id !== trainerId) {
        return { error: 'Sem permissão' }
    }

    // Se ainda não há decisão sobre agendamentos, conta rotinas ativas.
    // Caso haja, pede decisão ao chamador antes de prosseguir.
    const { data: activeRules } = await supabaseAdmin
        .from('recurring_appointments')
        .select('id')
        .eq('student_id', studentId)
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
    const activeRoutinesCount = activeRules?.length ?? 0

    if (appointmentDecision === undefined && activeRoutinesCount > 0) {
        return {
            needsAppointmentDecision: true,
            activeRoutinesCount,
            studentName: student.name,
        }
    }

    // Cancelar rotinas: uma a uma via core parametrizado (posse + push + sync
    // Google já embutidos). Best-effort — não bloqueia o archive.
    if (appointmentDecision === 'cancel' && activeRoutinesCount > 0) {
        for (const rule of activeRules ?? []) {
            try {
                await cancelRecurringCore(supabaseAdmin, trainerId, { id: rule.id })
            } catch (err) {
                console.error('[archive-student-core] cancel routine error:', err)
            }
        }
    }

    try {
        // 1. Cancel all active/pending/past_due contracts for this student
        const { data: activeContracts } = await supabaseAdmin
            .from('student_contracts')
            .select('id, billing_type, stripe_subscription_id, asaas_subscription_id, status')
            .eq('student_id', studentId)
            .eq('trainer_id', trainerId)
            .in('status', ['active', 'pending', 'past_due'])

        if (activeContracts && activeContracts.length > 0) {
            // Get Stripe connect ID once for all contracts
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainerId)
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
                        console.error('[archive-student-core] Stripe cancel error:', stripeErr)
                    }
                }

                // Recorrência Asaas: sem este cancelamento o ex-aluno continua
                // sendo cobrado todo ciclo (o update abaixo só muda o banco).
                // Best-effort como o Stripe acima — falha loga e não trava o archive.
                if (contract.billing_type === 'asaas_auto_recurring') {
                    try {
                        await cancelAsaasRecurring({
                            trainerId,
                            billingType: contract.billing_type,
                            subscriptionId: contract.asaas_subscription_id,
                        })
                    } catch (asaasErr) {
                        console.error('[archive-student-core] Asaas cancel error:', asaasErr)
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
                    trainerId,
                    contractId: contract.id,
                    eventType: 'contract_canceled',
                    metadata: { canceled_by: 'trainer', reason: 'student_archived' },
                })
            }
        }

        // 2. Log the archive event
        await logContractEvent({
            studentId,
            trainerId,
            contractId: null,
            eventType: 'student_archived',
            metadata: {
                trainer_name: trainerName,
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
            .eq('coach_id', trainerId)
            .eq('is_current', true)

        // 4. Unlink student from trainer. (plan_status/current_plan_name não
        // existem no schema 2.0 e faziam o UPDATE INTEIRO falhar em runtime —
        // o aluno nunca era desvinculado por este caminho.)
        await supabaseAdmin
            .from('students')
            .update({ coach_id: null })
            .eq('id', studentId)

        // 5. Push notification to student (fire and forget)
        sendStudentPush({
            studentId,
            title: 'Atualização de conta',
            body: `Seu vínculo com ${trainerName ?? 'seu treinador'} foi encerrado. Seu histórico de treinos continua disponível.`,
            data: { type: 'account_update' },
        }).catch(() => {})

        return {
            success: true,
            canceledContractsCount: activeContracts?.length ?? 0,
            studentName: student.name,
        }
    } catch (err) {
        console.error('[archive-student-core] Error:', err)
        return { error: 'Erro ao arquivar aluno' }
    }
}
