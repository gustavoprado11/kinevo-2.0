// ============================================================================
// POST /api/webhooks/asaas
// ============================================================================
// Asaas calls this URL for every event on payments, transfers, and accounts.
// Auth: header `asaas-access-token` == process.env.ASAAS_WEBHOOK_TOKEN.
// Idempotency: insert into webhook_events with the event id (UNIQUE).
//
// We ALWAYS return 200 (even on internal errors) so Asaas doesn't retry-loop
// our system into ground. Errors are logged.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@kinevo/shared/types/database'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    parseWebhookEvent,
    verifyWebhookSecret,
    ASAAS_WEBHOOK_TOKEN_HEADER,
    type AsaasWebhookEvent,
} from '@/lib/asaas'
import {
    notifyFinancial,
    resolveTrainerByAsaasAccount,
    resolveTrainerByAsaasPayment,
    resolveTrainerByAsaasTransfer,
} from '@/lib/financial/notify'
import { logContractEvent } from '@/lib/contract-events'

const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export async function POST(request: NextRequest) {
    // 1. Verify shared-secret header
    const headerValue = request.headers.get(ASAAS_WEBHOOK_TOKEN_HEADER)
    if (!verifyWebhookSecret(headerValue)) {
        console.warn('[asaas-webhook] Rejected: bad asaas-access-token')
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 2. Parse body
    let event: AsaasWebhookEvent
    // Cópia crua do body (já é JSON por vir de request.json()) pra auditoria.
    let rawPayload: Json
    try {
        const body = await request.json()
        rawPayload = body as Json
        event = parseWebhookEvent(body)
    } catch (err) {
        console.error('[asaas-webhook] Bad payload:', err)
        return NextResponse.json({ error: 'bad payload' }, { status: 400 })
    }

    // 3. Idempotency: insert into webhook_events. If unique violation, skip.
    {
        const { error: idemErr } = await supabaseAdmin
            .from('webhook_events')
            .insert({
                event_id: `asaas-${event.id}`,
                event_type: event.event,
                metadata: { source: 'asaas', payload: rawPayload },
            })
        if (idemErr) {
            if (idemErr.code === '23505') {
                console.log(`[asaas-webhook] Event ${event.id} already processed, skipping`)
                return NextResponse.json({ received: true })
            }
            console.error('[asaas-webhook] Idempotency insert failed:', idemErr)
            // Don't 500 — Asaas would retry indefinitely. Just log.
            return NextResponse.json({ received: true })
        }
    }

    console.log(`[asaas-webhook] Received event: ${event.event} (${event.id})`)

    // 4. Dispatch
    try {
        switch (event.event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
            case 'PAYMENT_RECEIVED_IN_CASH'.toUpperCase() as never:
                await handlePaymentReceived(event)
                break

            case 'PAYMENT_OVERDUE':
                await handlePaymentOverdue(event)
                break

            case 'PAYMENT_REFUNDED':
            case 'PAYMENT_DELETED':
                await handlePaymentRefunded(event)
                break

            case 'PAYMENT_CHARGEBACK_REQUESTED':
            case 'PAYMENT_CHARGEBACK_DISPUTE':
            case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
                await handlePaymentChargeback(event)
                break

            case 'TRANSFER_DONE':
                await handleTransferDone(event)
                break

            case 'TRANSFER_FAILED':
            case 'TRANSFER_CANCELLED':
                await handleTransferFailed(event)
                break

            case 'TRANSFER_PENDING':
            case 'TRANSFER_IN_BANK_PROCESSING':
                await handleTransferProcessing(event)
                break

            case 'ACCOUNT_STATUS_UPDATED':
            case 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED':
            case 'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED':
                await handleAccountStatusUpdated(event)
                break

            default:
                console.log(`[asaas-webhook] Unhandled event type: ${event.event}`)
        }
        return NextResponse.json({ received: true })
    } catch (err) {
        console.error(`[asaas-webhook] Handler error for ${event.event}:`, err)
        // Still return 200 — we logged it, retry won't help.
        return NextResponse.json({ received: true })
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePaymentReceived(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return

    // Resolve qual contrato esse pagamento está fechando. Três estratégias,
    // tentadas em ordem:
    //   1) asaas_payment_id (fluxo antigo /v3/payments direto)
    //   2) asaas_payment_link_id (fluxo Payment Link novo)
    //   3) externalReference (fluxo subscription com contract_id no campo)
    const studentIdsToUnblock = new Set<string>()
    const matchedContracts = new Set<string>()

    // --- Estratégia 1: asaas_payment_id ---
    {
        const { data: rows } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'active' })
            .eq('asaas_payment_id', payment.id)
            .in('status', ['pending_payment', 'past_due'])
            .select('id, student_id')
        if (rows) for (const r of rows) {
            matchedContracts.add(r.id as string)
            if (r.student_id) studentIdsToUnblock.add(r.student_id as string)
        }
    }

    // --- Estratégia 2: asaas_payment_link_id ---
    if (payment.paymentLink && matchedContracts.size === 0) {
        const { data: rows } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'active',
                // Backfill: cola o payment.id no contrato pra próximos eventos
                // (OVERDUE, REFUND) baterem direto pela estratégia 1.
                asaas_payment_id: payment.id,
                asaas_customer_id: payment.customer,
            })
            .eq('asaas_payment_link_id', payment.paymentLink)
            .in('status', ['pending_payment', 'past_due'])
            .select('id, student_id')
        if (rows) for (const r of rows) {
            matchedContracts.add(r.id as string)
            if (r.student_id) studentIdsToUnblock.add(r.student_id as string)
        }
    }

    // --- Estratégia 3: externalReference (assinaturas Asaas) ---
    if (payment.externalReference && matchedContracts.size === 0) {
        const { data: rows } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'active' })
            .eq('id', payment.externalReference)
            .in('status', ['pending_payment', 'past_due'])
            .select('id, student_id')
        if (rows) for (const r of rows) {
            matchedContracts.add(r.id as string)
            if (r.student_id) studentIdsToUnblock.add(r.student_id as string)
        }
    }

    // Resolve o contrato pra REGISTRO mesmo quando não houve transição de
    // status. Caso típico: parcelas 2..N de uma cobrança parcelada (INSTALLMENT)
    // — cada parcela chega com um payment.id novo, mas o contrato já está
    // 'active' (a 1ª parcela ativou). Sem isso, a receita das parcelas seguintes
    // se perderia. Faz SELECT (não muda status) por payment_id e por paymentLink.
    let recordContractId: string | null =
        matchedContracts.size > 0 ? Array.from(matchedContracts)[0] : null
    if (!recordContractId && payment.id) {
        const { data } = await supabaseAdmin
            .from('student_contracts')
            .select('id, student_id')
            .eq('asaas_payment_id', payment.id)
            .limit(1)
        const row = data?.[0]
        if (row) {
            recordContractId = row.id as string
            if (row.student_id) studentIdsToUnblock.add(row.student_id as string)
        }
    }
    if (!recordContractId && payment.paymentLink) {
        const { data } = await supabaseAdmin
            .from('student_contracts')
            .select('id, student_id')
            .eq('asaas_payment_link_id', payment.paymentLink)
            .limit(1)
        const row = data?.[0]
        if (row) {
            recordContractId = row.id as string
            if (row.student_id) studentIdsToUnblock.add(row.student_id as string)
        }
    }

    // Persiste a transação. UPSERT pra cobrir tanto o caso onde
    // /api/wallet/charges já inseriu uma linha pending (fluxo antigo) quanto
    // o caso novo (Payment Link — nenhuma linha existe ainda).
    if (recordContractId) {
        const contractId = recordContractId
        const { data: contract } = await supabaseAdmin
            .from('student_contracts')
            .select('trainer_id, student_id, installment_count')
            .eq('id', contractId)
            .maybeSingle()
        if (contract) {
            const { error: upsertErr } = await supabaseAdmin
                .from('financial_transactions')
                .upsert({
                    coach_id: contract.trainer_id,
                    student_id: contract.student_id,
                    provider: 'asaas',
                    asaas_payment_id: payment.id,
                    amount_gross: payment.value,
                    amount_net: payment.netValue,
                    currency: 'brl',
                    type: 'charge',
                    status: 'completed',
                    processed_at: new Date().toISOString(),
                    // Campos de clareza pro Financeiro (migration 185):
                    // método, parcela N de M e quando libera pra saque.
                    description: payment.description ?? payment.billingType,
                    payment_method: payment.billingType,
                    installment_number: payment.installmentNumber ?? null,
                    installment_total: payment.installmentNumber != null
                        ? (contract.installment_count ?? null)
                        : null,
                    estimated_credit_date: payment.estimatedCreditDate ?? null,
                    credit_date: payment.creditDate ?? null,
                    contract_id: contractId,
                }, { onConflict: 'asaas_payment_id' })
            if (upsertErr) {
                console.error('[asaas-webhook] upsert transaction failed:', upsertErr)
            }
            // Captura o id da assinatura Asaas (pra cancelar a recorrência depois).
            // Só seta quando ainda está vazio — não sobrescreve.
            if (payment.subscription) {
                await supabaseAdmin
                    .from('student_contracts')
                    .update({ asaas_subscription_id: payment.subscription })
                    .eq('id', contractId)
                    .is('asaas_subscription_id', null)
            }
            // Registra no histórico do contrato (timeline do detalhe do aluno).
            // Dedupe por paymentId: RECEIVED e CONFIRMED chegam como eventos
            // distintos (ids diferentes) para o MESMO pagamento — o dedupe por
            // event.id lá em cima não cobre esse caso.
            const { data: existingEvent } = await supabaseAdmin
                .from('contract_events')
                .select('id')
                .eq('contract_id', contractId)
                .eq('event_type', 'payment_received')
                .eq('metadata->>paymentId', payment.id)
                .limit(1)
                .maybeSingle()
            if (contract.student_id && !existingEvent) {
                await logContractEvent({
                    studentId: contract.student_id as string,
                    trainerId: contract.trainer_id as string,
                    contractId,
                    eventType: 'payment_received',
                    metadata: {
                        provider: 'asaas',
                        amount: payment.value,
                        paymentId: payment.id,
                        method: payment.billingType,
                        ...(payment.installmentNumber != null
                            ? { installmentNumber: payment.installmentNumber }
                            : {}),
                    },
                })
            }
        }
    } else {
        // Fallback: tenta só atualizar pelo asaas_payment_id (caso a linha
        // tenha sido inserida pelo /charges antigo)
        await supabaseAdmin
            .from('financial_transactions')
            .update({
                status: 'completed',
                amount_net: payment.netValue,
                processed_at: new Date().toISOString(),
            })
            .eq('asaas_payment_id', payment.id)
    }

    // Desbloqueia acesso ao app pra quem estava bloqueado por inadimplência.
    // A função SQL é idempotente — se o aluno já estava livre, retorna false
    // e não faz nada.
    for (const studentId of studentIdsToUnblock) {
        const { error: unblockErr } = await supabaseAdmin.rpc('unblock_student_access', {
            p_student_id: studentId,
        })
        if (unblockErr) {
            console.error('[asaas-webhook] unblock failed for student', studentId, unblockErr)
        }
    }

    // Notifica o trainer que recebeu o pagamento (respeitando toggle)
    const trainerId = await resolveTrainerByAsaasPayment(payment.id, payment.paymentLink)
    if (trainerId) {
        // Tenta pegar o nome do aluno pra mensagem ficar mais útil
        let studentName = 'um aluno'
        if (studentIdsToUnblock.size > 0) {
            const firstStudentId = Array.from(studentIdsToUnblock)[0]
            const { data: st } = await supabaseAdmin
                .from('students')
                .select('name')
                .eq('id', firstStudentId)
                .maybeSingle()
            if (st?.name) studentName = st.name as string
        }
        await notifyFinancial({
            trainerId,
            event: 'payment_received',
            title: 'Pagamento recebido',
            body: `${studentName} pagou ${formatBRL(payment.netValue ?? payment.value)}.`,
            data: { paymentId: payment.id, route: '/financial' },
        })
    }
}

