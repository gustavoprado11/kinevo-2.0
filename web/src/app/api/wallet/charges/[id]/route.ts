// ============================================================================
// DELETE /api/wallet/charges/[id]
// ============================================================================
// Cancela uma cobrança pendente (Payment Link ainda não pago):
//  1. Desativa o Payment Link no Asaas (link para de aceitar pagamentos)
//  2. Marca o contrato local como status='canceled' (soft-delete) pra ter
//     trilha de auditoria — fica fora da lista de pending sem desaparecer
//     da history.
//
// Restrições:
//  - Só funciona se o contrato pertence ao trainer logado
//  - Só funciona se o contrato está em status='pending_payment' (pago não
//    pode ser cancelado por aqui — precisa estorno via webhook)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, deactivatePaymentLink, getPaymentLink } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { logContractEvent } from '@/lib/contract-events'

// ============================================================================
// GET /api/wallet/charges/[id]
// ============================================================================
// Retorna os dados da cobrança de um contrato + a URL viva do Payment Link
// (buscada na Asaas), pra UI conseguir re-compartilhar o link com o aluno.
// Auth: cookie (web) OU Bearer (mobile).
// ============================================================================
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: contractId } = await params
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        const { data: contract, error: loadErr } = await supabaseAdmin
            .from('student_contracts')
            .select('id, trainer_id, status, billing_type, provider, amount, asaas_payment_link_id')
            .eq('id', contractId)
            .maybeSingle()
        if (loadErr || !contract) {
            return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
        }
        if (contract.trainer_id !== trainer.id) {
            return NextResponse.json({ error: 'Cobrança não pertence a você' }, { status: 403 })
        }

        // Busca a URL viva do Payment Link na Asaas (best-effort). Se o link foi
        // desativado/removido, url volta null e a UI cai no fallback.
        let url: string | null = null
        if (contract.asaas_payment_link_id) {
            try {
                const apiKey = await getDecryptedApiKey(trainer.id)
                const link = await getPaymentLink(apiKey, contract.asaas_payment_link_id)
                url = link.url ?? null
            } catch (err) {
                if (!(err instanceof AsaasApiError && err.status === 404)) {
                    console.error('[wallet/charges GET] getPaymentLink failed', err)
                }
            }
        }

        return NextResponse.json({
            contractId: contract.id,
            status: contract.status,
            billingType: contract.billing_type,
            provider: contract.provider,
            value: contract.amount,
            asaasPaymentLinkId: contract.asaas_payment_link_id,
            url,
        })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/charges GET] Error', err)
        return NextResponse.json({ error: 'Erro ao consultar cobrança' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: contractId } = await params
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        // 1. Carrega contrato e valida ownership
        const { data: contract, error: loadErr } = await supabaseAdmin
            .from('student_contracts')
            .select('id, trainer_id, student_id, status, asaas_payment_link_id')
            .eq('id', contractId)
            .maybeSingle()
        if (loadErr || !contract) {
            return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
        }
        if (contract.trainer_id !== trainer.id) {
            return NextResponse.json({ error: 'Cobrança não pertence a você' }, { status: 403 })
        }
        if (contract.status !== 'pending_payment') {
            return NextResponse.json(
                { error: 'Só é possível cancelar cobranças aguardando pagamento' },
                { status: 409 },
            )
        }

        // 2. Desativa o link no Asaas (best-effort: se falhar, ainda cancela
        //    local pra UX não travar — o link inativo lá vai gerar erro pro
        //    aluno se ele tentar abrir)
        if (contract.asaas_payment_link_id) {
            try {
                const apiKey = await getDecryptedApiKey(trainer.id)
                await deactivatePaymentLink(apiKey, contract.asaas_payment_link_id)
            } catch (err) {
                if (err instanceof AsaasApiError) {
                    // 404 da Asaas = link já não existe (deletado em sessão anterior)
                    // — segue cancelando local
                    if (err.status !== 404) {
                        console.error('[wallet/charges DELETE] Asaas deactivate failed', err.status, err.body)
                    }
                } else {
                    console.error('[wallet/charges DELETE] deactivate threw', err)
                }
            }
        }

        // 3. Soft-cancel local (status=canceled + timestamp + autor)
        const { error: updErr } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'canceled',
                canceled_at: new Date().toISOString(),
                canceled_by: 'trainer',
            })
            .eq('id', contractId)
        if (updErr) {
            console.error('[wallet/charges DELETE] contract update failed', updErr)
            return NextResponse.json({ error: 'Falha ao cancelar cobrança' }, { status: 500 })
        }

        if (contract.student_id) {
            await logContractEvent({
                studentId: contract.student_id as string,
                trainerId: trainer.id,
                contractId,
                eventType: 'contract_canceled',
                metadata: { provider: 'asaas', by: 'trainer' },
            })
        }

        return NextResponse.json({ canceled: true })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/charges DELETE] Error', err)
        return NextResponse.json({ error: 'Erro ao cancelar cobrança' }, { status: 500 })
    }
}
