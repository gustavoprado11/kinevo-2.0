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
// A lógica de reconciliação vive em lib/asaas/charge-reconcile.ts (núcleo
// compartilhado com o cron /api/cron/reconcile-asaas-charges). Esta rota é o
// wrapper de auth/ownership pro botão "Sincronizar" da UI.
//
// Retorno: { synced: boolean, status: 'active' | 'pending_payment' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { reconcilePaymentLinkContract } from '@/lib/asaas/charge-reconcile'

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

        // Ownership primeiro (mensagens de erro específicas pra UI); o núcleo
        // re-checa tudo de novo por construção.
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
        if (!contract.asaas_payment_link_id) {
            return NextResponse.json(
                { error: 'Essa cobrança não foi gerada via Payment Link' },
                { status: 409 },
            )
        }
        if (contract.status === 'canceled') {
            return NextResponse.json(
                { error: 'Essa cobrança foi cancelada — não dá pra sincronizar' },
                { status: 409 },
            )
        }

        const apiKey = await getDecryptedApiKey(trainer.id)
        const outcome = await reconcilePaymentLinkContract({
            contractId,
            trainerId: trainer.id,
            apiKey,
            via: 'sync',
        })

        if (!outcome.synced) {
            return NextResponse.json({
                synced: false,
                status: contract.status,
                message: 'Ainda não recebemos confirmação de pagamento. Tente de novo em alguns minutos.',
            })
        }

        return NextResponse.json({
            synced: true,
            status: 'active',
            paymentId: outcome.paymentId,
            value: outcome.value,
            netValue: outcome.netValue,
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
