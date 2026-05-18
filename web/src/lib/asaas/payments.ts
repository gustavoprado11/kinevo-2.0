// ============================================================================
// Asaas — Payments (charges)
// ============================================================================
// Cobranças criadas dentro da subconta do treinador. PIX, Cartão ou ambos
// (UNDEFINED — aluno escolhe no checkout).
// ============================================================================

import type {
    AsaasBillingType,
    AsaasPayment,
    AsaasSplit,
    CreateAsaasPaymentInput,
} from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface AsaasPaymentRaw extends Omit<AsaasPayment, 'invoiceUrl'> {
    invoiceUrl: string
}

/**
 * Create a charge. If `input.split` is set, Kinevo's wallet gets the take rate.
 */
export async function createPayment(
    subaccountApiKey: string,
    input: CreateAsaasPaymentInput
): Promise<AsaasPayment> {
    const body = {
        customer: input.customer,
        billingType: input.billingType,
        value: round2(input.value),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        split: input.split?.map(s => ({
            walletId: s.walletId,
            fixedValue: s.fixedValue !== undefined ? round2(s.fixedValue) : undefined,
            percentualValue: s.percentualValue,
        })),
        postalService: input.postalService ?? false,
        callback: input.callback,
    }

    return asaasRequest<AsaasPaymentRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/payments',
        body,
        // Idempotency key: stable hash of externalReference if provided.
        idempotencyKey: input.externalReference
            ? `kinevo-charge-${input.externalReference}-${input.dueDate}-${input.value}`
            : undefined,
    })
}

export async function getPayment(
    subaccountApiKey: string,
    paymentId: string
): Promise<AsaasPayment> {
    return asaasRequest<AsaasPaymentRaw>({
        apiKey: subaccountApiKey,
        path: `/payments/${encodeURIComponent(paymentId)}`,
    })
}

/** Get PIX QR code payload for a pending payment. */
export async function getPaymentPixQrCode(
    subaccountApiKey: string,
    paymentId: string
): Promise<{ encodedImage: string; payload: string; expirationDate?: string }> {
    return asaasRequest({
        apiKey: subaccountApiKey,
        path: `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
    })
}

/** Refund a payment (Kinevo issues this on chargeback or cancel). */
export async function refundPayment(
    subaccountApiKey: string,
    paymentId: string,
    value?: number
): Promise<AsaasPayment> {
    return asaasRequest<AsaasPaymentRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: `/payments/${encodeURIComponent(paymentId)}/refund`,
        body: value !== undefined ? { value: round2(value) } : {},
    })
}

/** Build the human-friendly description sent to the student. */
export function describeChargeForStudent(opts: {
    studentName: string
    planTitle: string
    period?: string
}): string {
    const base = `Pagamento — ${opts.planTitle}`
    if (opts.period) return `${base} (${opts.period})`
    return base
}

/** Helper: round to 2 decimals (BRL). */
function round2(n: number): number {
    return Math.round(n * 100) / 100
}

// Re-export for convenience
export type { AsaasBillingType, AsaasSplit }
