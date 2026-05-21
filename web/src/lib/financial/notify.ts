// ============================================================================
// Financial notifications — helper que respeita trainer_financial_settings
// ============================================================================
// Wrapper em torno de insertTrainerNotification + sendTrainerPush que checa
// antes se o trainer tem o toggle correspondente ligado em
// /financial/settings. Se desligado, simplesmente não faz nada.
//
// Eventos com toggle em trainer_financial_settings:
//   - payment_received      → notify_on_payment_received
//   - subscription_canceled → notify_on_subscription_canceled
//   - payout_completed      → notify_on_payout_completed
//   - kyc_alert             → notify_on_kyc_alert
//
// Eventos SEMPRE notificados (críticos de dinheiro ou infrequentes — não há
// toggle pra silenciar, por design):
//   - payment_overdue   (aluno atrasou)
//   - payment_refunded  (reembolso processado)
//   - payout_failed     (saque falhou/cancelado — crítico)
//   - chargeback_alert  (chargeback aberto/contestado — crítico)
//
// Cada chamada faz 1-2 round trips ao banco. Não usar em hot path —
// destinada exclusivamente a webhooks/cron de baixa frequência.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import { getFinancialSettings } from './settings'

export type FinancialEventType =
    | 'payment_received'
    | 'payment_overdue'
    | 'payment_refunded'
    | 'subscription_canceled'
    | 'payout_completed'
    | 'payout_failed'
    | 'kyc_alert'
    | 'chargeback_alert'

// Mapeia evento → toggle. Eventos ausentes deste mapa sempre notificam.
const SETTING_BY_EVENT: Partial<
    Record<FinancialEventType, keyof Awaited<ReturnType<typeof getFinancialSettings>>>
> = {
    payment_received: 'notifyOnPaymentReceived',
    subscription_canceled: 'notifyOnSubscriptionCanceled',
    payout_completed: 'notifyOnPayoutCompleted',
    kyc_alert: 'notifyOnKycAlert',
}

export interface NotifyFinancialParams {
    trainerId: string
    event: FinancialEventType
    title: string
    body: string
    /** Dados estruturados pra UI do app abrir a tela certa quando clicar. */
    data?: Record<string, string>
}

/**
 * Dispara notificação push + cria entrada em trainer_notifications respeitando
 * o toggle correspondente em trainer_financial_settings.
 *
 * Não lança erros — apenas loga, pois é chamada de dentro de webhooks que
 * devem sempre retornar 200 pra Asaas.
 */
export async function notifyFinancial(params: NotifyFinancialParams): Promise<void> {
    try {
        const settingKey = SETTING_BY_EVENT[params.event]

        // Eventos sem toggle (críticos/infrequentes) sempre notificam.
        // Eventos com toggle respeitam a preferência do trainer.
        if (settingKey) {
            const settings = await getFinancialSettings(params.trainerId)
            const enabled = settings[settingKey] as boolean
            if (!enabled) {
                // Trainer desligou esse tipo de notificação — respeita.
                return
            }
        }

        const notifId = await insertTrainerNotification({
            trainerId: params.trainerId,
            type: params.event,
            title: params.title,
            message: params.body,
            category: 'payments',
            metadata: params.data,
        })

        // O Edge Function de DB webhook geralmente dispara push pra novas
        // notificações automaticamente. Mas pra garantir entrega imediata em
        // eventos financeiros críticos, chamamos sendTrainerPush direto.
        // O sendTrainerPush usa push_sent_at pra evitar duplicate (idempotente).
        await sendTrainerPush({
            trainerId: params.trainerId,
            type: params.event,
            title: params.title,
            body: params.body,
            data: params.data,
            notificationId: notifId ?? undefined,
        })
    } catch (err) {
        console.error('[notifyFinancial] failed for trainer', params.trainerId, params.event, err)
    }
}

// ---------------------------------------------------------------------------
// Helper pra resolver trainer_id a partir do asaas_account_id (subaccount)
// ---------------------------------------------------------------------------

/**
 * Asaas webhooks de transfer e account chegam com asaas_account_id (a subconta
 * que recebeu o evento). Precisa traduzir pra trainer_id pra disparar push.
 */
export async function resolveTrainerByAsaasAccount(
    asaasAccountId: string
): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .select('trainer_id')
        .eq('asaas_account_id', asaasAccountId)
        .maybeSingle()
    if (error || !data) return null
    return data.trainer_id as string
}

/**
 * Asaas webhooks de payment vêm com payment.customer (cus_*) — precisa
 * traduzir pra trainer_id. Tenta em ordem:
 *  1) financial_transactions.asaas_payment_id (fluxo Stripe legado + flow direto)
 *  2) student_contracts.asaas_payment_link_id (fluxo Payment Link novo)
 */
export async function resolveTrainerByAsaasPayment(
    asaasPaymentId: string,
    asaasPaymentLinkId?: string | null,
): Promise<string | null> {
    const { data: tx } = await supabaseAdmin
        .from('financial_transactions')
        .select('coach_id')
        .eq('asaas_payment_id', asaasPaymentId)
        .maybeSingle()
    if (tx?.coach_id) return tx.coach_id as string

    if (asaasPaymentLinkId) {
        const { data: contract } = await supabaseAdmin
            .from('student_contracts')
            .select('trainer_id')
            .eq('asaas_payment_link_id', asaasPaymentLinkId)
            .maybeSingle()
        if (contract?.trainer_id) return contract.trainer_id as string
    }
    return null
}

/**
 * Asaas webhooks de transfer vêm com transfer.id — traduz pra trainer_id
 * via tabela payouts.
 */
export async function resolveTrainerByAsaasTransfer(
    asaasTransferId: string
): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('payouts')
        .select('trainer_id')
        .eq('asaas_transfer_id', asaasTransferId)
        .maybeSingle()
    if (data?.trainer_id) return data.trainer_id as string
    return null
}
