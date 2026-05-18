// ============================================================================
// Asaas — Subscriptions (assinaturas recorrentes)
// ============================================================================
// Cria/lê/atualiza/cancela assinaturas. Cobranças subsequentes são geradas
// automaticamente pelo Asaas conforme o `cycle`.
//
// Webhook PAYMENT_RECEIVED dispara em cada cobrança recorrente paga.
// ============================================================================

import type {
    AsaasSubscription,
    CreateAsaasSubscriptionInput,
} from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

// Asaas retorna o mesmo shape do nosso tipo público (campos opcionais como
// description/externalReference podem vir null ou ausentes — toleramos os dois).
type AsaasSubscriptionRaw = AsaasSubscription

/**
 * Cria uma assinatura recorrente na subconta do treinador.
 *
 * Importante: o billingType="UNDEFINED" deixa o aluno escolher PIX/Cartão na
 * primeira fatura. Pra recorrência via cartão automática, o aluno precisa
 * pagar a primeira via cartão (Asaas guarda token).
 */
export async function createSubscription(
    subaccountApiKey: string,
    input: CreateAsaasSubscriptionInput
): Promise<AsaasSubscription> {
    const body = {
        customer: input.customer,
        billingType: input.billingType,
        value: round2(input.value),
        nextDueDate: input.nextDueDate,
        cycle: input.cycle,
        description: input.description,
        externalReference: input.externalReference,
        maxPayments: input.maxPayments,
        endDate: input.endDate,
        split: input.split?.map(s => ({
            walletId: s.walletId,
            fixedValue: s.fixedValue !== undefined ? round2(s.fixedValue) : undefined,
            percentualValue: s.percentualValue,
        })),
    }

    return asaasRequest<AsaasSubscriptionRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/subscriptions',
        body,
        idempotencyKey: input.externalReference
            ? `kinevo-sub-${input.externalReference}-${input.value}-${input.cycle}`
            : undefined,
    })
}

export async function getSubscription(
    subaccountApiKey: string,
    subscriptionId: string
): Promise<AsaasSubscription> {
    return asaasRequest<AsaasSubscriptionRaw>({
        apiKey: subaccountApiKey,
        path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    })
}

/**
 * Cancela uma assinatura. Cobranças já criadas (faturas pendentes) podem
 * continuar abertas dependendo da config — o Asaas tem param `deleteRelatedPayments`.
 */
export async function cancelSubscription(
    subaccountApiKey: string,
    subscriptionId: string,
    options?: { deleteRelatedPayments?: boolean }
): Promise<{ deleted: boolean; id: string }> {
    return asaasRequest({
        apiKey: subaccountApiKey,
        method: 'DELETE',
        path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
        query: options?.deleteRelatedPayments
            ? { deleteRelatedPayments: 'true' }
            : undefined,
    })
}

/** Lista todas as assinaturas de um customer (útil pra evitar duplicação). */
export async function listSubscriptionsByCustomer(
    subaccountApiKey: string,
    customerId: string
): Promise<AsaasSubscription[]> {
    const raw = await asaasRequest<{ data: AsaasSubscriptionRaw[]; totalCount: number }>({
        apiKey: subaccountApiKey,
        path: '/subscriptions',
        query: { customer: customerId, limit: 100 },
    })
    return raw.data ?? []
}

function round2(n: number): number {
    return Math.round(n * 100) / 100
}
