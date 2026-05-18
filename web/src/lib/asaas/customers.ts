// ============================================================================
// Asaas — Customer (one per Kinevo student, inside a trainer's subaccount)
// ============================================================================
// Uses the subaccount's apiKey (NOT the main Kinevo key). That way the
// customer lives in the trainer's space and is only visible to them.
// ============================================================================

import type { AsaasCustomer, CreateAsaasCustomerInput } from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface AsaasCustomerRaw {
    id: string
    name: string
    email?: string | null
    cpfCnpj?: string | null
    mobilePhone?: string | null
    externalReference?: string | null
}

function mapCustomer(raw: AsaasCustomerRaw): AsaasCustomer {
    return {
        id: raw.id,
        name: raw.name,
        email: raw.email ?? null,
        cpfCnpj: raw.cpfCnpj ?? null,
        mobilePhone: raw.mobilePhone ?? null,
        externalReference: raw.externalReference ?? null,
    }
}

/**
 * Create a customer inside a trainer's subaccount.
 */
export async function createCustomer(
    subaccountApiKey: string,
    input: CreateAsaasCustomerInput
): Promise<AsaasCustomer> {
    const body = {
        name: input.name,
        cpfCnpj: input.cpfCnpj ? input.cpfCnpj.replace(/\D/g, '') : undefined,
        email: input.email,
        mobilePhone: input.mobilePhone?.replace(/\D/g, ''),
        externalReference: input.externalReference,
        notificationDisabled: true, // Kinevo controls notifications
    }
    const raw = await asaasRequest<AsaasCustomerRaw>({
        apiKey: subaccountApiKey,
        method: 'POST',
        path: '/customers',
        body,
    })
    return mapCustomer(raw)
}

/**
 * Find a customer by externalReference (Kinevo student_id). Returns null if
 * none exists.
 */
export async function findCustomerByExternalRef(
    subaccountApiKey: string,
    externalReference: string
): Promise<AsaasCustomer | null> {
    const raw = await asaasRequest<{ data: AsaasCustomerRaw[]; totalCount: number }>({
        apiKey: subaccountApiKey,
        path: '/customers',
        query: { externalReference, limit: 1 },
    })
    if (raw.data && raw.data.length > 0) {
        return mapCustomer(raw.data[0])
    }
    return null
}

/**
 * Find by externalReference or create. Use this on the hot path of "create
 * charge for student X" so we never duplicate customers.
 */
export async function findOrCreateCustomer(
    subaccountApiKey: string,
    input: CreateAsaasCustomerInput
): Promise<AsaasCustomer> {
    if (input.externalReference) {
        const existing = await findCustomerByExternalRef(subaccountApiKey, input.externalReference)
        if (existing) return existing
    }
    return createCustomer(subaccountApiKey, input)
}
