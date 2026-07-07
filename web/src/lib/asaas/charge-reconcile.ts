// ============================================================================
// Reconciliação de cobrança Payment Link — núcleo compartilhado
// ============================================================================
// O webhook PAYMENT_RECEIVED é a única fonte AUTOMÁTICA de verdade do dinheiro.
// Quando ele se perde (URL errada, fila interrompida na Asaas, prod fora do
// ar), o dinheiro cai no saldo Asaas mas o contrato fica preso em
// `pending_payment` — e o aluno pode ficar bloqueado mesmo tendo pago.
//
// Este módulo replica a lógica do webhook consultando a Asaas diretamente
// (poll de `listPaymentsByLink`). Dois consumidores:
//   • POST /api/wallet/charges/[id]/sync — botão "Sincronizar" (manual)
//   • GET  /api/cron/reconcile-asaas-charges — varredura horária (automática)
//
// Idempotente por construção: upsert por asaas_payment_id, transição de status
// guardada, evento de timeline deduplicado por paymentId.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { listPaymentsByLink, type PaymentLinkPayment } from './payment-links'
import { logContractEvent } from '@/lib/contract-events'

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

function addInterval(date: Date, interval: string): Date {
    const result = new Date(date)
    switch (interval) {
        case 'quarter':
            result.setMonth(result.getMonth() + 3)
            break
        case 'year':
            result.setFullYear(result.getFullYear() + 1)
            break
        case 'month':
        default:
            result.setMonth(result.getMonth() + 1)
    }
    return result
}

export type ReconcileOutcome =
    | { synced: true; paymentId: string; value: number; netValue: number }
    | { synced: false; reason: 'not_paid' | 'no_link' | 'canceled' | 'not_found' | 'not_owner' }

/**
 * Reconcilia UM contrato Payment Link contra a Asaas. `trainerId` é o dono já
 * autenticado pelo caller (ownership re-checado aqui — cinto e suspensório
 * porque o cron itera contratos de vários treinadores).
 */
export async function reconcilePaymentLinkContract(input: {
    contractId: string
    trainerId: string
    apiKey: string
    /** Aparece no metadata do evento de timeline ('sync' = botão, 'cron'). */
    via: 'sync' | 'cron'
}): Promise<ReconcileOutcome> {
    const { contractId, trainerId, apiKey, via } = input

    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, trainer_id, student_id, status, billing_type, asaas_payment_link_id, asaas_subscription_id, installment_count, trainer_plans:plan_id(interval)')
        .eq('id', contractId)
        .maybeSingle()

    if (!contract) return { synced: false, reason: 'not_found' }
    if (contract.trainer_id !== trainerId) return { synced: false, reason: 'not_owner' }
    if (!contract.asaas_payment_link_id) return { synced: false, reason: 'no_link' }
    if (contract.status === 'canceled') return { synced: false, reason: 'canceled' }

    // Poll na Asaas — até 5 payments do link (1º pagamento + parcelas/ciclos).
    const payments = await listPaymentsByLink(apiKey, contract.asaas_payment_link_id, 5)
    const paid = payments.find(p => PAID_STATUSES.has(p.status))
    if (!paid) return { synced: false, reason: 'not_paid' }

    await applyPaidPayment({ contract, paid, via })
    return { synced: true, paymentId: paid.id, value: paid.value, netValue: paid.netValue }
}

interface ContractRow {
    id: string
    trainer_id: string
    student_id: string | null
    status: string
    billing_type: string | null
    asaas_subscription_id: string | null
    installment_count: number | null
    trainer_plans: { interval: string | null } | { interval: string | null }[] | null
}

