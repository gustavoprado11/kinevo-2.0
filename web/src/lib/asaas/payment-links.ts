// ============================================================================
// Asaas — Payment Links (checkout self-service)
// ============================================================================
// Por que esse módulo existe (e não usamos /v3/payments direto):
//   A Asaas exige CPF/CNPJ no Customer pra criar charge via /v3/payments.
//   Coletar CPF de aluno via UI do trainer cria fricção (trainer precisa
//   perguntar, digitar, validar). Payment Link resolve isso: o trainer cria
//   o link sem CPF, e o aluno preenche o próprio CPF no checkout hospedado
//   pela Asaas. Asaas cria Customer + Payment internamente quando o aluno
//   paga.
//
// Tracking: salvamos o paymentLink.id em student_contracts.asaas_payment_link_id.
// Quando o webhook PAYMENT_RECEIVED chegar, o payload traz `payment.paymentLink`
// que a gente cruza com essa coluna pra ativar o contrato.
// ============================================================================

import type {
    AsaasPaymentLink,
    CreateAsaasPaymentLinkInput,
} from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface AsaasPaymentLinkRaw extends Omit<AsaasPaymentLink, 'url'> {
    url: string
}

/**
 * Cria um Payment Link na subconta do trainer. Retorna a URL pública que
 * o trainer manda pro aluno via WhatsApp/email.
 *
 * @param subaccountApiKey  apiKey da subconta do trainer
 * @param input             dados da cobrança (valor, ciclo, método...)
 *
 * Idempotency key: derivado de `name` (que a gente monta com contract/student
 * id) — se o trainer clicar duas vezes em "Gerar cobrança" não cria dois
 * links. Asaas devolve o mesmo link da primeira chamada.
 */
export async function createPaymentLink(
    subaccountApiKey: string,
    input: CreateAsaasPaymentLinkInput,
    idempotencySeed?: string,
): Promise<AsaasPaymentLink> {
    const body = {
        name: input.name,
        description: input.description,
        value: round2(input.value),
        billingType: input.billingType,
        chargeType: input.chargeType,
        subscriptionCycle: input.subscriptionCycle,
        dueDateLimitDays: input.dueDateLimitDays ?? 7,
        notificationEnabled: input.notificationEnabled ?? false,
        maxInstallmentCount: input.maxInstallmentCount,
        endDate: input.endDate,
        callback: input.callback,
        split: input.split?.map(s => ({
            walletId: s.walletId,
            fixedValue: s.fixedValue !== undefined ? round2(s.fixedValue) : undefined,
            percentualValue: s.percentualValue,
        })),
    }

    return asaasRequest<AsaasPaymentLinkRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/paymentLinks',
        body,
        idempotencyKey: idempotencySeed ? `kinevo-paylink-${idempotencySeed}` : undefined,
    })
}

/** Busca um Payment Link pelo id. */
export async function getPaymentLink(
    subaccountApiKey: string,
    id: string,
): Promise<AsaasPaymentLink> {
    return asaasRequest<AsaasPaymentLinkRaw>({
        apiKey: subaccountApiKey,
        path: `/paymentLinks/${encodeURIComponent(id)}`,
    })
}

/** Desativa um Payment Link (não pode mais ser pago). */
export async function deactivatePaymentLink(
    subaccountApiKey: string,
    id: string,
): Promise<void> {
    await asaasRequest({
        apiKey: subaccountApiKey,
        method: 'DELETE',
        path: `/paymentLinks/${encodeURIComponent(id)}`,
    })
}

/**
 * Lista os pagamentos gerados por um Payment Link específico. Usado quando
 * o webhook PAYMENT_RECEIVED não chegou (ex: URL configurada errada, prod
 * fora do ar) e a gente precisa fazer sync manual: trainer clica em
 * "Sincronizar" → a gente consulta a Asaas pra saber se o link foi pago e
 * fecha o contrato.
 *
 * Retorna até `limit` payments ordenados por dateCreated desc.
 */
export interface PaymentLinkPayment {
    id: string
    status: string
    value: number
    netValue: number
    billingType: string
    customer: string
    dueDate: string
    paymentDate?: string | null
    clientPaymentDate?: string | null
    externalReference?: string | null
    paymentLink?: string | null
    /** Assinatura Asaas que gerou o pagamento (links RECURRENT, ciclo 1+). */
    subscription?: string | null
    installmentNumber?: number | null
    description?: string | null
    estimatedCreditDate?: string | null
    creditDate?: string | null
}

export async function listPaymentsByLink(
    subaccountApiKey: string,
    paymentLinkId: string,
    limit = 10,
): Promise<PaymentLinkPayment[]> {
    const raw = await asaasRequest<{ data: PaymentLinkPayment[]; totalCount: number }>({
        apiKey: subaccountApiKey,
        path: '/payments',
        query: { paymentLink: paymentLinkId, limit },
    })
    return raw.data ?? []
}

function round2(n: number): number {
    return Math.round(n * 100) / 100
}
