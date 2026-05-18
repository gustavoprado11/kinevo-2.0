// ============================================================================
// Asaas — Subaccount (marketplace) operations
// ============================================================================
// One subaccount per trainer. Uses the Kinevo main account API key.
// ============================================================================

import type {
    AsaasAccount,
    AsaasAccountStatus,
    CreateAsaasAccountInput,
} from '@kinevo/shared/types/asaas'
import { asaasRequest, AsaasApiError, getKinevoMainApiKey } from './client'

interface AsaasAccountResponseRaw {
    id: string
    name: string
    email: string
    cpfCnpj: string
    walletId: string
    apiKey?: string
    accountStatus?: AsaasAccountStatus
    status?: AsaasAccountStatus
    rejectReason?: string | null
    dateCreated?: string
}

function mapAccount(raw: AsaasAccountResponseRaw): AsaasAccount {
    return {
        id: raw.id,
        walletId: raw.walletId,
        name: raw.name,
        email: raw.email,
        cpfCnpj: raw.cpfCnpj,
        apiKey: raw.apiKey,
        accountStatus: raw.accountStatus ?? raw.status ?? 'PENDING',
        rejectReason: raw.rejectReason ?? null,
        createdAt: raw.dateCreated ?? new Date().toISOString(),
    }
}

/**
 * Create a new subaccount (KYC delegated to Asaas).
 * Returns the new account *with* its apiKey — store it encrypted.
 */
export async function createSubaccount(input: CreateAsaasAccountInput): Promise<AsaasAccount> {
    const body = {
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
        birthDate: input.birthDate,
        mobilePhone: input.mobilePhone.replace(/\D/g, ''),
        address: input.address,
        addressNumber: input.addressNumber,
        province: input.province,
        postalCode: input.postalCode.replace(/\D/g, ''),
        incomeValue: input.incomeValue,
        companyType: input.companyType,
    }

    const raw = await asaasRequest<AsaasAccountResponseRaw>({
        apiKey: getKinevoMainApiKey(),
        method: 'POST',
        path: '/accounts',
        body,
    })

    return mapAccount(raw)
}

/**
 * Fetch the current status of a subaccount.
 */
export async function getSubaccount(asaasAccountId: string): Promise<AsaasAccount> {
    const raw = await asaasRequest<AsaasAccountResponseRaw>({
        apiKey: getKinevoMainApiKey(),
        path: `/accounts/${encodeURIComponent(asaasAccountId)}`,
    })
    return mapAccount(raw)
}

/**
 * Validate a trainer-supplied apiKey by fetching their own account info.
 * Used in the "linked account" flow — Kinevo doesn't own the account, the
 * trainer does, and the pasted credentials need to be confirmed.
 *
 * Returns name + cpfCnpj + email + status, normalized. Throws AsaasApiError
 * if the key is invalid (401/403) or the account is rejected/blocked.
 *
 * Implementation note: the canonical "who am I?" endpoint on Asaas is
 *   GET /v3/myAccount/commercialInfo   (returns name, cpfCnpj, email)
 *
 * Old `/myAccount/info` does NOT exist on Asaas — it 404s. If for any reason
 * commercialInfo fails (older account shapes, permission scoping), we fall
 * back to `/v3/finance/balance`: if THAT works, the key is at least valid
 * and we mark the account as APPROVED with no display name.
 *
 * On any non-2xx, the original AsaasApiError is re-thrown so the caller can
 * surface a useful message (e.g. "401 → key inválida", "403 → sem permissão").
 */
export async function getMyAccountInfo(apiKey: string): Promise<{
    id?: string
    name?: string
    cpfCnpj?: string
    email?: string
    status?: AsaasAccountStatus
}> {
    try {
        // Returns trainer's commercial info: name, email, cpfCnpj, etc.
        const raw = await asaasRequest<AsaasAccountResponseRaw>({
            apiKey,
            path: '/myAccount/commercialInfo',
        })
        return {
            id: raw.id,
            name: raw.name,
            cpfCnpj: raw.cpfCnpj,
            email: raw.email,
            status: raw.accountStatus ?? raw.status,
        }
    } catch (err) {
        // Re-throw auth/permission errors so caller can surface them directly.
        if (err instanceof AsaasApiError && (err.status === 401 || err.status === 403)) {
            throw err
        }
        // 404 or odd 4xx/5xx → try balance as a key-validity probe.
        // If THIS throws, propagate the error (caller will see actual reason).
        await asaasRequest({ apiKey, path: '/finance/balance' })
        return { status: 'APPROVED' }
    }
}

/**
 * Re-fetch the apiKey for an existing subaccount. Asaas only returns it on
 * creation; if Kinevo loses it (encryption rotation, etc.) the trainer needs
 * to re-onboard or contact support.
 *
 * @internal — not exposed to UI.
 */
export async function listSubaccounts(params?: { offset?: number; limit?: number }): Promise<{
    data: AsaasAccount[]
    totalCount: number
    hasMore: boolean
}> {
    const raw = await asaasRequest<{
        data: AsaasAccountResponseRaw[]
        totalCount: number
        hasMore: boolean
    }>({
        apiKey: getKinevoMainApiKey(),
        path: '/accounts',
        query: {
            offset: params?.offset,
            limit: params?.limit ?? 50,
        },
    })
    return {
        data: raw.data.map(mapAccount),
        totalCount: raw.totalCount,
        hasMore: raw.hasMore,
    }
}