/** Aplica um pagamento confirmado ao contrato (mesma semântica do webhook). */
async function applyPaidPayment(input: {
    contract: ContractRow
    paid: PaymentLinkPayment
    via: 'sync' | 'cron'
}): Promise<void> {
    const { contract, paid, via } = input

    // 1. Ativa + backfilla ids (payment/customer). Idempotente: 'active' entra
    //    no filtro pra reparar estado parcial (contrato ativo sem tx — bug
    //    histórico de UNIQUE ausente).
    const { error: updErr } = await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'active',
            asaas_payment_id: paid.id,
            asaas_customer_id: paid.customer,
        })
        .eq('id', contract.id)
        .in('status', ['pending_payment', 'past_due', 'active'])
    if (updErr) {
        console.error('[charge-reconcile] contract update failed', contract.id, updErr)
        throw new Error('Falha ao atualizar contrato')
    }

    // 1b. Assinatura Asaas (links RECURRENT): captura o id pra cancelamento
    //     futuro. Só quando ainda vazio — não sobrescreve.
    if (paid.subscription) {
        await supabaseAdmin
            .from('student_contracts')
            .update({ asaas_subscription_id: paid.subscription })
            .eq('id', contract.id)
            .is('asaas_subscription_id', null)
    }

    // 1c. Período local do recorrente (P8): próximo vencimento = dueDate do
    //     ciclo pago + intervalo do plano. Sem isto, "Vencimento" fica "—"
    //     pra sempre e nenhuma lógica de expiração/carência enxerga o contrato.
    if (contract.billing_type === 'asaas_auto_recurring') {
        const rel = contract.trainer_plans
        const interval = (Array.isArray(rel) ? rel[0]?.interval : rel?.interval) ?? 'month'
        const base = paid.dueDate ? new Date(paid.dueDate) : new Date()
        if (!Number.isNaN(base.getTime())) {
            await supabaseAdmin
                .from('student_contracts')
                .update({ current_period_end: addInterval(base, interval).toISOString() })
                .eq('id', contract.id)
        }
    }

    // 2. Transação — upsert por asaas_payment_id (mesmos campos do webhook,
    //    migration 185: método, parcela N/M, datas de liberação).
    const { error: txErr } = await supabaseAdmin
        .from('financial_transactions')
        .upsert({
            coach_id: contract.trainer_id,
            student_id: contract.student_id,
            provider: 'asaas',
            asaas_payment_id: paid.id,
            amount_gross: paid.value,
            amount_net: paid.netValue,
            currency: 'brl',
            type: 'charge',
            status: 'completed',
            processed_at: new Date().toISOString(),
            description: paid.description ?? paid.billingType,
            payment_method: paid.billingType,
            installment_number: paid.installmentNumber ?? null,
            installment_total: paid.installmentNumber != null
                ? (contract.installment_count ?? null)
                : null,
            estimated_credit_date: paid.estimatedCreditDate ?? null,
            credit_date: paid.creditDate ?? null,
            contract_id: contract.id,
        }, { onConflict: 'asaas_payment_id' })
    if (txErr) {
        console.error('[charge-reconcile] upsert tx failed', contract.id, txErr)
    }

    // 3. Desbloqueia o aluno (idempotente).
    if (contract.student_id) {
        const { error: unblockErr } = await supabaseAdmin.rpc('unblock_student_access', {
            p_student_id: contract.student_id,
        })
        if (unblockErr) {
            console.error('[charge-reconcile] unblock failed', contract.id, unblockErr)
        }
    }

    // 4. Timeline — dedupe por paymentId (webhook pode já ter registrado, ou
    //    o sync manual pode rodar duas vezes).
    if (contract.student_id) {
        const { data: existingEvent } = await supabaseAdmin
            .from('contract_events')
            .select('id')
            .eq('contract_id', contract.id)
            .eq('event_type', 'payment_received')
            .eq('metadata->>paymentId', paid.id)
            .limit(1)
            .maybeSingle()
        if (!existingEvent) {
            await logContractEvent({
                studentId: contract.student_id,
                trainerId: contract.trainer_id,
                contractId: contract.id,
                eventType: 'payment_received',
                metadata: { provider: 'asaas', amount: paid.value, paymentId: paid.id, via, method: paid.billingType },
            })
        }
    }
}