async function handlePaymentOverdue(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return
    await supabaseAdmin
        .from('financial_transactions')
        .update({ status: 'overdue' })
        .eq('asaas_payment_id', payment.id)
    // Tenta atualizar contrato por asaas_payment_id (Payment Link já tinha
    // sido backfilled em PAYMENT_RECEIVED) OU diretamente pelo paymentLink id
    type ContractRef = { id: string; trainer_id: string; student_id: string }
    let matchedContract: ContractRef | null = null
    const { data: byPay } = await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'past_due' })
        .eq('asaas_payment_id', payment.id)
        .select('id, trainer_id, student_id')
    if (byPay && byPay.length > 0) {
        matchedContract = byPay[0] as ContractRef
    } else if (payment.paymentLink) {
        const { data: byLink } = await supabaseAdmin
            .from('student_contracts')
            .update({ status: 'past_due', asaas_payment_id: payment.id })
            .eq('asaas_payment_link_id', payment.paymentLink)
            .select('id, trainer_id, student_id')
        if (byLink && byLink.length > 0) {
            matchedContract = byLink[0] as ContractRef
        }
    }

    // Registra no histórico do contrato
    if (matchedContract) {
        await logContractEvent({
            studentId: matchedContract.student_id,
            trainerId: matchedContract.trainer_id,
            contractId: matchedContract.id,
            eventType: 'contract_overdue',
            metadata: { provider: 'asaas', amount: payment.value, paymentId: payment.id },
        })
    }

    // Notifica o trainer que o aluno atrasou. O bloqueio de acesso em si fica
    // a cargo do cron block_overdue_students (respeita grace_days do trainer).
    const trainerId =
        matchedContract?.trainer_id ??
        (await resolveTrainerByAsaasPayment(payment.id, payment.paymentLink))
    if (trainerId) {
        const studentName = await studentNameById(matchedContract?.student_id)
        await notifyFinancial({
            trainerId,
            event: 'payment_overdue',
            title: 'Pagamento atrasado',
            body: `${studentName} não pagou ${formatBRL(payment.value)} no vencimento.`,
            data: { paymentId: payment.id, route: '/financial' },
        })
    }
}

