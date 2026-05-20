// ============================================================================
// GET, POST /api/wallet/payouts
// ============================================================================
// GET: lists trainer's payout history.
// POST: requests a new payout (PIX out from subaccount to a saved key).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, createTransfer } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

interface CreatePayoutBody {
    pixKeyId?: string
    /** Valor em reais. Use number (R$ 200.00, não centavos). */
    value?: number
}

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const { data, error } = await supabaseAdmin
            .from('payouts')
            .select('id, amount_cents, status, failure_reason, end_to_end_id, requested_at, completed_at, pix_key_snapshot, pix_key_type_snapshot')
            .eq('trainer_id', trainer.id)
            .order('requested_at', { ascending: false })
            .limit(50)
        if (error) throw error
        return NextResponse.json({ data: data ?? [] })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/payouts GET] Error:', err)
        return NextResponse.json({ error: 'Erro ao listar saques' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    let body: CreatePayoutBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (!body.pixKeyId) {
        return NextResponse.json({ error: 'pixKeyId é obrigatório' }, { status: 400 })
    }
    if (typeof body.value !== 'number' || body.value <= 0) {
        return NextResponse.json({ error: 'value deve ser número positivo (em reais)' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        // 1. Load PIX key, confirm ownership
        const { data: pixKey, error: pixErr } = await supabaseAdmin
            .from('pix_keys')
            .select('id, pix_key, key_type, trainer_id')
            .eq('id', body.pixKeyId)
            .eq('trainer_id', trainer.id)
            .single()
        if (pixErr || !pixKey) {
            return NextResponse.json({ error: 'Chave PIX não encontrada' }, { status: 404 })
        }

        const apiKey = await getDecryptedApiKey(trainer.id)
        const amountCents = Math.round(body.value * 100)

        // 2. Idempotency key — trainer + value + minute. Same value within
        //    the same minute is treated as a duplicate click.
        const minuteBucket = Math.floor(Date.now() / 60_000)
        const idemKey = `kinevo-payout-${trainer.id}-${amountCents}-${minuteBucket}`

        // 3. Create local row (status requested) before calling Asaas. We can
        //    update with asaas_transfer_id below.
        const { data: payoutRow, error: insErr } = await supabaseAdmin
            .from('payouts')
            .insert({
                trainer_id: trainer.id,
                pix_key_id: pixKey.id,
                pix_key_snapshot: pixKey.pix_key,
                pix_key_type_snapshot: pixKey.key_type,
                amount_cents: amountCents,
                status: 'requested',
            })
            .select('id')
            .single()
        if (insErr) throw insErr

        // 4. Fire-and-store at Asaas
        let transferId: string
        let status: string
        try {
            const transfer = await createTransfer(apiKey, {
                value: body.value,
                pixAddressKey: pixKey.pix_key,
                pixAddressKeyType: pixKey.key_type,
                description: `Saque Kinevo — solicitado em ${new Date().toISOString()}`,
            }, idemKey)
            transferId = transfer.id
            status = mapTransferStatus(transfer.status)
        } catch (err) {
            await supabaseAdmin
                .from('payouts')
                .update({
                    status: 'failed',
                    failure_reason: err instanceof Error ? err.message : 'Asaas error',
                })
                .eq('id', payoutRow.id)
            throw err
        }

        await supabaseAdmin
            .from('payouts')
            .update({
                asaas_transfer_id: transferId,
                status,
            })
            .eq('id', payoutRow.id)

        // Notificação CRÍTICA: Asaas pediu MFA. Sem confirmação por SMS no
        // painel, o PIX nunca sai. Trainer precisa ser avisado imediatamente
        // mesmo se tiver desligado outras notificações financeiras.
        if (status === 'awaiting_authorization') {
            try {
                const notifId = await insertTrainerNotification({
                    trainerId: trainer.id,
                    type: 'payout_authorization_required',
                    title: 'Saque aguardando confirmação',
                    message: 'A Asaas mandou um código por SMS pra liberar o PIX. Confirme no painel da Asaas pra o dinheiro cair na sua conta.',
                    category: 'payments',
                    metadata: { route: '/financial/wallet', payoutId: payoutRow.id },
                })
                await sendTrainerPush({
                    trainerId: trainer.id,
                    type: 'payout_authorization_required',
                    title: 'Saque aguardando confirmação',
                    body: 'A Asaas pediu confirmação por SMS pra liberar seu PIX.',
                    data: { route: '/financial/wallet', payoutId: payoutRow.id },
                    notificationId: notifId ?? undefined,
                })
            } catch (notifyErr) {
                console.error('[wallet/payouts] notify awaiting_authorization failed', notifyErr)
            }
        }

        return NextResponse.json({
            id: payoutRow.id,
            asaasTransferId: transferId,
            status,
            value: body.value,
        }, { status: 201 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            return NextResponse.json({ error: err.message, asaasStatus: err.status }, { status: 502 })
        }
        console.error('[wallet/payouts POST] Error:', err)
        return NextResponse.json({ error: 'Erro ao solicitar saque' }, { status: 500 })
    }
}

type PayoutLocalStatus = 'requested' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'awaiting_authorization'

/**
 * Mapeia o status da Asaas pro nosso enum local.
 *
 * PENDING na Asaas = transfer criada mas esperando MFA (SMS) que a Asaas
 * manda pro celular cadastrado da subconta. Sem confirmação o PIX não sai.
 * Tratamos como 'awaiting_authorization' pra UI conseguir surfacizar e
 * orientar o trainer a abrir o painel.
 *
 * BANK_PROCESSING = já autorizado, em rota pro banco do destinatário.
 */
function mapTransferStatus(asaasStatus: string): PayoutLocalStatus {
    switch (asaasStatus) {
        case 'DONE': return 'completed'
        case 'BANK_PROCESSING': return 'processing'
        case 'PENDING': return 'awaiting_authorization'
        case 'FAILED': return 'failed'
        case 'CANCELLED': return 'cancelled'
        default: return 'requested'
    }
}
