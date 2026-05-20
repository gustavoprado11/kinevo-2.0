// ============================================================================
// POST /api/wallet/payouts/[id]/sync
// ============================================================================
// Sync manual do status de um payout (saque PIX) com a Asaas.
//
// Por que existe:
//   Webhook TRANSFER_DONE/FAILED/CANCELLED pode não chegar (URL mal
//   configurada, 401, prod fora). Resultado: payout fica em `processing`
//   pra sempre na UI mesmo quando a Asaas já concluiu/falhou.
//
// O que faz:
//   1. Carrega payout + valida ownership
//   2. GET /v3/transfers/{id} na Asaas
//   3. Mapeia status real → status local, atualiza row + end_to_end_id +
//      completed_at se aplicável
//   4. Retorna { synced, status, endToEndId, failReason }
//
// Auth: trainer logado. Idempotente.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, getTransfer } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

/** Mapeia o status da Asaas pro status local que usamos em payouts. */
function mapStatus(asaasStatus: string): {
    local: 'requested' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'awaiting_authorization'
    isFinal: boolean
} {
    const s = asaasStatus.toUpperCase()
    switch (s) {
        case 'DONE':
            return { local: 'completed', isFinal: true }
        case 'CANCELLED':
            return { local: 'cancelled', isFinal: true }
        case 'FAILED':
            return { local: 'failed', isFinal: true }
        case 'BANK_PROCESSING':
            return { local: 'processing', isFinal: false }
        case 'PENDING':
            // Asaas mandou SMS pro celular cadastrado — trainer precisa
            // confirmar no painel pra liberar a transferência.
            return { local: 'awaiting_authorization', isFinal: false }
        default:
            return { local: 'requested', isFinal: false }
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: payoutId } = await params
    if (!payoutId) {
        return NextResponse.json({ error: 'payoutId é obrigatório' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        const { data: payout, error: loadErr } = await supabaseAdmin
            .from('payouts')
            .select('id, trainer_id, status, asaas_transfer_id, amount_cents, end_to_end_id, completed_at')
            .eq('id', payoutId)
            .maybeSingle()
        if (loadErr || !payout) {
            return NextResponse.json({ error: 'Saque não encontrado' }, { status: 404 })
        }
        if (payout.trainer_id !== trainer.id) {
            return NextResponse.json({ error: 'Saque não pertence a você' }, { status: 403 })
        }
        if (!payout.asaas_transfer_id) {
            return NextResponse.json(
                { error: 'Saque não tem id da Asaas — não dá pra sincronizar' },
                { status: 409 },
            )
        }

        // Consulta status real
        const apiKey = await getDecryptedApiKey(trainer.id)
        const transfer = await getTransfer(apiKey, payout.asaas_transfer_id)
        const mapped = mapStatus(transfer.status)

        const update: Record<string, unknown> = { status: mapped.local }
        if (transfer.endToEndIdentifier) update.end_to_end_id = transfer.endToEndIdentifier
        if (mapped.local === 'completed' && !payout.completed_at) {
            update.completed_at = new Date().toISOString()
        }
        if (mapped.local === 'failed' || mapped.local === 'cancelled') {
            update.failure_reason = transfer.failReason ?? `Transfer ${transfer.status.toLowerCase()}`
        }

        const { error: updErr } = await supabaseAdmin
            .from('payouts')
            .update(update)
            .eq('id', payoutId)
        if (updErr) {
            console.error('[payouts/sync] update failed', updErr)
            return NextResponse.json({ error: 'Falha ao atualizar saque' }, { status: 500 })
        }

        return NextResponse.json({
            synced: true,
            isFinal: mapped.isFinal,
            statusLocal: mapped.local,
            statusAsaas: transfer.status,
            endToEndId: transfer.endToEndIdentifier ?? null,
            failReason: transfer.failReason ?? null,
            value: transfer.value,
            netValue: transfer.netValue,
            effectiveDate: transfer.effectiveDate ?? null,
        })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[payouts/sync] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 404 ? 404 : 502 },
            )
        }
        console.error('[payouts/sync] Error', err)
        return NextResponse.json({ error: 'Erro ao sincronizar saque' }, { status: 500 })
    }
}