async function handlePaymentRefunded(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return
    await supabaseAdmin
        .from('financial_transactions')
        .update({ status: 'refunded' })
        .eq('asaas_payment_id', payment.id)

    const trainerId = await resolveTrainerByAsaasPayment(payment.id, payment.paymentLink)
    if (trainerId) {
        await notifyFinancial({
            trainerId,
            event: 'payment_refunded',
            title: 'Reembolso processado',
            body: `${formatBRL(payment.value)} foram devolvidos ao aluno.`,
            data: { paymentId: payment.id, route: '/financial' },
        })
    }
}

// PAYMENT_CHARGEBACK_REQUESTED / DISPUTE / AWAITING_REVERSAL.
// Crítico: o trainer precisa responder dentro do prazo da operadora via Asaas.
async function handlePaymentChargeback(event: AsaasWebhookEvent) {
    const payment = event.payment
    if (!payment) return
    // Marca a transação como contestada pra refletir no extrato.
    await supabaseAdmin
        .from('financial_transactions')
        .update({ status: 'disputed' })
        .eq('asaas_payment_id', payment.id)

    const reversed = event.event === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
    const trainerId = await resolveTrainerByAsaasPayment(payment.id, payment.paymentLink)
    if (trainerId) {
        await notifyFinancial({
            trainerId,
            event: 'chargeback_alert',
            title: reversed ? 'Chargeback contestado' : 'Chargeback aberto',
            body: reversed
                ? `A contestação de ${formatBRL(payment.value)} foi enviada à operadora.`
                : `Um aluno abriu chargeback de ${formatBRL(payment.value)}. Responda pelo painel Asaas o quanto antes.`,
            data: { paymentId: payment.id, route: '/financial', kind: 'chargeback' },
        })
    }
}

