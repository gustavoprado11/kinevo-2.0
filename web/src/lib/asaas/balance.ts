// ============================================================================
// Asaas — Balance
// ============================================================================

import type { AsaasBalance } from '@kinevo/shared/types/asaas'
import { asaasRequest } from './client'

interface BalanceRaw {
    balance: number
    totalBalance?: number
}

/**
 * Saldo da subconta. Bate em /finance/balance. Trate como cache de 30s na
 * UI — não chamar a cada render.
 */
export async function getBalance(subaccountApiKey: string): Promise<AsaasBalance> {
    const raw = await asaasRequest<BalanceRaw>({
        apiKey: subaccountApiKey,
        path: '/finance/balance',
    })
    return {
        balance: raw.balance,
        totalBalance: raw.totalBalance ?? raw.balance,
    }
}
