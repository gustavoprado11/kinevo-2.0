// ============================================================================
// Cancelamento de assinatura recorrente na Asaas
// ============================================================================
// Quando o trainer cancela um contrato `asaas_auto_recurring`, além de marcar
// como cancelado no banco da Kinevo, precisamos avisar a Asaas pra parar de
// cobrar o aluno (especialmente cartão, que é débito automático).
//
// Requer que o contrato tenha `asaas_subscription_id` (capturado no webhook
// PAYMENT_RECEIVED). Contratos antigos sem esse id retornam { canceled: false,
// reason: 'no_subscription_id' } — o caller segue com o cancelamento local.
// ============================================================================

import { cancelSubscription } from '@/lib/asaas'
import { getDecryptedApiKey } from '@/lib/asaas/wallet-service'

export interface CancelRecurringInput {
    trainerId: string
    billingType: string | null
    subscriptionId: string | null
}

export type CancelRecurringResult =
    | { canceled: true }
    | { canceled: false; reason: 'not_asaas_recurring' | 'no_subscription_id' }

/**
 * Cancela a assinatura na Asaas se o contrato for recorrente Asaas e tiver
 * subscription id. Lança AsaasApiError/WalletAuthError se a Asaas recusar —
 * o caller deve tratar (não marcar como cancelado local nesse caso).
 */
export async function cancelAsaasRecurring(input: CancelRecurringInput): Promise<CancelRecurringResult> {
    if (input.billingType !== 'asaas_auto_recurring') {
        return { canceled: false, reason: 'not_asaas_recurring' }
    }
    if (!input.subscriptionId) {
        return { canceled: false, reason: 'no_subscription_id' }
    }
    const apiKey = await getDecryptedApiKey(input.trainerId)
    await cancelSubscription(apiKey, input.subscriptionId, { deleteRelatedPayments: true })
    return { canceled: true }
}