async function handleTransferDone(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    await supabaseAdmin
        .from('payouts')
        .update({
            status: 'completed',
            end_to_end_id: transfer.endToEndIdentifier ?? null,
            completed_at: new Date().toISOString(),
        })
        .eq('asaas_transfer_id', transfer.id)

    // Notifica o trainer que o saque caiu na conta
    const trainerId = await resolveTrainerByAsaasTransfer(transfer.id)
    if (trainerId) {
        await notifyFinancial({
            trainerId,
            event: 'payout_completed',
            title: 'Saque caiu na conta',
            body: `${formatBRL(transfer.netValue ?? transfer.value)} disponíveis na sua chave PIX.`,
            data: { transferId: transfer.id, route: '/financial/wallet' },
        })
    }
}

async function handleTransferFailed(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    const cancelled = transfer.status === 'CANCELLED'
    const reason = transfer.failReason ?? 'Transfer failed at Asaas'
    await supabaseAdmin
        .from('payouts')
        .update({
            status: cancelled ? 'cancelled' : 'failed',
            failure_reason: reason,
        })
        .eq('asaas_transfer_id', transfer.id)

    // Crítico: o trainer tentou sacar e não caiu. Sempre notifica.
    const trainerId = await resolveTrainerByAsaasTransfer(transfer.id)
    if (trainerId) {
        await notifyFinancial({
            trainerId,
            event: 'payout_failed',
            title: cancelled ? 'Saque cancelado' : 'Saque falhou',
            body: `Seu saque de ${formatBRL(transfer.value)} não foi concluído. Motivo: ${reason}`,
            data: { transferId: transfer.id, route: '/financial/wallet' },
        })
    }
}

