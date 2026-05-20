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
import { AsaasApiError, deactivatePaymentLink } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

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
            .select('id, trainer_id, status, asaas_payment_link_id')
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

        return NextResponse.json({ canceled: true })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/charges DELETE] Error', err)
        return NextResponse.json({ error: 'Erro ao cancelar cobrança' }, { status: 500 })
    }
}
