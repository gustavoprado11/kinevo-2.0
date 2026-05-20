// ============================================================================
// POST /api/wallet/charges/[id]/sync
// ============================================================================
// Sync manual de uma cobrança Payment Link com a Asaas.
//
// Por que existe:
//   Webhook PAYMENT_RECEIVED pode não chegar (URL mal configurada na Asaas,
//   401 por token errado, prod fora do ar, timeout). Resultado: dinheiro
//   cai no Asaas mas nosso DB fica preso em `pending_payment`.
//
// O que faz:
//   1. Carrega contrato + valida ownership
//   2. Lista os payments do paymentLink na Asaas
//   3. Se achar pelo menos um RECEIVED/CONFIRMED → executa a mesma lógica
//      do webhook handler (insere financial_transactions + marca contrato
//      active + backfilla asaas_payment_id)
//   4. Idempotente: se já estiver active, retorna alreadySynced=true
//
// Retorno: { synced: boolean, status: 'active' | 'pending_payment' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, listPaymentsByLink } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: contractId } = await params
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        // 1. Carrega contrato + valida ownership
        const { data: contract, error: loadErr } = await supabaseAdmin
            .from('student_contracts')
            .select('id, trainer_id, student_id, status, asaas_payment_link_id, amount')
            .eq('id', contractId)
            .maybeSingle()
        if (loadErr || !contract) {
            return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
        }
        if (contract.trainer_id !== trainer.id) {
            return NextResponse.json({ error: 'Cobrança não pertence a você' }, { status: 403 })
        }
        if (!contract.asaas_payment_link_id) {
            return NextResponse.json(
                { error: 'Essa cobrança não foi gerada via Payment Link' },
                { status: 409 },
            )
        }
        if (contract.status === 'active') {
            return NextResponse.json({ synced: true, alreadySynced: true, status: 'active' })
        }
        if (contract.status === 'canceled') {
            return NextResponse.json(
                { error: 'Essa cobrança foi cancelada — não dá pra sincronizar' },
                { status: 409 },
            )
        }

        // 2. Polla a Asaas
        const apiKey = await getDecryptedApiKey(trainer.id)
        const payments = await listPaymentsByLink(apiKey, contract.asaas_payment_link_id, 5)

        const paid = payments.find(p => PAID_STATUSES.has(p.status))
        if (!paid) {
            return NextResponse.json({
                synced: false,
                status: 'pending_payment',
                message: 'Ainda não recebemos confirmação de pagamento. Tente de novo em alguns minutos.',
            })
        }

        // 3. Marca contrato como active + backfilla payment/customer ids
        const { error: updErr } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'active',
                asaas_payment_id: paid.id,
                asaas_customer_id: paid.customer,
            })
            .eq('id', contract.id)
            .in('status', ['pending_payment', 'past_due'])
        if (updErr) {
            console.error('[wallet/charges/sync] contract update failed', updErr)
            return NextResponse.json({ error: 'Falha ao atualizar contrato' }, { status: 500 })
        }

        // 4. Upsert financial_transactions (mesma lógica do webhook)
        const { error: txErr } = await supabaseAdmin
            .from('financial_transactions')
            .upsert({
                coach_id: trainer.id,
                student_id: contract.student_id,
                provider: 'asaas',
                asaas_payment_id: paid.id,
                amount_gross: paid.value,
                amount_net: paid.netValue,
                currency: 'brl',
                type: 'charge',
                status: 'completed',
                processed_at: new Date().toISOString(),
                description: paid.billingType,
            }, { onConflict: 'asaas_payment_id' })
        if (txErr) {
            console.error('[wallet/charges/sync] upsert tx failed', txErr)
        }

        // 5. Desbloqueia acesso se o aluno estava bloqueado
        if (contract.student_id) {
            const { error: unblockErr } = await supabaseAdmin.rpc('unblock_student_access', {
                p_student_id: contract.student_id,
            })
            if (unblockErr) {
                console.error('[wallet/charges/sync] unblock failed', unblockErr)
            }
        }

        return NextResponse.json({
            synced: true,
            status: 'active',
            paymentId: paid.id,
            value: paid.value,
            netValue: paid.netValue,
        })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/charges/sync] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 404 ? 404 : 502 },
            )
        }
        console.error('[wallet/charges/sync] Error', err)
        return NextResponse.json({ error: 'Erro ao sincronizar cobrança' }, { status: 500 })
    }
}