async function handleTransferProcessing(event: AsaasWebhookEvent) {
    const transfer = event.transfer
    if (!transfer) return
    await supabaseAdmin
        .from('payouts')
        .update({ status: 'processing' })
        .eq('asaas_transfer_id', transfer.id)
}

async function handleAccountStatusUpdated(event: AsaasWebhookEvent) {
    const account = event.account
    if (!account?.id) return

    const localStatus = mapAsaasStatusToLocal(account.accountStatus ?? 'PENDING')
    const updates: Record<string, unknown> = {
        status: localStatus,
        rejection_reason: account.rejectReason ?? null,
    }
    if (localStatus === 'approved') {
        updates.activated_at = new Date().toISOString()
    }
    await supabaseAdmin
        .from('trainer_payment_accounts')
        .update(updates)
        .eq('asaas_account_id', account.id)

    // Notifica o trainer de mudanças significativas no KYC. Aprovação é
    // notícia boa, rejeição/bloqueio é crítico.
    if (localStatus === 'approved' || localStatus === 'rejected' || localStatus === 'blocked') {
        const trainerId = await resolveTrainerByAsaasAccount(account.id)
        if (trainerId) {
            const isGood = localStatus === 'approved'
            await notifyFinancial({
                trainerId,
                event: 'kyc_alert',
                title: isGood ? 'Sua Carteira foi liberada' : `Carteira ${localStatus === 'rejected' ? 'reprovada' : 'bloqueada'}`,
                body: isGood
                    ? 'Já pode cobrar seus alunos e sacar via PIX.'
                    : (account.rejectReason ?? 'Confira os detalhes no app pra entender o motivo.'),
                data: { route: '/financial/wallet', status: localStatus },
            })
        }
    }
}

// Busca o nome do aluno pra deixar a notificação mais útil. Tolerante a
// undefined/erro — retorna fallback genérico.
async function studentNameById(studentId?: string | null): Promise<string> {
    if (!studentId) return 'Um aluno'
    const { data } = await supabaseAdmin
        .from('students')
        .select('name')
        .eq('id', studentId)
        .maybeSingle()
    return (data?.name as string) ?? 'Um aluno'
}

function mapAsaasStatusToLocal(asaasStatus: string): 'pending' | 'awaiting' | 'approved' | 'rejected' | 'blocked' {
    switch (asaasStatus.toUpperCase()) {
        case 'AWAITING': return 'awaiting'
        case 'APPROVED': return 'approved'
        case 'REJECTED': return 'rejected'
        case 'BLOCKED': return 'blocked'
        default: return 'pending'
    }
}

